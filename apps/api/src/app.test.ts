import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import EmbeddedPostgres from 'embedded-postgres';
import { randomBytes } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import { createApp } from './app';
import { database, migrate } from './database';
import { sampleProperties } from '@estate-atlas/shared';
let app: FastifyInstance, pool: pg.Pool, server: EmbeddedPostgres;
let owner: { authorization: string }, other: { authorization: string };
let propertyId: string, assetId: string;
let stopping = false;
const testDatabaseError = (error: Error & { code?: string }) => {
  if (stopping && error.code === '57P01') return;
  // Never let Vitest serialize a pg Client containing temporary credentials.
  throw new Error(`Isolated test database error: ${error.code ?? 'UNKNOWN'}`);
};
const root = resolve('.local');
const password = randomBytes(24).toString('hex');
const account = (email: string) => ({
  email,
  password: 'Correct horse battery staple 42',
  name: 'Integration Test',
});
const upload = (
  id: string,
  headers: Record<string, string>,
  mime = 'image/png',
  data = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jF6cAAAAASUVORK5CYII=',
    'base64',
  ),
) => {
  const boundary = 'estateatlas-boundary';
  const payload = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="private.png"\r\nContent-Type: ${mime}\r\n\r\n`,
    ),
    data,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  return app.inject({
    method: 'POST',
    url: `/properties/${id}/assets`,
    headers: { ...headers, 'content-type': `multipart/form-data; boundary=${boundary}` },
    payload,
  });
};
beforeAll(async () => {
  mkdirSync(root, { recursive: true });
  server = new EmbeddedPostgres({
    databaseDir: resolve(root, `test-postgres-${process.pid}`),
    user: 'estateatlas_test',
    password,
    port: 55433,
    persistent: false,
    authMethod: 'scram-sha-256',
    createPostgresUser: false,
    postgresFlags: ['-h', '127.0.0.1', '-k', root],
    onLog: () => {},
    onError: () => {},
  });
  await server.initialise();
  await server.start();
  await server.createDatabase('estateatlas_test');
  pool = database(`postgresql://estateatlas_test:${password}@127.0.0.1:55433/estateatlas_test`);
  pool.on('error', testDatabaseError);
  pool.on('connect', (client) => client.on('error', testDatabaseError));
  await migrate(pool);
  await migrate(pool);
  app = await createApp(pool, {
    geocoder: async (query) => {
      if (query === 'Ausfalltest')
        throw Object.assign(new Error('Adresssuche gerade nicht erreichbar.'), { statusCode: 503 });
      if (query === 'Limitierungstest')
        throw Object.assign(new Error('Bitte erneut suchen.'), { statusCode: 429 });
      return [
        {
          label: 'Synthetische Testadresse',
          address: 'Teststraße 1, Wien',
          country: 'AT',
          latitude: 48.2082,
          longitude: 16.3738,
          precision: 'building',
        },
      ];
    },
  });
  const first = await app.inject({
    method: 'POST',
    url: '/auth/register',
    payload: account('owner@example.test'),
  });
  expect(first.statusCode).toBe(201);
  owner = { authorization: `Bearer ${first.json().token}` };
  const second = await app.inject({
    method: 'POST',
    url: '/auth/register',
    payload: account('other@example.test'),
  });
  expect(second.statusCode).toBe(201);
  other = { authorization: `Bearer ${second.json().token}` };
});
afterAll(async () => {
  stopping = true;
  await app?.close();
  await pool?.end();
  await server?.stop();
});
describe('real PostgreSQL persistence, authentication and resource authorization', () => {
  it('checks database health', async () =>
    expect((await app.inject('/health')).json().status).toBe('ok'));
  it('allows authenticated browser preflights for editing, archiving and deletion', async () => {
    for (const method of ['PUT', 'PATCH', 'DELETE']) {
      const res = await app.inject({
        method: 'OPTIONS',
        url: '/properties',
        headers: { origin: 'http://localhost:3000', 'access-control-request-method': method },
      });
      expect(res.statusCode).toBe(204);
      expect(res.headers['access-control-allow-methods']).toContain(method);
      expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000');
      expect(res.headers['access-control-allow-credentials']).toBe('true');
    }
  });
  it('rejects anonymous portfolio access', async () =>
    expect((await app.inject('/properties')).statusCode).toBe(401));
  it('protects address search and validates bounded explicit search input', async () => {
    expect(
      (await app.inject({ method: 'POST', url: '/geocoding/search', payload: { query: 'Wien' } }))
        .statusCode,
    ).toBe(401);
    for (const payload of [
      { query: 'abc' },
      { query: 'a'.repeat(301) },
      { query: 'Wien', url: 'http://127.0.0.1/' },
    ])
      expect(
        (await app.inject({ method: 'POST', url: '/geocoding/search', headers: owner, payload }))
          .statusCode,
      ).toBe(400);
    const result = await app.inject({
      method: 'POST',
      url: '/geocoding/search',
      headers: owner,
      payload: { query: 'Wien' },
    });
    expect(result.statusCode).toBe(200);
    expect(result.json()[0]).toMatchObject({
      latitude: 48.2082,
      longitude: 16.3738,
      country: 'AT',
    });
    expect(result.headers['cache-control']).toBe('no-store');
  });
  it('preserves CSRF origin checks and reports geocoder failure without blocking the portfolio', async () => {
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/geocoding/search',
          headers: { ...owner, origin: 'https://untrusted.test' },
          payload: { query: 'Wien' },
        })
      ).statusCode,
    ).toBe(403);
    const unavailable = await app.inject({
      method: 'POST',
      url: '/geocoding/search',
      headers: owner,
      payload: { query: 'Ausfalltest' },
    });
    expect(unavailable.statusCode).toBe(503);
    const limited = await app.inject({
      method: 'POST',
      url: '/geocoding/search',
      headers: owner,
      payload: { query: 'Limitierungstest' },
    });
    expect(limited.statusCode).toBe(429);
    expect(limited.headers['retry-after']).toBe('1');
    expect((await app.inject({ url: '/properties', headers: owner })).statusCode).toBe(200);
  });
  it('stores salted password hashes and only hashes session tokens', async () => {
    const users = await pool.query('SELECT password_hash FROM users');
    expect(users.rows[0].password_hash).toMatch(/^scrypt:/);
    expect(users.rows[0].password_hash).not.toBe(users.rows[1].password_hash);
    const sessions = await pool.query('SELECT token_hash FROM sessions');
    expect(sessions.rows[0].token_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(sessions.rows.map((r) => r.token_hash)).not.toContain(owner.authorization.slice(7));
  });
  it('rejects short passwords and unknown registration fields', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { ...account('bad@example.test'), password: 'short', admin: true },
    });
    expect(res.statusCode).toBe(400);
  });
  it('logs in with normalized email and hides credential mistakes', async () => {
    const good = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'OWNER@example.test', password: account('').password },
    });
    expect(good.statusCode).toBe(200);
    for (const email of ['owner@example.test', 'absent@example.test']) {
      const bad = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email, password: 'A sufficiently long wrong password' },
      });
      expect(bad.statusCode).toBe(401);
      expect(bad.json().message).toBe('E-Mail oder Passwort falsch.');
    }
  });
  it('uses HttpOnly browser sessions without returning bearer tokens', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      headers: { origin: 'http://localhost:3000' },
      payload: { email: 'owner@example.test', password: account('').password },
    });
    expect(res.json().token).toBeUndefined();
    const cookie = String(res.headers['set-cookie']);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    const me = await app.inject({ url: '/auth/me', headers: { cookie: cookie.split(';')[0] } });
    expect(me.statusCode).toBe(200);
    const csrf = await app.inject({
      method: 'POST',
      url: '/properties',
      headers: { cookie: cookie.split(';')[0] },
      payload: sampleProperties[0],
    });
    expect(csrf.statusCode).toBe(403);
  });
  it('rejects hostile origins and malformed identifiers', async () => {
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/properties',
          headers: { ...owner, origin: 'https://evil.example' },
          payload: sampleProperties[0],
        })
      ).statusCode,
    ).toBe(403);
    expect((await app.inject({ url: '/properties/not-a-uuid', headers: owner })).statusCode).toBe(
      400,
    );
  });
  it('creates a property and its initial valuation atomically', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/properties',
      headers: owner,
      payload: sampleProperties[0],
    });
    expect(res.statusCode).toBe(201);
    propertyId = res.json().id;
    const detail = await app.inject({ url: `/properties/${propertyId}`, headers: owner });
    expect(detail.json().valuations).toHaveLength(1);
    expect(detail.json().marketValue).toBe(375000);
  });
  it('does not accept client-supplied owner IDs', async () =>
    expect(
      (
        await app.inject({
          method: 'PUT',
          url: `/properties/${propertyId}`,
          headers: owner,
          payload: { ...sampleProperties[0], ownerId: 'someone' },
        })
      ).statusCode,
    ).toBe(400));
  it('keeps other portfolios empty', async () =>
    expect((await app.inject({ url: '/properties', headers: other })).json()).toEqual([]));
  it.each(['GET', 'PUT', 'PATCH', 'DELETE', 'POST'] as const)(
    'denies foreign resource access for %s',
    async (method) => {
      const suffix = method === 'PATCH' ? '/archive' : method === 'POST' ? '/analyses' : '';
      const res = await app.inject({
        method,
        url: `/properties/${propertyId}${suffix}`,
        headers: other,
        payload:
          method === 'PUT'
            ? sampleProperties[0]
            : method === 'PATCH'
              ? { archived: true }
              : undefined,
      });
      expect(res.statusCode).toBe(404);
    },
  );
  it('rejects uploading to a foreign property', async () =>
    expect((await upload(propertyId, other)).statusCode).toBe(404));
  it('persists edits and adds history only on value or currency changes', async () => {
    const input = { ...sampleProperties[0], marketValue: 410000 };
    expect(
      (
        await app.inject({
          method: 'PUT',
          url: `/properties/${propertyId}`,
          headers: owner,
          payload: input,
        })
      ).statusCode,
    ).toBe(200);
    await app.inject({
      method: 'PUT',
      url: `/properties/${propertyId}`,
      headers: owner,
      payload: { ...input, title: 'Edited apartment' },
    });
    const detail = (await app.inject({ url: `/properties/${propertyId}`, headers: owner })).json();
    expect(detail.title).toBe('Edited apartment');
    expect(detail.valuations).toHaveLength(2);
    expect(detail.valuations[1].marketValue).toBe(410000);
  });
  it('retains data across API instances', async () => {
    const another = await createApp(pool);
    try {
      const res = await another.inject({ url: `/properties/${propertyId}`, headers: owner });
      expect(res.json().marketValue).toBe(410000);
    } finally {
      await another.close();
    }
  });
  it('archives and restores properties', async () => {
    for (const archived of [true, false]) {
      const res = await app.inject({
        method: 'PATCH',
        url: `/properties/${propertyId}/archive`,
        headers: owner,
        payload: { archived },
      });
      expect(Boolean(res.json().archivedAt)).toBe(archived);
    }
  });
  it('uploads and retrieves an authenticated private image', async () => {
    const res = await upload(propertyId, owner);
    expect(res.statusCode).toBe(201);
    assetId = res.json().id;
    const image = await app.inject({ url: `/assets/${assetId}`, headers: owner });
    expect(image.statusCode).toBe(200);
    expect(image.headers['content-type']).toContain('image/png');
    expect(image.headers['cache-control']).toBe('no-store');
    expect(image.headers['x-content-type-options']).toBe('nosniff');
  });
  it('denies anonymous and foreign attachment downloads and deletion', async () => {
    expect((await app.inject(`/assets/${assetId}`)).statusCode).toBe(401);
    for (const method of ['GET', 'DELETE'] as const)
      expect(
        (await app.inject({ method, url: `/assets/${assetId}`, headers: other })).statusCode,
      ).toBe(404);
  });
  it('rejects executable and misdeclared file content', async () => {
    for (const mime of ['text/html', 'image/png'])
      expect(
        (await upload(propertyId, owner, mime, Buffer.from('<script>alert(1)</script>')))
          .statusCode,
      ).toBe(400);
  });
  it('enforces the upload size limit', async () => {
    const data = Buffer.alloc(10 * 1024 * 1024 + 1);
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(data);
    expect((await upload(propertyId, owner, 'image/png', data)).statusCode).toBe(413);
  });
  it('stores blocked analysis requests without invented results', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/properties/${propertyId}/analyses`,
      headers: owner,
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ status: 'blocked', result: null });
    expect(res.json().reason).toContain('Datenquellen');
  });
  it('seeds clearly labeled test data into only the current portfolio and prevents duplicates', async () => {
    const res = await app.inject({ method: 'POST', url: '/properties/test-data', headers: other });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toHaveLength(4);
    expect(res.json().every((p: { isTestData: boolean }) => p.isTestData)).toBe(true);
    expect(
      (await app.inject({ method: 'POST', url: '/properties/test-data', headers: other }))
        .statusCode,
    ).toBe(409);
    expect((await app.inject({ url: '/properties', headers: owner })).json()).toHaveLength(1);
  });
  it('cascades property deletion to history, assets and jobs', async () => {
    expect(
      (await app.inject({ method: 'DELETE', url: `/properties/${propertyId}`, headers: owner }))
        .statusCode,
    ).toBe(204);
    for (const table of ['valuations', 'assets', 'analysis_jobs'])
      expect(
        (
          await pool.query(`SELECT count(*)::int AS count FROM ${table} WHERE property_id=$1`, [
            propertyId,
          ])
        ).rows[0].count,
      ).toBe(0);
    expect((await app.inject({ url: `/assets/${assetId}`, headers: owner })).statusCode).toBe(404);
  });
  it('revokes sessions on logout', async () => {
    expect(
      (await app.inject({ method: 'POST', url: '/auth/logout', headers: other })).statusCode,
    ).toBe(204);
    expect((await app.inject({ url: '/auth/me', headers: other })).statusCode).toBe(401);
  });
  it('expires sessions', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'other@example.test', password: account('').password },
    });
    await pool.query("UPDATE sessions SET expires_at=now()-interval '1 second'");
    expect(
      (
        await app.inject({
          url: '/properties',
          headers: { authorization: `Bearer ${login.json().token}` },
        })
      ).statusCode,
    ).toBe(401);
  });
  it('requires HTTPS for production cookie deployment', async () => {
    await expect(
      createApp(pool, { production: true, origin: 'http://localhost:3000' }),
    ).rejects.toThrow('HTTPS');
  });
});
