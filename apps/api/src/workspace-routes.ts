import type { FastifyInstance, FastifyRequest } from 'fastify';
import type pg from 'pg';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import {
  invitationAcceptSchema,
  invitationInputSchema,
  workspaceSaveSchema,
  type PropertyWorkspace,
} from '@estate-atlas/shared';
import { newToken, tokenHash } from './auth';
import { toProperty } from './database';
import { propertyFor, requestError } from './property-access';

const idOf = (req: FastifyRequest) => z.uuid().parse((req.params as { id: string }).id);
const paramId = (req: FastifyRequest, key: string) =>
  z.uuid().parse((req.params as Record<string, string>)[key]);
const initialWorkspace = (): PropertyWorkspace => ({
  version: 0,
  checklists: [],
  purchaseCheck: null,
});

export function registerWorkspaceRoutes(
  app: FastifyInstance,
  pool: pg.Pool,
  requireUser: (req: FastifyRequest) => Promise<void>,
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

  app.get('/properties/:id/workspace', { preHandler: requireUser }, async (req) => {
    const id = idOf(req);
    await propertyFor(pool, id, req.user!.id);
    const { rows } = await pool.query(
      'SELECT version,data FROM property_workspaces WHERE property_id=$1',
      [id],
    );
    return rows[0] ? { ...rows[0].data, version: rows[0].version } : initialWorkspace();
  });
  // Shared schema caps content at 128k UTF-16 units, at most 384k UTF-8 bytes.
  app.put(
    '/properties/:id/workspace',
    { preHandler: requireUser, bodyLimit: 512 * 1024 },
    async (req) => {
      const id = idOf(req);
      const { expectedVersion, checklists, purchaseCheck } = workspaceSaveSchema.parse(req.body);
      return transaction(async (client) => {
        await propertyFor(client, id, req.user!.id, 'edit', true);
        const { rows } = await client.query(
          'SELECT version FROM property_workspaces WHERE property_id=$1',
          [id],
        );
        if ((rows[0]?.version ?? 0) !== expectedVersion)
          throw requestError(
            409,
            'Der Arbeitsbereich wurde inzwischen geändert. Bitte den aktuellen Stand laden und deine Änderungen erneut übernehmen.',
          );
        const version = expectedVersion + 1;
        await client.query(
          'INSERT INTO property_workspaces(property_id,version,data) VALUES($1,$2,$3) ON CONFLICT(property_id) DO UPDATE SET version=EXCLUDED.version,data=EXCLUDED.data,updated_at=now()',
          [id, version, JSON.stringify({ checklists, purchaseCheck })],
        );
        return { version, checklists, purchaseCheck };
      });
    },
  );
  app.get('/properties/:id/shares', { preHandler: requireUser }, async (req) => {
    const id = idOf(req);
    await propertyFor(pool, id, req.user!.id, 'owner');
    const [members, invitations] = await Promise.all([
      pool.query(
        'SELECT m.user_id,u.name,u.email,m.role,m.created_at FROM property_members m JOIN users u ON u.id=m.user_id WHERE m.property_id=$1 ORDER BY m.created_at,m.user_id',
        [id],
      ),
      pool.query(
        'SELECT id,role,expires_at FROM property_invitations WHERE property_id=$1 AND accepted_at IS NULL AND expires_at>now() ORDER BY created_at,id',
        [id],
      ),
    ]);
    return {
      members: members.rows.map((member) => ({
        userId: member.user_id,
        name: member.name,
        email: member.email,
        role: member.role,
        createdAt: member.created_at.toISOString(),
      })),
      invitations: invitations.rows.map((invitation) => ({
        id: invitation.id,
        role: invitation.role,
        expiresAt: invitation.expires_at.toISOString(),
      })),
    };
  });
  app.post(
    '/properties/:id/invitations',
    {
      preHandler: requireUser,
      config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
    },
    async (req, reply) => {
      const id = idOf(req);
      const { role } = invitationInputSchema.parse(req.body);
      const invitation = await transaction(async (client) => {
        await propertyFor(client, id, req.user!.id, 'owner', true);
        await client.query(
          'DELETE FROM property_invitations WHERE property_id=$1 AND (accepted_at IS NOT NULL OR expires_at<=now())',
          [id],
        );
        const pending = await client.query(
          'SELECT count(*)::int AS count FROM property_invitations WHERE property_id=$1',
          [id],
        );
        if (pending.rows[0].count >= 10)
          throw requestError(409, 'Maximal zehn offene Einladungen pro Immobilie.');
        const code = newToken();
        const { rows } = await client.query(
          "INSERT INTO property_invitations(id,property_id,token_hash,role,expires_at) VALUES($1,$2,$3,$4,now()+interval '7 days') RETURNING id,role,expires_at",
          [randomUUID(), id, tokenHash(code), role],
        );
        return {
          id: rows[0].id,
          role: rows[0].role,
          code,
          expiresAt: rows[0].expires_at.toISOString(),
        };
      });
      return reply.code(201).send(invitation);
    },
  );
  app.delete(
    '/properties/:id/invitations/:invitationId',
    { preHandler: requireUser },
    async (req, reply) => {
      await transaction(async (client) => {
        const id = idOf(req);
        await propertyFor(client, id, req.user!.id, 'owner', true);
        const result = await client.query(
          'DELETE FROM property_invitations WHERE id=$1 AND property_id=$2',
          [paramId(req, 'invitationId'), id],
        );
        if (!result.rowCount) throw requestError(404, 'Einladung nicht gefunden.');
      });
      return reply.code(204).send();
    },
  );
  app.delete('/properties/:id/shares/:userId', { preHandler: requireUser }, async (req, reply) => {
    await transaction(async (client) => {
      const id = idOf(req);
      await propertyFor(client, id, req.user!.id, 'owner', true);
      const result = await client.query(
        'DELETE FROM property_members WHERE property_id=$1 AND user_id=$2',
        [id, paramId(req, 'userId')],
      );
      if (!result.rowCount) throw requestError(404, 'Freigabe nicht gefunden.');
      await client.query(
        'DELETE FROM reminder_email_notifications n USING property_reminders r WHERE n.reminder_id=r.id AND r.property_id=$1 AND n.user_id=$2',
        [id, paramId(req, 'userId')],
      );
    });
    return reply.code(204).send();
  });
  app.post(
    '/invitations/accept',
    {
      preHandler: requireUser,
      config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
    },
    async (req) => {
      const { code } = invitationAcceptSchema.parse(req.body);
      return transaction(async (client) => {
        const hash = tokenHash(code);
        // Resolve only the property first, then use the same lock order as every other write.
        const preliminary = await client.query(
          'SELECT property_id FROM property_invitations WHERE token_hash=$1',
          [hash],
        );
        const propertyId = preliminary.rows[0]?.property_id;
        if (!propertyId)
          throw requestError(404, 'Einladung ist ungültig, abgelaufen oder bereits verwendet.');
        const properties = await client.query('SELECT * FROM properties WHERE id=$1 FOR UPDATE', [
          propertyId,
        ]);
        const property = properties.rows[0];
        if (!property) throw requestError(404, 'Einladung ist nicht mehr verfügbar.');
        if (property.owner_id === req.user!.id)
          throw requestError(409, 'Die eigene Einladung kann nicht angenommen werden.');
        const invitations = await client.query(
          'SELECT * FROM property_invitations WHERE token_hash=$1 AND accepted_at IS NULL AND expires_at>now() FOR UPDATE',
          [hash],
        );
        const invitation = invitations.rows[0];
        if (!invitation)
          throw requestError(404, 'Einladung ist ungültig, abgelaufen oder bereits verwendet.');
        const existing = await client.query(
          'SELECT 1 FROM property_members WHERE property_id=$1 AND user_id=$2',
          [propertyId, req.user!.id],
        );
        const total = await client.query(
          'SELECT count(*)::int AS count FROM property_members WHERE property_id=$1',
          [propertyId],
        );
        if (!existing.rowCount && total.rows[0].count >= 30)
          throw requestError(409, 'Maximal 30 Mitwirkende pro Immobilie.');
        await client.query(
          'INSERT INTO property_members(property_id,user_id,role) VALUES($1,$2,$3) ON CONFLICT(property_id,user_id) DO UPDATE SET role=EXCLUDED.role',
          [propertyId, req.user!.id, invitation.role],
        );
        await client.query('UPDATE property_invitations SET accepted_at=now() WHERE id=$1', [
          invitation.id,
        ]);
        return toProperty({ ...property, access: invitation.role });
      });
    },
  );
}
