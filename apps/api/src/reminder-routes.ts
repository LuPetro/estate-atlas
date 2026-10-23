import type { FastifyInstance, FastifyRequest } from 'fastify';
import type pg from 'pg';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import {
  localDateKey,
  reminderInputSchema,
  reminderStatusSchema,
  reminderEmailUpdateSchema,
  type ReminderEmailPreference,
} from '@estate-atlas/shared';
import { propertyFor, requestError } from './property-access';
import type { AccountRuntime } from './account-runtime';

const idOf = (req: FastifyRequest, name = 'id') =>
  z.uuid().parse((req.params as Record<string, string>)[name]);
const emailColumns = `CASE WHEN n.reminder_id IS NULL THEN NULL ELSE json_build_object(
  'daysBefore',n.days_before,'timeZone',n.time_zone,'sendAt',n.send_at,
  'sentAt',n.sent_at,'status',n.status) END AS email_notification`;
const toReminder = (row: Record<string, any>) => ({
  id: row.id,
  propertyId: row.property_id,
  propertyTitle: row.property_title,
  title: row.title,
  notes: row.notes,
  dueDate: row.due_on instanceof Date ? localDateKey(row.due_on) : row.due_on,
  completedAt: row.completed_at ? new Date(row.completed_at).toISOString() : null,
  createdAt: new Date(row.created_at).toISOString(),
  emailNotification: row.email_notification ?? null,
});

async function scheduleEmail(
  client: pg.PoolClient,
  reminderId: string,
  req: FastifyRequest,
  preference: ReminderEmailPreference | null | undefined,
  runtime: AccountRuntime,
) {
  if (!preference) {
    await client.query(
      'DELETE FROM reminder_email_notifications WHERE reminder_id=$1 AND user_id=$2',
      [reminderId, req.user!.id],
    );
    return;
  }
  if (!runtime.mail)
    throw requestError(409, 'Für diese Installation ist kein E-Mail-Versand eingerichtet.');
  // Re-read the account: a verified address is required even in private installations.
  const user = (
    await client.query(
      "SELECT 1 FROM users WHERE id=$1 AND status='active' AND email_verified_at IS NOT NULL",
      [req.user!.id],
    )
  ).rows[0];
  if (!user) throw requestError(403, 'Bitte zuerst deine E-Mail-Adresse im Konto bestätigen.');
  const reminder = (
    await client.query(
      `SELECT due_on,completed_at,(due_on < (now() AT TIME ZONE $2)::date) AS past FROM property_reminders WHERE id=$1`,
      [reminderId, preference.timeZone],
    )
  ).rows[0];
  if (!reminder || reminder.completed_at || reminder.past)
    throw requestError(409, 'E-Mails sind nur für offene Wiedervorlagen ab heute möglich.');
  const previous = (
    await client.query(
      'SELECT days_before,time_zone,status FROM reminder_email_notifications WHERE reminder_id=$1 AND user_id=$2',
      [reminderId, req.user!.id],
    )
  ).rows[0];
  if (
    previous &&
    previous.days_before === preference.daysBefore &&
    previous.time_zone === preference.timeZone &&
    ['pending', 'sending', 'sent'].includes(previous.status)
  )
    return;
  // An already elapsed time today is sent on the next worker pass, never to everyone by default.
  await client.query(
    `INSERT INTO reminder_email_notifications(reminder_id,user_id,generation,days_before,time_zone,send_at,expires_at)
    SELECT id,$2,$3,$4,$5,GREATEST(((due_on-$4::int)+time '09:00') AT TIME ZONE $5,now()),
      ((due_on+1)+time '00:00') AT TIME ZONE $5 FROM property_reminders WHERE id=$1
    ON CONFLICT(reminder_id,user_id) DO UPDATE SET generation=EXCLUDED.generation,
      days_before=EXCLUDED.days_before,time_zone=EXCLUDED.time_zone,send_at=EXCLUDED.send_at,
      expires_at=EXCLUDED.expires_at,status='pending',attempts=0,claimed_at=NULL,sent_at=NULL,next_attempt_at=now()`,
    [reminderId, req.user!.id, randomUUID(), preference.daysBefore, preference.timeZone],
  );
}

