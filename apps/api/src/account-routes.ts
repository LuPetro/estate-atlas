import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type pg from 'pg';
import { randomUUID, randomBytes } from 'node:crypto';
import { Readable } from 'node:stream';
import { z } from 'zod';
import {
  forgotPasswordInputSchema,
  resetPasswordInputSchema,
  changeEmailInputSchema,
  changePasswordInputSchema,
  confirmMfaInputSchema,
  deleteAccountInputSchema,
  transferOwnerInputSchema,
  adminActionInputSchema,
  betaInvitationInputSchema,
  registrationModeInputSchema,
  auditQuerySchema,
  adminUserQuerySchema,
  profileInputSchema,
  securityInputSchema,
  tokenInputSchema,
  registerSchema,
  type User,
  type AccountInfo,
} from '@estate-atlas/shared';
import { hashPassword, verifyPassword, newToken, tokenHash } from './auth';
import { encryptSecret, decryptSecret, newMfaSecret, checkTotp } from './account-security';
import type { AccountRuntime } from './account-runtime';
const fail = (statusCode: number, message: string): never => {
  throw Object.assign(new Error(message), { statusCode });
};
const iso = (date: Date | null) => date?.toISOString() ?? null;
export function publicAccount(row: Record<string, any>): AccountInfo {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    status: row.status,
    emailVerifiedAt: iso(row.email_verified_at),
    pendingEmail: row.pending_email,
    mfaEnabled: !!row.mfa_secret,
    createdAt: iso(row.created_at)!,
    lastLoginAt: iso(row.last_login_at),
  };
}
export function sessionUser(row: Record<string, any>): User {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role ?? 'user',
    emailVerifiedAt: iso(row.email_verified_at),
    mfaEnabled: !!row.mfa_secret,
  };
}
export function createAccounts(app: FastifyInstance, pool: pg.Pool, runtime: AccountRuntime) {
  const tx = async <T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  };
  const audit = async (
    db: pg.Pool | pg.PoolClient,
    actor: string | null,
    target: string | null,
    action: string,
    reason?: string,
    metadata: Record<string, unknown> = {},
  ) => {
    await db.query(
      'INSERT INTO account_audit(id,actor_id,target_id,action,reason,metadata) VALUES($1,$2,$3,$4,$5,$6)',
      [randomUUID(), actor, target, action, reason ?? null, JSON.stringify(metadata)],
    );
  };
  const mode = async () =>
    runtime.registration ??
    ((await pool.query('SELECT registration FROM account_settings WHERE singleton=true')).rows[0]
      .registration as 'open' | 'invite');
  app.addHook('onResponse', async (req, reply) => {
    if (req.routeOptions.url === '/auth/login' && reply.statusCode === 401)
      await audit(pool, null, null, 'account.login-failed');
  });
  const identity = async (req: FastifyRequest) => {
    if (!req.user) fail(401, 'Bitte anmelden.');
  };
  const staff = async (req: FastifyRequest) => {
    await identity(req);
    if (runtime.verificationRequired && !req.user!.emailVerifiedAt)
      fail(403, 'Bitte zuerst die E-Mail-Adresse bestätigen.');
    if (!['admin', 'support'].includes(req.user!.role ?? 'user'))
      fail(403, 'Keine Verwaltungsberechtigung.');
    const { rows } = await pool.query(
      "SELECT s.mfa_verified,u.mfa_secret FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND u.status='active' AND u.role IN ('admin','support') AND s.expires_at>now()",
      [req.sessionHash],
    );
    if (!rows[0]?.mfa_verified || !rows[0]?.mfa_secret)
      fail(403, 'Zuerst Zwei-Faktor-Anmeldung im Konto einrichten und erneut anmelden.');
  };
  const admin = async (req: FastifyRequest) => {
    await staff(req);
    if (req.user!.role !== 'admin') fail(403, 'Nur Administratoren dürfen diese Aktion ausführen.');
  };
  const lockedUser = async (client: pg.PoolClient, id: string) => {
    const { rows } = await client.query('SELECT * FROM users WHERE id=$1 FOR UPDATE', [id]);
    if (!rows[0] || rows[0].status !== 'active') fail(401, 'Bitte erneut anmelden.');
    return rows[0];
  };
  const reauth = async (
    client: pg.PoolClient,
    req: FastifyRequest,
    input: z.infer<typeof securityInputSchema>,
  ) => {
    const row = await lockedUser(client, req.user!.id);
    if (!(await verifyPassword(input.password, row.password_hash)))
      fail(401, 'Bestätigung fehlgeschlagen.');
    if (row.mfa_secret && !(await consumeMfa(client, row, input.code, false)))
      fail(401, 'Zwei-Faktor-Code ungültig.');
    return row;
  };
  const reauthAdmin = async (
    client: pg.PoolClient,
    req: FastifyRequest,
    input: z.infer<typeof securityInputSchema>,
  ) => {
    const row = await reauth(client, req, input);
    if (row.role !== 'admin' || !row.mfa_secret) fail(403, 'Keine Verwaltungsberechtigung.');
    return row;
  };
  const consumeMfa = async (
    client: pg.PoolClient,
    row: Record<string, any>,
    code: string,
    replayProtection = true,
  ) => {
    if (!runtime.encryptionKey || !row.mfa_secret) return false;
    const step = checkTotp(
      decryptSecret(row.mfa_secret, runtime.encryptionKey),
      code,
      replayProtection ? Number(row.mfa_last_step) : -1,
    );
    if (step !== null) {
      if (replayProtection)
        await client.query('UPDATE users SET mfa_last_step=$2 WHERE id=$1', [row.id, step]);
      return true;
    }
    const hashes: string[] = row.recovery_hashes;
    const hash = tokenHash(code.replace(/\s/g, ''));
    if (!hashes.includes(hash)) return false;
    await client.query('UPDATE users SET recovery_hashes=$2 WHERE id=$1', [
      row.id,
      JSON.stringify(hashes.filter((x) => x !== hash)),
    ]);
    return true;
  };
  const issue = async (userId: string, email: string, purpose: 'verify' | 'reset' | 'email') => {
    if (!runtime.mail) fail(503, 'E-Mail-Versand ist noch nicht eingerichtet.');
    const token = newToken();
    await tx(async (client) => {
      await lockedUser(client, userId);
      await client.query('DELETE FROM account_tokens WHERE user_id=$1 AND purpose=$2', [
        userId,
        purpose,
      ]);
      await client.query(
        'INSERT INTO account_tokens(token_hash,user_id,purpose,email,expires_at) VALUES($1,$2,$3,$4,now()+$5::interval)',
        [tokenHash(token), userId, purpose, email, purpose === 'reset' ? '30 minutes' : '24 hours'],
      );
    });
    try {
      await runtime.mail!({ to: email, purpose, token });
    } catch {
      await pool.query('DELETE FROM account_tokens WHERE token_hash=$1', [tokenHash(token)]);
      fail(503, 'E-Mail konnte nicht zugestellt werden. Bitte später erneut versuchen.');
    }
  };
  const limited = { rateLimit: { max: 8, timeWindow: '15 minutes' } };
  app.get('/auth/config', async () => ({
    registration: await mode(),
    mailEnabled: !!runtime.mail,
    verificationRequired: runtime.verificationRequired,
    mfaAvailable: !!runtime.encryptionKey,
  }));
  app.post('/auth/forgot-password', { config: limited }, async (req) => {
    const { email } = forgotPasswordInputSchema.parse(req.body);
    if (!runtime.mail) fail(503, 'E-Mail-Versand ist noch nicht eingerichtet.');
    const { rows } = await pool.query("SELECT id FROM users WHERE email=$1 AND status='active'", [
      email,
    ]);
    if (rows[0]) {
      try {
        await issue(rows[0].id, email, 'reset');
      } catch {
        /* Same response prevents enumeration, including transport failures. */
      }
    }
    return {
      message: 'Falls ein aktives Konto existiert, erhältst du einen Link zum Zurücksetzen.',
    };
  });
  app.post('/auth/reset-password', { config: limited }, async (req) => {
    const input = resetPasswordInputSchema.parse(req.body);
    await tx(async (client) => {
      const candidate = (
        await client.query('SELECT user_id FROM account_tokens WHERE token_hash=$1', [
          tokenHash(input.token),
        ])
      ).rows[0];
      if (!candidate) fail(400, 'Link ungültig oder abgelaufen.');
      const user = await lockedUser(client, candidate.user_id);
      const result = await client.query(
        "DELETE FROM account_tokens WHERE token_hash=$1 AND purpose='reset' AND expires_at>now() AND email=$2 RETURNING user_id",
        [tokenHash(input.token), user.email],
      );
      if (!result.rowCount) fail(400, 'Link ungültig oder abgelaufen.');
      await client.query(
        'UPDATE users SET password_hash=$2,auth_version=auth_version+1 WHERE id=$1',
        [user.id, await hashPassword(input.password)],
      );
      await client.query('DELETE FROM sessions WHERE user_id=$1', [user.id]);
      await client.query("DELETE FROM account_tokens WHERE user_id=$1 AND purpose='reset'", [
        user.id,
      ]);
      await audit(client, user.id, user.id, 'password.reset');
    });
    return {
      message: 'Passwort geändert. Bitte erneut anmelden; Zwei-Faktor-Anmeldung bleibt aktiv.',
    };
  });
  app.post('/auth/verify-email', { config: limited }, async (req) => {
    const { token } = tokenInputSchema.parse(req.body);
    await tx(async (client) => {
      const candidate = (
        await client.query('SELECT user_id FROM account_tokens WHERE token_hash=$1', [
          tokenHash(token),
        ])
      ).rows[0];
      if (!candidate) fail(400, 'Link ungültig oder abgelaufen.');
      const row = await lockedUser(client, candidate.user_id);
      const { rows } = await client.query(
        "DELETE FROM account_tokens WHERE token_hash=$1 AND purpose IN ('verify','email') AND expires_at>now() RETURNING *",
        [tokenHash(token)],
      );
      const entry = rows[0];
      if (
        !entry ||
        (entry.purpose === 'verify' && entry.email !== row.email) ||
        (entry.purpose === 'email' && entry.email !== row.pending_email)
      )
        fail(400, 'Link ungültig oder abgelaufen.');
      if (entry.purpose === 'email') {
        await client.query(
          'UPDATE users SET email=$2,pending_email=NULL,email_verified_at=now(),auth_version=auth_version+1 WHERE id=$1',
          [row.id, entry.email],
        );
        await client.query('DELETE FROM sessions WHERE user_id=$1', [row.id]);
        await client.query('DELETE FROM account_tokens WHERE user_id=$1', [row.id]);
      } else await client.query('UPDATE users SET email_verified_at=now() WHERE id=$1', [row.id]);
      await audit(
        client,
        row.id,
        row.id,
        entry.purpose === 'email' ? 'email.changed' : 'email.verified',
      );
    });
    return { message: 'E-Mail bestätigt. Du kannst dich jetzt anmelden.' };
  });
  app.get('/account', { preHandler: identity }, async (req) =>
    publicAccount((await pool.query('SELECT * FROM users WHERE id=$1', [req.user!.id])).rows[0]),
  );
  app.patch('/account/profile', { preHandler: identity }, async (req) => {
    const input = profileInputSchema.parse(req.body);
    return tx(async (client) => {
      await lockedUser(client, req.user!.id);
      const result = await client.query('UPDATE users SET name=$2 WHERE id=$1 RETURNING *', [
        req.user!.id,
        input.name,
      ]);
      await audit(client, req.user!.id, req.user!.id, 'profile.changed');
      return publicAccount(result.rows[0]);
    });
  });
  app.post(
    '/account/resend-verification',
    { preHandler: identity, config: limited },
    async (req) => {
      const row = (await pool.query('SELECT * FROM users WHERE id=$1', [req.user!.id])).rows[0];
      if (!row.email_verified_at) await issue(row.id, row.email, 'verify');
      return { message: 'Bestätigung angefordert. Prüfe dein Postfach.' };
    },
  );
  app.post('/account/email', { preHandler: identity, config: limited }, async (req) => {
    const input = changeEmailInputSchema.parse(req.body);
    if (!runtime.mail) fail(503, 'E-Mail-Versand ist noch nicht eingerichtet.');
    const row = await tx(async (client) => {
      const row = await reauth(client, req, input);
      if (row.email === input.email) fail(400, 'Bitte eine neue E-Mail-Adresse eingeben.');
      const exists = await client.query('SELECT 1 FROM users WHERE email=$1', [input.email]);
      if (exists.rowCount) fail(409, 'Diese Änderung kann nicht durchgeführt werden.');
      await client.query('UPDATE users SET pending_email=$2 WHERE id=$1', [row.id, input.email]);
      return row;
    });
    await issue(row.id, input.email, 'email');
    await runtime.mail!({
      to: row.email,
      purpose: 'notice',
      text: 'Für dein EstateAtlas-Konto wurde eine Änderung der E-Mail-Adresse angefordert. Falls du das nicht warst, ändere dein Passwort und widerrufe alle Sitzungen.',
    });
    return { message: 'Bestätige die neue Adresse. Bis dahin bleibt die bisherige Adresse aktiv.' };
  });
  app.post('/account/password', { preHandler: identity, config: limited }, async (req) => {
    const input = changePasswordInputSchema.parse(req.body);
    await tx(async (client) => {
      const row = await reauth(client, req, input);
      await client.query(
        'UPDATE users SET password_hash=$2,auth_version=auth_version+1 WHERE id=$1',
        [row.id, await hashPassword(input.newPassword)],
      );
      await client.query('DELETE FROM sessions WHERE user_id=$1', [row.id]);
      await client.query('DELETE FROM account_tokens WHERE user_id=$1', [row.id]);
      await audit(client, row.id, row.id, 'password.changed');
    });
    return { message: 'Passwort geändert und alle Sitzungen beendet.' };
  });
  app.get('/account/sessions', { preHandler: identity }, async (req) => {
    const { rows } = await pool.query(
      'SELECT * FROM sessions WHERE user_id=$1 AND expires_at>now() ORDER BY created_at DESC',
      [req.user!.id],
    );
    return rows.map((s) => ({
      id: s.id,
      userAgent: s.user_agent,
      createdAt: iso(s.created_at),
      expiresAt: iso(s.expires_at),
      lastSeenAt: iso(s.last_seen_at),
      current: s.token_hash === req.sessionHash,
    }));
  });
  app.delete('/account/sessions/:id', { preHandler: identity }, async (req, reply) => {
    const id = z.uuid().parse((req.params as { id: string }).id);
    await pool.query('DELETE FROM sessions WHERE id=$1 AND user_id=$2', [id, req.user!.id]);
    await audit(pool, req.user!.id, req.user!.id, 'session.revoked');
    return reply.code(204).send();
  });
  app.post('/account/logout-all', { preHandler: identity, config: limited }, async (req) => {
    const input = securityInputSchema.parse(req.body);
    await tx(async (client) => {
      await reauth(client, req, input);
      await client.query('UPDATE users SET auth_version=auth_version+1 WHERE id=$1', [
        req.user!.id,
      ]);
      await client.query('DELETE FROM sessions WHERE user_id=$1', [req.user!.id]);
      await audit(client, req.user!.id, req.user!.id, 'sessions.revoked');
    });
    return { message: 'Alle Sitzungen beendet.' };
  });
  app.post('/account/mfa/setup', { preHandler: identity, config: limited }, async (req) => {
    const input = securityInputSchema.parse(req.body);
    if (!runtime.encryptionKey)
      fail(503, 'Zwei-Faktor-Anmeldung ist serverseitig noch nicht eingerichtet.');
    return tx(async (client) => {
      const row = await reauth(client, req, input);
      const secret = newMfaSecret();
      await client.query(
        'UPDATE users SET mfa_pending_secret=$2,mfa_pending_at=now() WHERE id=$1',
        [row.id, encryptSecret(secret, runtime.encryptionKey!)],
      );
      return {
        secret,
        uri: `otpauth://totp/${encodeURIComponent('EstateAtlas:' + row.email)}?secret=${secret}&issuer=EstateAtlas&algorithm=SHA1&digits=6&period=30`,
      };
    });
  });
  app.post('/account/mfa/confirm', { preHandler: identity, config: limited }, async (req) => {
    const { code } = confirmMfaInputSchema.parse(req.body);
    if (!runtime.encryptionKey) fail(503, 'Zwei-Faktor-Anmeldung nicht verfügbar.');
    return tx(async (client) => {
      const row = await lockedUser(client, req.user!.id);
      if (
        !row.mfa_pending_secret ||
        !row.mfa_pending_at ||
        Date.now() - row.mfa_pending_at.getTime() > 15 * 60000
      )
        fail(400, 'Einrichtung abgelaufen. Bitte neu starten.');
      const step = checkTotp(decryptSecret(row.mfa_pending_secret, runtime.encryptionKey!), code);
      if (step === null) fail(400, 'Code ungültig.');
      const recoveryCodes = Array.from({ length: 10 }, () => randomBytes(10).toString('hex'));
      await client.query(
        'UPDATE users SET auth_version=auth_version+1,mfa_secret=mfa_pending_secret,mfa_pending_secret=NULL,mfa_pending_at=NULL,mfa_last_step=$2,recovery_hashes=$3 WHERE id=$1',
        [row.id, step, JSON.stringify(recoveryCodes.map(tokenHash))],
      );
      await client.query('DELETE FROM sessions WHERE user_id=$1 AND token_hash<>$2', [
        row.id,
        req.sessionHash,
      ]);
      await client.query('UPDATE sessions SET mfa_verified=true WHERE token_hash=$1', [
        req.sessionHash,
      ]);
      await audit(client, row.id, row.id, 'mfa.enabled');
      return { recoveryCodes };
    });
  });
  app.post('/account/mfa/disable', { preHandler: identity, config: limited }, async (req) => {
    const input = securityInputSchema.parse(req.body);
    await tx(async (client) => {
      const row = await reauth(client, req, input);
      if (row.role !== 'user')
        fail(409, 'Für Verwaltungskonten ist Zwei-Faktor-Anmeldung erforderlich.');
      await client.query(
        "UPDATE users SET auth_version=auth_version+1,mfa_secret=NULL,mfa_pending_secret=NULL,recovery_hashes='[]',mfa_last_step=-1 WHERE id=$1",
        [row.id],
      );
      await client.query('DELETE FROM sessions WHERE user_id=$1', [row.id]);
      await audit(client, row.id, row.id, 'mfa.disabled');
    });
    return { message: 'Zwei-Faktor-Anmeldung deaktiviert. Bitte erneut anmelden.' };
  });
  app.post(
    '/account/export',
    { preHandler: identity, config: { rateLimit: { max: 2, timeWindow: '15 minutes' } } },
    async (req, reply) => {
      const input = securityInputSchema.parse(req.body);
      const client = await pool.connect();
      let released = false;
      const release = async (commit: boolean) => {
        if (released) return;
        released = true;
        try {
          await client.query(commit ? 'COMMIT' : 'ROLLBACK');
        } finally {
          client.release();
        }
      };
      try {
        await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ');
        const row = await reauth(client, req, input);
        await audit(client, row.id, row.id, 'account.exported');
        async function* stream() {
          try {
            yield JSON.stringify({
              format: 'EstateAtlas export v1',
              exportedAt: new Date().toISOString(),
              account: publicAccount(row),
            }).slice(0, -1);
            const sections = [
              [
                'properties',
                'SELECT id,data,archived_at,created_at,updated_at FROM properties WHERE owner_id=$1 ORDER BY id',
              ],
              [
                'valuations',
                'SELECT v.id,v.property_id,v.market_value,v.currency,v.recorded_at,v.origin FROM valuations v JOIN properties p ON p.id=v.property_id WHERE p.owner_id=$1 ORDER BY v.id',
              ],
              [
                'workspaces',
                'SELECT w.* FROM property_workspaces w JOIN properties p ON p.id=w.property_id WHERE p.owner_id=$1 ORDER BY w.property_id',
              ],
              [
                'analyses',
                'SELECT j.id,j.property_id,j.status,j.requested_at,j.result,j.diagnostics FROM analysis_jobs j JOIN properties p ON p.id=j.property_id WHERE p.owner_id=$1 ORDER BY j.id',
              ],
            ];
            for (const [name, sql] of sections) {
              yield `,"${name}":[`;
              await client.query(`DECLARE export_cursor NO SCROLL CURSOR FOR ${sql}`, [row.id]);
              let first = true;
              for (;;) {
                const batch = await client.query('FETCH 50 FROM export_cursor');
                if (!batch.rowCount) break;
                for (const record of batch.rows) {
                  yield (first ? '' : ',') + JSON.stringify(record);
                  first = false;
                }
              }
              await client.query('CLOSE export_cursor');
              yield ']';
            }
            yield ',"assets":[';
            await client.query(
              'DECLARE export_assets NO SCROLL CURSOR FOR SELECT a.id,a.property_id,a.name,a.mime_type,a.size,a.content,a.created_at FROM assets a JOIN properties p ON p.id=a.property_id WHERE p.owner_id=$1 ORDER BY a.id',
              [row.id],
            );
            let first = true;
            for (;;) {
              const result = await client.query('FETCH 1 FROM export_assets');
              if (!result.rowCount) break;
              const a = result.rows[0];
              yield (first ? '' : ',') +
                JSON.stringify({
                  ...a,
                  content: undefined,
                  contentBase64: a.content.toString('base64'),
                });
              first = false;
            }
            await client.query('CLOSE export_assets');
            yield ']}';
            await release(true);
          } finally {
            await release(false);
          }
        }
        reply
          .header('Content-Disposition', 'attachment; filename="estateatlas-export.json"')
          .type('application/json');
        return reply.send(Readable.from(stream()));
      } catch (error) {
        await release(false);
        throw error;
      }
    },
  );

  app.post('/account/delete', { preHandler: identity, config: limited }, async (req) => {
    const input = deleteAccountInputSchema.parse(req.body);
    await tx(async (client) => {
      await client.query('SELECT pg_advisory_xact_lock(428716026)');
      const row = await reauth(client, req, input);
      await protectLastAdmin(client, row, 'delete');
      await client.query('SELECT id FROM properties WHERE owner_id=$1 ORDER BY id FOR UPDATE', [
        row.id,
      ]);
      const shared = await client.query(
        'SELECT p.id FROM properties p WHERE p.owner_id=$1 AND EXISTS(SELECT 1 FROM property_members m WHERE m.property_id=p.id)',
        [row.id],
      );
      if (shared.rowCount)
        fail(
          409,
          'Du besitzt noch geteilte Immobilien. Übertrage zuerst die Eigentümerschaft oder entferne deren Freigaben.',
        );
      await audit(client, row.id, row.id, 'account.deleted');
      await client.query('DELETE FROM users WHERE id=$1', [row.id]);
      // Cascades delete DB-backed files, owned properties, memberships, sessions and tokens immediately.
    });
    return { message: 'Konto und eigene Inhalte gelöscht.' };
  });
  app.post('/properties/:id/transfer', { preHandler: identity, config: limited }, async (req) => {
    const id = z.uuid().parse((req.params as { id: string }).id);
    const input = transferOwnerInputSchema.parse(req.body);
    await tx(async (client) => {
      await reauth(client, req, input);
      const recipient = await client.query(
        "SELECT id FROM users WHERE id=$1 AND status='active' FOR UPDATE",
        [input.userId],
      );
      if (!recipient.rowCount) fail(400, 'Empfängerkonto nicht verfügbar.');
      const property = (await client.query('SELECT * FROM properties WHERE id=$1 FOR UPDATE', [id]))
        .rows[0];
      if (!property || property.owner_id !== req.user!.id) fail(404, 'Eintrag nicht gefunden.');
      const member = await client.query(
        "SELECT m.user_id FROM property_members m JOIN users u ON u.id=m.user_id WHERE m.property_id=$1 AND m.user_id=$2 AND m.role='editor' AND u.status='active'",
        [id, input.userId],
      );
      if (!member.rowCount)
        fail(400, 'Nur ein aktiver Mitwirkender mit Bearbeitungsrechten kann übernehmen.');
      const running = await client.query(
        "SELECT 1 FROM analysis_jobs WHERE property_id=$1 AND status IN ('queued','running')",
        [id],
      );
      if (running.rowCount) fail(409, 'Zuerst die laufende Recherche beenden.');
      await client.query('DELETE FROM property_members WHERE property_id=$1 AND user_id=$2', [
        id,
        input.userId,
      ]);
      await client.query('UPDATE properties SET owner_id=$2,updated_at=now() WHERE id=$1', [
        id,
        input.userId,
      ]);
      await client.query(
        "INSERT INTO property_members(property_id,user_id,role) VALUES($1,$2,'editor')",
        [id, req.user!.id],
      );
      await client.query('DELETE FROM property_invitations WHERE property_id=$1', [id]);
      await audit(client, req.user!.id, input.userId, 'property.transferred');
    });
    return { message: 'Eigentümerschaft übertragen. Du behältst Bearbeitungsrechte.' };
  });
  async function protectLastAdmin(client: pg.PoolClient, row: Record<string, any>, action: string) {
    if (row.role === 'admin' && row.status === 'active' && action !== 'restore') {
      const result = await client.query(
        "SELECT count(*)::int AS count FROM users WHERE role='admin' AND status='active'",
      );
      if (result.rows[0].count <= 1)
        fail(409, 'Der letzte aktive Administrator kann nicht entfernt oder gesperrt werden.');
    }
  }
  app.get('/admin/overview', { preHandler: staff }, async () => {
    const result = await pool.query(
      "SELECT count(*)::int AS users,count(*) FILTER(WHERE status='suspended')::int AS suspended,count(*) FILTER(WHERE email_verified_at IS NULL)::int AS unverified FROM users",
    );
    const invitations = await pool.query(
      'SELECT count(*)::int AS count FROM beta_invitations WHERE accepted_at IS NULL AND revoked_at IS NULL AND expires_at>now()',
    );
    return {
      ...result.rows[0],
      invitations: invitations.rows[0].count,
      registration: await mode(),
      mailEnabled: !!runtime.mail,
    };
  });
  app.get('/admin/users', { preHandler: staff }, async (req) => {
    const input = adminUserQuerySchema.parse(req.query);
    const where =
      "WHERE ($1='' OR strpos(lower(u.email),lower($1))>0 OR strpos(lower(u.name),lower($1))>0) AND ($2::text IS NULL OR u.status=$2) AND ($3::text IS NULL OR (u.email_verified_at IS NOT NULL)=($3='yes'))";
    const values = [input.query, input.status ?? null, input.verified ?? null];
    const count = await pool.query(`SELECT count(*)::int AS total FROM users u ${where}`, values);
    const result = await pool.query(
      `SELECT u.*,(SELECT count(*)::int FROM properties p WHERE p.owner_id=u.id) AS properties,(SELECT count(*)::int FROM property_members m WHERE m.user_id=u.id) AS shared,(SELECT count(*)::int FROM sessions s WHERE s.user_id=u.id AND s.expires_at>now()) AS sessions FROM users u ${where} ORDER BY u.created_at DESC,u.id LIMIT 25 OFFSET $4`,
      [...values, (input.page - 1) * 25],
    );
    return {
      users: result.rows.map((u) => ({
        ...publicAccount(u),
        properties: u.properties,
        shared: u.shared,
        sessions: u.sessions,
      })),
      total: count.rows[0].total,
      page: input.page,
    };
  });
  app.post('/admin/users/:id/action', { preHandler: staff, config: limited }, async (req) => {
    const id = z.uuid().parse((req.params as { id: string }).id);
    const input = adminActionInputSchema.parse(req.body);
    if (
      req.user!.role !== 'admin' &&
      !['revoke-sessions', 'resend-verification', 'reset-password'].includes(input.action)
    )
      fail(403, 'Nur Administratoren dürfen diese Aktion ausführen.');
    const mailTarget = await tx(async (client) => {
      await client.query('SELECT pg_advisory_xact_lock(428716026)');
      const actor = await reauth(client, req, input);
      if (!['admin', 'support'].includes(actor.role)) fail(403, 'Keine Verwaltungsberechtigung.');
      if (
        actor.role !== 'admin' &&
        !['revoke-sessions', 'resend-verification', 'reset-password'].includes(input.action)
      )
        fail(403, 'Keine Verwaltungsberechtigung.');
      const row = (await client.query('SELECT * FROM users WHERE id=$1 FOR UPDATE', [id])).rows[0];
      if (!row) fail(404, 'Konto nicht gefunden.');
      if (actor.role === 'support' && row.role !== 'user')
        fail(403, 'Support darf keine Verwaltungskonten ändern.');
      if (
        input.action === 'suspend' ||
        input.action === 'delete' ||
        (input.action === 'role' && input.role !== 'admin')
      )
        await protectLastAdmin(client, row, input.action);
      if (input.action === 'role' && !input.role) fail(400, 'Rolle fehlt.');
      if (input.action === 'role')
        await client.query('UPDATE users SET role=$2,auth_version=auth_version+1 WHERE id=$1', [
          id,
          input.role,
        ]);
      if (['suspend', 'restore'].includes(input.action))
        await client.query('UPDATE users SET status=$2,auth_version=auth_version+1 WHERE id=$1', [
          id,
          input.action === 'suspend' ? 'suspended' : 'active',
        ]);
      if (['suspend', 'revoke-sessions', 'role', 'delete'].includes(input.action)) {
        await client.query('UPDATE users SET auth_version=auth_version+1 WHERE id=$1', [id]);
        await client.query('DELETE FROM sessions WHERE user_id=$1', [id]);
      }
      if (['suspend', 'delete'].includes(input.action))
        await client.query('DELETE FROM account_tokens WHERE user_id=$1', [id]);
      if (input.action === 'delete') {
        if (input.confirmation !== 'KONTO LÖSCHEN')
          fail(400, 'Löschung mit KONTO LÖSCHEN bestätigen.');
        // Admin may only delete accounts without owned content; content erasure stays an explicit owner operation.
        const owned = await client.query('SELECT 1 FROM properties WHERE owner_id=$1 LIMIT 1', [
          id,
        ]);
        if (owned.rowCount)
          fail(
            409,
            'Konto besitzt Immobilien. Zuerst durch den Nutzer exportieren und löschen oder übertragen lassen.',
          );
      }
      await audit(
        client,
        actor.id,
        id,
        `admin.${input.action}`,
        input.reason,
        input.action === 'role' ? { role: input.role } : {},
      );
      if (input.action === 'delete') await client.query('DELETE FROM users WHERE id=$1', [id]);
      return row;
    });
    if (input.action === 'resend-verification' && !mailTarget.email_verified_at)
      await issue(id, mailTarget.email, 'verify');
    if (input.action === 'reset-password') await issue(id, mailTarget.email, 'reset');
    return { message: 'Aktion ausgeführt.' };
  });
  app.get('/admin/invitations', { preHandler: staff }, async () => {
    const { rows } = await pool.query(
      'SELECT id,email,created_at,expires_at,accepted_at,revoked_at FROM beta_invitations ORDER BY created_at DESC LIMIT 100',
    );
    return rows.map((r) => ({
      id: r.id,
      email: r.email,
      createdAt: iso(r.created_at),
      expiresAt: iso(r.expires_at),
      acceptedAt: iso(r.accepted_at),
      revokedAt: iso(r.revoked_at),
    }));
  });
  app.post('/admin/invitations', { preHandler: admin, config: limited }, async (req) => {
    const input = betaInvitationInputSchema.parse(req.body);
    return tx(async (client) => {
      await reauthAdmin(client, req, input);
      const token = newToken(),
        id = randomUUID();
      const expiresAt = new Date(Date.now() + input.days * 86400000).toISOString();
      await client.query(
        'INSERT INTO beta_invitations(id,token_hash,email,created_by,expires_at) VALUES($1,$2,$3,$4,$5)',
        [id, tokenHash(token), input.email ?? null, req.user!.id, expiresAt],
      );
      await audit(client, req.user!.id, null, 'beta.invited');
      return { id, code: token, expiresAt, email: input.email ?? null };
    });
  });
  app.delete('/admin/invitations/:id', { preHandler: admin }, async (req, reply) => {
    const id = z.uuid().parse((req.params as { id: string }).id);
    await tx(async (client) => {
      const actor = await lockedUser(client, req.user!.id);
      if (actor.role !== 'admin') fail(403, 'Keine Verwaltungsberechtigung.');
      await client.query(
        'UPDATE beta_invitations SET revoked_at=now() WHERE id=$1 AND accepted_at IS NULL',
        [id],
      );
      await audit(client, req.user!.id, null, 'beta.invitation-revoked');
    });
    return reply.code(204).send();
  });
  app.patch('/admin/registration', { preHandler: admin, config: limited }, async (req) => {
    const input = registrationModeInputSchema.parse(req.body);
    if (runtime.registration)
      fail(409, 'Der Registrierungsmodus wird durch die Deployment-Konfiguration festgelegt.');
    if (input.mode === 'open' && (!runtime.mail || !runtime.verificationRequired))
      fail(
        409,
        'Öffentliche Registrierung benötigt Mailversand und verpflichtende E-Mail-Bestätigung.',
      );
    await tx(async (client) => {
      await reauthAdmin(client, req, input);
      await client.query('UPDATE account_settings SET registration=$1', [input.mode]);
      await audit(client, req.user!.id, null, 'registration.changed', input.reason, {
        mode: input.mode,
      });
    });
    return { message: 'Registrierungsmodus geändert.' };
  });
  app.get('/admin/audit', { preHandler: admin }, async (req) => {
    const { page } = auditQuerySchema.parse(req.query);
    const result = await pool.query(
      'SELECT * FROM account_audit ORDER BY created_at DESC,id LIMIT 50 OFFSET $1',
      [(page - 1) * 50],
    );
    return result.rows.map((r) => ({
      id: r.id,
      actorId: r.actor_id,
      targetId: r.target_id,
      action: r.action,
      reason: r.reason,
      metadata: r.metadata,
      createdAt: iso(r.created_at),
    }));
  });
  return {
    runtime,
    async register(req: FastifyRequest) {
      const input = registerSchema.parse(req.body),
        registration = await mode();
      const row = await tx(async (client) => {
        const invite = input.invitation
          ? (
              await client.query('SELECT * FROM beta_invitations WHERE token_hash=$1 FOR UPDATE', [
                tokenHash(input.invitation),
              ])
            ).rows[0]
          : null;
        if (
          registration === 'invite' &&
          (!invite ||
            invite.revoked_at ||
            invite.accepted_at ||
            invite.expires_at.getTime() <= Date.now() ||
            (invite.email && invite.email !== input.email))
        )
          fail(400, 'Gültige Einladung für diese E-Mail-Adresse erforderlich.');
        const result = await client.query(
          'INSERT INTO users(id,email,name,password_hash) VALUES($1,$2,$3,$4) RETURNING *',
          [randomUUID(), input.email, input.name, await hashPassword(input.password)],
        );
        if (registration === 'invite')
          await client.query('UPDATE beta_invitations SET accepted_at=now() WHERE id=$1', [
            invite.id,
          ]);
        await audit(client, result.rows[0].id, result.rows[0].id, 'account.registered');
        return result.rows[0];
      });
      if (runtime.mail) {
        try {
          await issue(row.id, row.email, 'verify');
        } catch {
          /* Account exists; explicit resend is available in settings. */
        }
      }
      return { user: sessionUser(row), version: row.auth_version as number };
    },
    async authenticate(email: string, password: string, code: string, dummy: string) {
      return tx(async (client) => {
        const { rows } = await client.query('SELECT * FROM users WHERE email=$1 FOR UPDATE', [
          email,
        ]);
        const row = rows[0];
        if (
          !(await verifyPassword(password, row?.password_hash ?? dummy)) ||
          !row ||
          row.status !== 'active'
        )
          fail(401, 'E-Mail oder Passwort falsch.');
        if (row.mfa_secret && !(await consumeMfa(client, row, code)))
          fail(401, 'Zwei-Faktor-Code erforderlich oder ungültig.');
        await client.query('UPDATE users SET last_login_at=now() WHERE id=$1', [row.id]);
        await audit(client, row.id, row.id, 'account.login');
        return { user: sessionUser(row), version: row.auth_version as number };
      });
    },
  };
}
