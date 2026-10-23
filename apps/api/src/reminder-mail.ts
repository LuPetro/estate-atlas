import type pg from 'pg';
import type { AccountRuntime } from './account-runtime';

/** Durable claim before SMTP. Unknown delivery is never retried automatically. */
export async function deliverReminderEmails(pool: pg.Pool, runtime: AccountRuntime) {
  if (!runtime.mail) return;
  const client = await pool.connect();
  let locked = false;
  try {
    locked = (await client.query('SELECT pg_try_advisory_lock(428716026) AS locked')).rows[0]
      .locked;
    if (!locked) return;
    await client.query(
      "UPDATE reminder_email_notifications SET status='unknown' WHERE status='sending' AND claimed_at<now()-interval '10 minutes'",
    );
    await client.query(
      "UPDATE reminder_email_notifications SET status='expired' WHERE status='pending' AND expires_at<=now()",
    );
    for (let i = 0; i < 2; i++) {
      const record = (
        await client.query(`UPDATE reminder_email_notifications n SET status='sending',attempts=n.attempts+1,claimed_at=now()
        FROM (SELECT reminder_id,user_id FROM reminder_email_notifications WHERE status='pending' AND send_at<=now()
          AND next_attempt_at<=now() AND expires_at>now() AND attempts<3 ORDER BY send_at,reminder_id,user_id LIMIT 1 FOR UPDATE SKIP LOCKED) c
        WHERE n.reminder_id=c.reminder_id AND n.user_id=c.user_id RETURNING n.*`)
      ).rows[0];
      if (!record) break;
      try {
        await client.query('BEGIN');
        // Match account deletion/email changes and collaborating writes in a consistent order.
        const user = (
          await client.query(
            'SELECT email,status,email_verified_at FROM users WHERE id=$1 FOR SHARE',
            [record.user_id],
          )
        ).rows[0];
        const reminder = (
          await client.query(
            `SELECT r.title,r.due_on,r.completed_at,p.id AS property_id,p.owner_id,
          p.archived_at,p.data->>'title' AS property_title FROM property_reminders r JOIN properties p ON p.id=r.property_id
          WHERE r.id=$1 FOR UPDATE OF p,r`,
            [record.reminder_id],
          )
        ).rows[0];
        const current = (
          await client.query(
            'SELECT * FROM reminder_email_notifications WHERE reminder_id=$1 AND user_id=$2 FOR UPDATE',
            [record.reminder_id, record.user_id],
          )
        ).rows[0];
        const member =
          reminder &&
          (reminder.owner_id === record.user_id ||
            (
              await client.query(
                'SELECT 1 FROM property_members WHERE property_id=$1 AND user_id=$2',
                [reminder.property_id, record.user_id],
              )
            ).rowCount);
        if (!current || current.generation !== record.generation || current.status !== 'sending') {
          await client.query('ROLLBACK');
          continue;
        }
        const expired = new Date(current.expires_at).getTime() <= Date.now();
        if (
          !user ||
          user.status !== 'active' ||
          !user.email_verified_at ||
          !reminder ||
          reminder.completed_at ||
          reminder.archived_at ||
          !member ||
          expired
        ) {
          await client.query(
            'UPDATE reminder_email_notifications SET status=$3 WHERE reminder_id=$1 AND user_id=$2',
            [record.reminder_id, record.user_id, expired ? 'expired' : 'cancelled'],
          );
        } else {
          const due =
            reminder.due_on instanceof Date
              ? reminder.due_on.toLocaleDateString('de-AT')
              : reminder.due_on;
          await runtime.mail({
            to: user.email,
            purpose: 'reminder',
            messageId: `<reminder.${record.generation}@${new URL(runtime.publicUrl).hostname}>`,
            text: `Deine Wiedervorlage in EstateAtlas\n\n${reminder.title}\nImmobilie: ${reminder.property_title}\nFällig am: ${due}\n\nÖffne deine Wiedervorlagen: ${runtime.publicUrl}/#reminders\n\nDu hast diese E-Mail für dein Konto aktiviert. Du kannst sie bei der Wiedervorlage wieder ausschalten.`,
          });
          await client.query(
            "UPDATE reminder_email_notifications SET status='sent',sent_at=now() WHERE reminder_id=$1 AND user_id=$2",
            [record.reminder_id, record.user_id],
          );
        }
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        const responseCode = Number((error as { responseCode?: number }).responseCode);
        const rejected =
          Number.isInteger(responseCode) && responseCode >= 400 && responseCode < 600;
        const retry = rejected && responseCode < 500 && record.attempts < 3;
        const status = retry ? 'pending' : rejected ? 'failed' : 'unknown';
        await client.query(
          `UPDATE reminder_email_notifications SET status=$4,next_attempt_at=now()+interval '15 minutes'
          WHERE reminder_id=$1 AND user_id=$2 AND generation=$3 AND status='sending'`,
          [record.reminder_id, record.user_id, record.generation, status],
        );
        console.warn('Reminder email not confirmed; delivery status recorded.');
      }
    }
  } finally {
    try {
      if (locked) await client.query('SELECT pg_advisory_unlock(428716026)');
    } finally {
      client.release();
    }
  }
}