export function registerReminderRoutes(
  app: FastifyInstance,
  pool: pg.Pool,
  requireUser: (req: FastifyRequest) => Promise<void>,
  runtime: AccountRuntime,
) {
  const transaction = async <T>(work: (client: pg.PoolClient) => Promise<T>) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  };
  const read = async (client: pg.PoolClient, id: string, userId: string) =>
    toReminder(
      (
        await client.query(
          `SELECT r.*,p.data->>'title' AS property_title,${emailColumns}
     FROM property_reminders r JOIN properties p ON p.id=r.property_id
     LEFT JOIN reminder_email_notifications n ON n.reminder_id=r.id AND n.user_id=$2 WHERE r.id=$1`,
          [id, userId],
        )
      ).rows[0],
    );
  app.get('/portfolio/reminders', { preHandler: requireUser }, async (req) => {
    const { rows } = await pool.query(
      `SELECT r.*,p.data->>'title' AS property_title,${emailColumns}
      FROM property_reminders r JOIN properties p ON p.id=r.property_id
      LEFT JOIN reminder_email_notifications n ON n.reminder_id=r.id AND n.user_id=$1
      WHERE p.owner_id=$1 OR EXISTS(SELECT 1 FROM property_members m WHERE m.property_id=p.id AND m.user_id=$1)
      ORDER BY (r.completed_at IS NOT NULL),r.due_on,r.created_at,r.id`,
      [req.user!.id],
    );
    return rows.map(toReminder);
  });
  app.post('/properties/:id/reminders', { preHandler: requireUser }, async (req, reply) => {
    const propertyId = idOf(req),
      input = reminderInputSchema.parse(req.body);
    const reminder = await transaction(async (client) => {
      const property = await propertyFor(client, propertyId, req.user!.id, 'edit', true);
      if (input.emailNotification && property.archived_at)
        throw requestError(409, 'Für archivierte Immobilien werden keine E-Mails geplant.');
      const count = await client.query(
        'SELECT count(*)::int AS count FROM property_reminders WHERE property_id=$1 AND completed_at IS NULL',
        [propertyId],
      );
      if (count.rows[0].count >= 50)
        throw requestError(409, 'Maximal 50 offene Wiedervorlagen pro Immobilie.');
      const id = randomUUID();
      await client.query(
        'INSERT INTO property_reminders(id,property_id,created_by,title,due_on,notes) VALUES($1,$2,$3,$4,$5,$6)',
        [id, propertyId, req.user!.id, input.title, input.dueDate, input.notes],
      );
      if (input.emailNotification)
        await scheduleEmail(client, id, req, input.emailNotification, runtime);
      return read(client, id, req.user!.id);
    });
    return reply.code(201).send(reminder);
  });
  app.patch('/properties/:id/reminders/:reminderId', { preHandler: requireUser }, async (req) => {
    const propertyId = idOf(req),
      id = idOf(req, 'reminderId');
    const { completed } = reminderStatusSchema.parse(req.body);
    return transaction(async (client) => {
      await propertyFor(client, propertyId, req.user!.id, 'edit', true);
      if (!completed) {
        const count = await client.query(
          'SELECT count(*)::int AS count FROM property_reminders WHERE property_id=$1 AND completed_at IS NULL AND id<>$2',
          [propertyId, id],
        );
        if (count.rows[0].count >= 50)
          throw requestError(409, 'Maximal 50 offene Wiedervorlagen pro Immobilie.');
      }
      const result = await client.query(
        'UPDATE property_reminders SET completed_at=CASE WHEN $1 THEN COALESCE(completed_at,now()) ELSE NULL END WHERE id=$2 AND property_id=$3',
        [completed, id, propertyId],
      );
      if (!result.rowCount) throw requestError(404, 'Eintrag nicht gefunden.');
      if (completed)
        await client.query(
          "UPDATE reminder_email_notifications SET status='cancelled' WHERE reminder_id=$1 AND status IN ('pending','sending')",
          [id],
        );
      return read(client, id, req.user!.id);
    });
  });
  app.put(
    '/properties/:id/reminders/:reminderId/email',
    { preHandler: requireUser },
    async (req) => {
      const propertyId = idOf(req),
        id = idOf(req, 'reminderId');
      const { notification } = reminderEmailUpdateSchema.parse(req.body);
      return transaction(async (client) => {
        const property = await propertyFor(client, propertyId, req.user!.id, 'read', true);
        if (notification && property.archived_at)
          throw requestError(409, 'Für archivierte Immobilien werden keine E-Mails geplant.');
        if (
          !(
            await client.query('SELECT 1 FROM property_reminders WHERE id=$1 AND property_id=$2', [
              id,
              propertyId,
            ])
          ).rowCount
        )
          throw requestError(404, 'Eintrag nicht gefunden.');
        await scheduleEmail(client, id, req, notification, runtime);
        return read(client, id, req.user!.id);
      });
    },
  );
  app.delete(
    '/properties/:id/reminders/:reminderId',
    { preHandler: requireUser },
    async (req, reply) => {
      await transaction(async (client) => {
        const propertyId = idOf(req),
          id = idOf(req, 'reminderId');
        await propertyFor(client, propertyId, req.user!.id, 'edit', true);
        if (
          !(
            await client.query('DELETE FROM property_reminders WHERE id=$1 AND property_id=$2', [
              id,
              propertyId,
            ])
          ).rowCount
        )
          throw requestError(404, 'Eintrag nicht gefunden.');
      });
      return reply.code(204).send();
    },
  );
}
