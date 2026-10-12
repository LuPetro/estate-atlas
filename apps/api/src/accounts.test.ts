import { beforeAll, afterAll, beforeEach, afterEach, describe, it, expect } from 'vitest';
import EmbeddedPostgres from 'embedded-postgres';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import { database, migrate } from './database';
import { createApp } from './app';
import { newToken, tokenHash } from './auth';
import { base32, totp, encryptSecret, decryptSecret, checkTotp } from './account-security';
import type { AccountMail } from './account-runtime';
import { sampleProperties } from '@estate-atlas/shared';
let pool: pg.Pool, server: EmbeddedPostgres, app: FastifyInstance;
const password = 'Correct horse battery staple 42',
  key = randomBytes(32),
  secret = base32(Buffer.from('12345678901234567890'));
let ownerId: string, adminId: string, supportId: string, otherId: string;
let owner: Record<string, string>,
  admin: Record<string, string>,
  support: Record<string, string>,
  other: Record<string, string>;
const mails: AccountMail[] = [];
const runtime = {
  publicUrl: 'http://localhost:3000',
  verificationRequired: false,
  encryptionKey: key,
  mail: async (mail: AccountMail) => {
    mails.push(mail);
  },
};
const payload = (email: string) => ({ email, password, name: 'Synthetic account test' });
const security = () => ({ password, code: totp(secret, Math.floor(Date.now() / 30000)) });
const call = (
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  url: string,
  headers = owner,
  data?: unknown,
) => app.inject({ method, url, headers, payload: data as any });
beforeAll(async () => {
  const root = resolve('.local');
  mkdirSync(root, { recursive: true });
  const dbPassword = randomBytes(24).toString('hex');
  server = new EmbeddedPostgres({
    databaseDir: resolve(root, `accounts-test-postgres-${process.pid}`),
    user: 'account_test',
    password: dbPassword,
    port: 55436,
    persistent: false,
    authMethod: 'scram-sha-256',
    createPostgresUser: false,
    postgresFlags: ['-h', '127.0.0.1', '-k', root],
    onLog: () => {},
    onError: () => {},
  });
  await server.initialise();
  await server.start();
  await server.createDatabase('accounts');
  pool = database(`postgresql://account_test:${dbPassword}@127.0.0.1:55436/accounts`);
  pool.on('error', () => {});
  await migrate(pool);
  await migrate(pool);
  app = await createApp(pool, { accounts: runtime });
  const fixtures = [];
  for (const email of [
    'account-owner@example.test',
    'account-admin@example.test',
    'account-support@example.test',
    'account-other@example.test',
  ]) {
    const r = await app.inject({ method: 'POST', url: '/auth/register', payload: payload(email) });
    expect(r.statusCode).toBe(201);
    fixtures.push(r.json());
  }
  [ownerId, adminId, supportId, otherId] = fixtures.map((r) => r.user.id);
  [owner, admin, support, other] = fixtures.map((r) => ({ authorization: `Bearer ${r.token}` }));
  for (const [id, role] of [
    [adminId, 'admin'],
    [supportId, 'support'],
  ]) {
    const recovery = newToken();
    await pool.query('UPDATE users SET role=$2,mfa_secret=$3,recovery_hashes=$4 WHERE id=$1', [
      id,
      role,
      encryptSecret(secret, key),
      JSON.stringify([tokenHash(recovery)]),
    ]);
    const r = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: {
        ...payload(
          role === 'admin' ? 'account-admin@example.test' : 'account-support@example.test',
        ),
        name: undefined,
        code: recovery,
      },
    });
    expect(r.statusCode).toBe(200);
    if (role === 'admin') admin = { authorization: `Bearer ${r.json().token}` };
    else support = { authorization: `Bearer ${r.json().token}` };
  }
  await app.close();
}, 60000);
beforeEach(async () => {
  mails.length = 0;
  app = await createApp(pool, { accounts: runtime });
});
afterEach(async () => {
  await app.close();
});
afterAll(async () => {
  await pool?.end();
  await server?.stop();
});
describe('account lifecycle and platform administration on real PostgreSQL', () => {
  it('implements RFC 6238 TOTP vectors, rejects replay and authenticates encrypted secrets', () => {
    expect(totp(secret, 1)).toBe('287082');
    expect(totp(secret, Math.floor(1111111109 / 30))).toBe('081804');
    expect(checkTotp(secret, '287082', -1, 59000)).toBe(1);
    expect(checkTotp(secret, '287082', 1, 59000)).toBeNull();
    const encrypted = encryptSecret(secret, key);
    expect(decryptSecret(encrypted, key)).toBe(secret);
    expect(() => decryptSecret(encrypted, randomBytes(32))).toThrow();
  });
  it('rejects anonymous account and every admin route', async () => {
    for (const path of [
      '/account',
      '/account/sessions',
      '/admin/overview',
      '/admin/users',
      '/admin/invitations',
      '/admin/audit',
    ])
      expect((await call('GET', path, {})).statusCode).toBe(401);
  });
  it('keeps platform roles independent of property access and prevents role injection', async () => {
    expect((await call('GET', '/admin/users', owner)).statusCode).toBe(403);
    expect(
      (
        await call(
          'POST',
          '/auth/register',
          {},
          { ...payload('injection@example.test'), role: 'admin' },
        )
      ).statusCode,
    ).toBe(400);
  });
  it('requires MFA for staff even with a valid ordinary session', async () => {
    const token = newToken();
    await pool.query(
      "INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '1 day')",
      [tokenHash(token), adminId],
    );
    expect(
      (await call('GET', '/admin/overview', { authorization: `Bearer ${token}` })).statusCode,
    ).toBe(403);
  });
  it('returns only account metadata to administrators and restricts support', async () => {
    const r = await call('GET', '/admin/users?query=account-owner', admin);
    expect(r.statusCode).toBe(200);
    expect(r.json().users[0]).toMatchObject({ id: ownerId, properties: 0 });
    for (const secretField of ['password_hash', 'mfa_secret', 'token_hash', 'recovery_hashes'])
      expect(r.body).not.toContain(secretField);
    expect((await call('GET', '/admin/audit', support)).statusCode).toBe(403);
    expect(
      (
        await call('POST', `/admin/users/${ownerId}/action`, support, {
          ...security(),
          action: 'suspend',
          reason: 'Synthetic support test',
        })
      ).statusCode,
    ).toBe(403);
  });
  it('shows only own sessions and cannot revoke another users session', async () => {
    const list = (await call('GET', '/account/sessions', other)).json();
    expect(list[0].current).toBe(true);
    expect((await call('DELETE', `/account/sessions/${list[0].id}`, owner)).statusCode).toBe(204);
    expect((await call('GET', '/auth/me', other)).statusCode).toBe(200);
    expect(JSON.stringify(list)).not.toContain('token_hash');
  });
  it('updates the profile without allowing changes to roles or status', async () => {
    expect(
      (await call('PATCH', '/account/profile', owner, { name: 'Updated test name' })).json().name,
    ).toBe('Updated test name');
    expect(
      (await call('PATCH', '/account/profile', owner, { name: 'Updated', role: 'admin' }))
        .statusCode,
    ).toBe(400);
  });
  it('uses generic reset responses and stores only hashed, expiring tokens', async () => {
    const known = await call(
      'POST',
      '/auth/forgot-password',
      {},
      { email: 'account-owner@example.test' },
    );
    const unknown = await call(
      'POST',
      '/auth/forgot-password',
      {},
      { email: 'absent@example.test' },
    );
    expect(known.json()).toEqual(unknown.json());
    expect(mails).toHaveLength(1);
    const token = mails[0].token!;
    const row = (
      await pool.query('SELECT * FROM account_tokens WHERE token_hash=$1', [tokenHash(token)])
    ).rows[0];
    expect(row).toBeTruthy();
    expect(JSON.stringify(row)).not.toContain(token);
    expect(row.expires_at.getTime() - Date.now()).toBeLessThanOrEqual(30 * 60000);
  });
  it('rejects expired tokens and enforces single-use verification', async () => {
    await call('POST', '/account/resend-verification', owner, {});
    const token = mails[0].token!;
    expect((await call('POST', '/auth/verify-email', {}, { token })).statusCode).toBe(200);
    expect((await call('POST', '/auth/verify-email', {}, { token })).statusCode).toBe(400);
    await call('POST', '/auth/forgot-password', {}, { email: 'account-owner@example.test' });
    const reset = mails.at(-1)!.token!;
    await pool.query(
      "UPDATE account_tokens SET expires_at=now()-interval '1 second' WHERE token_hash=$1",
      [tokenHash(reset)],
    );
    expect(
      (await call('POST', '/auth/reset-password', {}, { token: reset, password })).statusCode,
    ).toBe(400);
  });
  it('preserves the old email until a new address is verified and then revokes sessions', async () => {
    const r = await call('POST', '/auth/register', {}, payload('email-before@example.test'));
    const h = { authorization: `Bearer ${r.json().token}` };
    expect(
      (
        await call('POST', '/account/email', h, {
          password,
          code: '',
          email: 'email-after@example.test',
        })
      ).statusCode,
    ).toBe(200);
    expect((await call('GET', '/account', h)).json().email).toBe('email-before@example.test');
    const token = mails.find((m) => m.purpose === 'email')!.token!;
    expect((await call('POST', '/auth/verify-email', {}, { token })).statusCode).toBe(200);
    expect((await call('GET', '/account', h)).statusCode).toBe(401);
    const login = await call(
      'POST',
      '/auth/login',
      {},
      { email: 'email-after@example.test', password },
    );
    expect(login.statusCode).toBe(200);
    expect((await call('POST', '/auth/verify-email', {}, { token })).statusCode).toBe(400);
    expect(mails.some((m) => m.purpose === 'notice' && m.to === 'email-before@example.test')).toBe(
      true,
    );
  });
  it('password reset revokes all sessions while preserving MFA', async () => {
    const r = await call('POST', '/auth/register', {}, payload('reset-new@example.test'));
    const h = { authorization: `Bearer ${r.json().token}` };
    const id = r.json().user.id;
    await pool.query('UPDATE users SET mfa_secret=$2 WHERE id=$1', [
      id,
      encryptSecret(secret, key),
    ]);
    await call('POST', '/auth/forgot-password', {}, { email: 'reset-new@example.test' });
    const token = mails.find((m) => m.purpose === 'reset')!.token!;
    expect(
      (
        await call(
          'POST',
          '/auth/reset-password',
          {},
          { token, password: 'A completely different password 567' },
        )
      ).statusCode,
    ).toBe(200);
    expect((await call('GET', '/auth/me', h)).statusCode).toBe(401);
    expect(
      (
        await call(
          'POST',
          '/auth/login',
          {},
          { email: 'reset-new@example.test', password: 'A completely different password 567' },
        )
      ).statusCode,
    ).toBe(401);
    expect((await call('POST', '/auth/reset-password', {}, { token, password })).statusCode).toBe(
      400,
    );
  });
  it('enrolls MFA, generates hashed recovery codes and consumes each recovery code once', async () => {
    const r = await call('POST', '/auth/register', {}, payload('mfa-new@example.test'));
    const h = { authorization: `Bearer ${r.json().token}` };
    const setup = (await call('POST', '/account/mfa/setup', h, { password, code: '' })).json();
    expect(setup.uri).toContain('otpauth://');
    const confirm = await call('POST', '/account/mfa/confirm', h, {
      code: totp(setup.secret, Math.floor(Date.now() / 30000)),
    });
    expect(confirm.statusCode).toBe(200);
    const recovery = confirm.json().recoveryCodes[0];
    const row = (await pool.query('SELECT * FROM users WHERE id=$1', [r.json().user.id])).rows[0];
    expect(row.mfa_secret).not.toContain(setup.secret);
    expect(JSON.stringify(row.recovery_hashes)).not.toContain(recovery);
    expect(
      (
        await call(
          'POST',
          '/auth/login',
          {},
          { email: 'mfa-new@example.test', password, code: recovery },
        )
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await call(
          'POST',
          '/auth/login',
          {},
          { email: 'mfa-new@example.test', password, code: recovery },
        )
      ).statusCode,
    ).toBe(401);
  });
  it('rotates an authenticator only after password and current MFA confirmation', async () => {
    const registered = await call('POST', '/auth/register', {}, payload('rotate-mfa@example.test'));
    const headers = { authorization: `Bearer ${registered.json().token}` };
    const first = (
      await call('POST', '/account/mfa/setup', headers, { password, code: '' })
    ).json();
    await call('POST', '/account/mfa/confirm', headers, {
      code: totp(first.secret, Math.floor(Date.now() / 30000)),
    });
    expect(
      (await call('POST', '/account/mfa/setup', headers, { password, code: '' })).statusCode,
    ).toBe(401);
    const second = (
      await call('POST', '/account/mfa/setup', headers, {
        password,
        code: totp(first.secret, Math.floor(Date.now() / 30000)),
      })
    ).json();
    const before = (
      await pool.query('SELECT mfa_secret FROM users WHERE id=$1', [registered.json().user.id])
    ).rows[0];
    expect(decryptSecret(before.mfa_secret, key)).toBe(first.secret);
    expect(
      (
        await call('POST', '/account/mfa/confirm', headers, {
          code: totp(second.secret, Math.floor(Date.now() / 30000)),
        })
      ).statusCode,
    ).toBe(200);
    const after = (
      await pool.query('SELECT mfa_secret FROM users WHERE id=$1', [registered.json().user.id])
    ).rows[0];
    expect(decryptSecret(after.mfa_secret, key)).toBe(second.secret);
    expect((await call('POST', '/account/mfa/disable', admin, security())).statusCode).toBe(409);
  });
  it('cannot create a fresh old-password session concurrently with logout everywhere', async () => {
    const registered = await call(
      'POST',
      '/auth/register',
      {},
      payload('session-race@example.test'),
    );
    const headers = { authorization: `Bearer ${registered.json().token}` };
    const original = pool.query.bind(pool);
    let release!: () => void, arrived!: () => void;
    const barrier = new Promise<void>((resolve) => {
      release = resolve;
    });
    const inserting = new Promise<void>((resolve) => {
      arrived = resolve;
    });
    let once = true;
    (pool as any).query = async (...args: any[]) => {
      if (once && String(args[0]).startsWith('INSERT INTO sessions')) {
        once = false;
        arrived();
        await barrier;
      }
      return (original as any)(...args);
    };
    try {
      const login = call(
        'POST',
        '/auth/login',
        {},
        { email: 'session-race@example.test', password },
      );
      await inserting;
      expect(
        (await call('POST', '/account/logout-all', headers, { password, code: '' })).statusCode,
      ).toBe(200);
      release();
      expect((await login).statusCode).toBe(401);
    } finally {
      release();
      pool.query = original;
    }
  });
  it('protects the last active admin against suspension, downgrade and self-deletion', async () => {
    for (const action of ['suspend', 'role', 'delete'])
      expect(
        (
          await call('POST', `/admin/users/${adminId}/action`, admin, {
            ...security(),
            action,
            role: 'user',
            reason: 'Last administrator test',
          })
        ).statusCode,
      ).toBe(409);
    expect(
      (
        await call('POST', '/account/delete', admin, {
          ...security(),
          confirmation: 'KONTO LÖSCHEN',
        })
      ).statusCode,
    ).toBe(409);
  });
  it('suspends accounts, rejects existing sessions and login, and does not resurrect sessions when restored', async () => {
    const r = await call('POST', '/auth/register', {}, payload('suspend-new@example.test')),
      id = r.json().user.id,
      h = { authorization: `Bearer ${r.json().token}` };
    expect(
      (
        await call('POST', `/admin/users/${id}/action`, admin, {
          ...security(),
          action: 'suspend',
          reason: 'Suspension integration test',
        })
      ).statusCode,
    ).toBe(200);
    expect((await call('GET', '/properties', h)).statusCode).toBe(401);
    expect(
      (await call('POST', '/auth/login', {}, { email: 'suspend-new@example.test', password }))
        .statusCode,
    ).toBe(401);
    expect(
      (
        await call('POST', `/admin/users/${id}/action`, admin, {
          ...security(),
          action: 'restore',
          reason: 'Restore integration test',
        })
      ).statusCode,
    ).toBe(200);
    expect((await call('GET', '/auth/me', h)).statusCode).toBe(401);
    expect(
      (await call('POST', '/auth/login', {}, { email: 'suspend-new@example.test', password }))
        .statusCode,
    ).toBe(200);
  });
  it('creates bound single-use beta invitations and rejects revoked, expired and wrong-email invitations', async () => {
    const created = await call('POST', '/admin/invitations', admin, {
      ...security(),
      email: 'invited@example.test',
      days: 1,
    });
    expect(created.statusCode).toBe(200);
    const { code, id } = created.json();
    await app.close();
    app = await createApp(pool, { accounts: { ...runtime, registration: 'invite' } });
    expect(
      (await call('POST', '/auth/register', {}, payload('no-invite@example.test'))).statusCode,
    ).toBe(400);
    expect(
      (
        await call(
          'POST',
          '/auth/register',
          {},
          { ...payload('wrong@example.test'), invitation: code },
        )
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await call(
          'POST',
          '/auth/register',
          {},
          { ...payload('invited@example.test'), invitation: code },
        )
      ).statusCode,
    ).toBe(201);
    expect(
      (
        await call(
          'POST',
          '/auth/register',
          {},
          { ...payload('invited@example.test'), invitation: code },
        )
      ).statusCode,
    ).toBe(400);
    expect(
      (await pool.query('SELECT accepted_at FROM beta_invitations WHERE id=$1', [id])).rows[0]
        .accepted_at,
    ).toBeTruthy();
    const revoked = (
      await call('POST', '/admin/invitations', admin, { ...security(), days: 1 })
    ).json();
    await call('DELETE', `/admin/invitations/${revoked.id}`, admin);
    expect(
      (
        await call(
          'POST',
          '/auth/register',
          {},
          { ...payload('revoked@example.test'), invitation: revoked.code },
        )
      ).statusCode,
    ).toBe(400);
    const expired = (
      await call('POST', '/admin/invitations', admin, { ...security(), days: 1 })
    ).json();
    await pool.query(
      "UPDATE beta_invitations SET expires_at=now()-interval '1 second' WHERE id=$1",
      [expired.id],
    );
    expect(
      (
        await call(
          'POST',
          '/auth/register',
          {},
          { ...payload('expired@example.test'), invitation: expired.code },
        )
      ).statusCode,
    ).toBe(400);
  });
  it('refuses public signup settings without mandatory verification', async () => {
    expect(
      (
        await call('PATCH', '/admin/registration', admin, {
          ...security(),
          mode: 'open',
          reason: 'Public launch without verification',
        })
      ).statusCode,
    ).toBe(409);
  });
  it('requires email verification on portfolio routes when configured while keeping account settings accessible', async () => {
    await app.close();
    app = await createApp(pool, { accounts: { ...runtime, verificationRequired: true } });
    expect((await call('GET', '/properties', other)).statusCode).toBe(403);
    expect((await call('GET', '/account', other)).statusCode).toBe(200);
  });
  it('exports owned data and files without credentials or another users shared content', async () => {
    const created = (await call('POST', '/properties', owner, sampleProperties[0])).json();
    await pool.query(
      "INSERT INTO assets(id,property_id,name,mime_type,size,content) VALUES($1,$2,'export-test.pdf','application/pdf',4,$3)",
      [randomUUID(), created.id, Buffer.from('test')],
    );
    const exportResult = await call('POST', '/account/export', owner, { password, code: '' });
    expect(exportResult.statusCode).toBe(200);
    expect(exportResult.json().assets[0].contentBase64).toBe(
      Buffer.from('test').toString('base64'),
    );
    expect(exportResult.json().properties[0].id).toBe(created.id);
    for (const secretField of ['password_hash', 'token_hash', 'mfa_secret', 'recovery_hashes'])
      expect(exportResult.body).not.toContain(secretField);
    expect(
      (await call('POST', '/account/export', other, { password, code: '' })).json().properties,
    ).toEqual([]);
  });
  it('blocks deletion of shared ownership, transfers only to an active editor, and preserves transferred content', async () => {
    const registered = await call(
      'POST',
      '/auth/register',
      {},
      payload('delete-transfer@example.test'),
    );
    const h = { authorization: `Bearer ${registered.json().token}` },
      id = registered.json().user.id;
    const property = (await call('POST', '/properties', h, sampleProperties[0])).json();
    await pool.query(
      "INSERT INTO property_members(property_id,user_id,role) VALUES($1,$2,'viewer')",
      [property.id, otherId],
    );
    expect(
      (
        await call('POST', '/account/delete', h, {
          password,
          code: '',
          confirmation: 'KONTO LÖSCHEN',
        })
      ).statusCode,
    ).toBe(409);
    expect(
      (
        await call('POST', `/properties/${property.id}/transfer`, h, {
          password,
          code: '',
          userId: otherId,
        })
      ).statusCode,
    ).toBe(400);
    await pool.query("UPDATE property_members SET role='editor' WHERE property_id=$1", [
      property.id,
    ]);
    expect(
      (
        await call('POST', `/properties/${property.id}/transfer`, h, {
          password,
          code: '',
          userId: otherId,
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await call('POST', '/account/delete', h, {
          password,
          code: '',
          confirmation: 'KONTO LÖSCHEN',
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (await pool.query('SELECT owner_id FROM properties WHERE id=$1', [property.id])).rows[0]
        .owner_id,
    ).toBe(otherId);
    expect((await pool.query('SELECT 1 FROM users WHERE id=$1', [id])).rowCount).toBe(0);
    expect((await call('GET', `/properties/${property.id}`, other)).statusCode).toBe(200);
  });
  it('permanently deletes owned files and sessions while leaving another owners property intact', async () => {
    const r = await call('POST', '/auth/register', {}, payload('erase-owned@example.test'));
    const id = r.json().user.id,
      headers = { authorization: `Bearer ${r.json().token}` };
    const property = (await call('POST', '/properties', headers, sampleProperties[0])).json();
    const assetId = randomUUID();
    await pool.query(
      "INSERT INTO assets(id,property_id,name,mime_type,size,content) VALUES($1,$2,'erase-test.pdf','application/pdf',4,$3)",
      [assetId, property.id, Buffer.from('test')],
    );
    const foreign = (
      await pool.query('SELECT id FROM properties WHERE owner_id=$1 LIMIT 1', [ownerId])
    ).rows[0].id;
    await pool.query(
      "INSERT INTO property_members(property_id,user_id,role) VALUES($1,$2,'viewer')",
      [foreign, id],
    );
    expect(
      (
        await call('POST', '/account/delete', headers, {
          password,
          code: '',
          confirmation: 'KONTO LÖSCHEN',
        })
      ).statusCode,
    ).toBe(200);
    for (const [table, column, value] of [
      ['users', 'id', id],
      ['sessions', 'user_id', id],
      ['account_tokens', 'user_id', id],
      ['properties', 'id', property.id],
      ['assets', 'id', assetId],
      ['property_members', 'user_id', id],
    ])
      expect(
        (await pool.query(`SELECT 1 FROM ${table} WHERE ${column}=$1`, [value])).rowCount,
      ).toBe(0);
    expect((await pool.query('SELECT 1 FROM properties WHERE id=$1', [foreign])).rowCount).toBe(1);
    expect((await call('GET', '/auth/me', headers)).statusCode).toBe(401);
  });
  it('requires explicit admin deletion confirmation and refuses admin erasure of owned content', async () => {
    const r = await call('POST', '/auth/register', {}, payload('admin-delete-empty@example.test'));
    const id = r.json().user.id;
    const input = { ...security(), action: 'delete', reason: 'Synthetic admin deletion test' };
    expect((await call('POST', `/admin/users/${id}/action`, admin, input)).statusCode).toBe(400);
    expect(
      (
        await call('POST', `/admin/users/${ownerId}/action`, admin, {
          ...input,
          confirmation: 'KONTO LÖSCHEN',
        })
      ).statusCode,
    ).toBe(409);
    expect(
      (
        await call('POST', `/admin/users/${id}/action`, admin, {
          ...input,
          confirmation: 'KONTO LÖSCHEN',
        })
      ).statusCode,
    ).toBe(200);
    expect((await pool.query('SELECT 1 FROM users WHERE id=$1', [id])).rowCount).toBe(0);
  });
  it('records administration with actor, target and reason without tokens', async () => {
    const events = (await call('GET', '/admin/audit', admin)).json();
    expect(
      events.some(
        (e: any) =>
          e.action === 'admin.suspend' &&
          e.actorId === adminId &&
          e.reason === 'Suspension integration test',
      ),
    ).toBe(true);
    for (const event of events) {
      expect(event.metadata).not.toHaveProperty('password');
      expect(event.metadata).not.toHaveProperty('code');
    }
  });
});
