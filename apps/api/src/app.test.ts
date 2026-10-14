import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import EmbeddedPostgres from 'embedded-postgres';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import { createApp } from './app';
import { database, migrate } from './database';
import { sampleProperties } from '@estate-atlas/shared';
import { cleanupExpired } from './maintenance-rules';
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
describe('public release limits and proxy isolation', () => {
  it('cleans expired credentials and old audit without deleting live account or property data', async () => {
    const id = randomUUID(),
      expired = randomBytes(32).toString('hex'),
      live = randomBytes(32).toString('hex');
    await pool.query(
      "INSERT INTO users(id,email,name,password_hash,mfa_pending_secret,mfa_pending_at) VALUES($1,$2,'Synthetic retention fixture','synthetic-unused-hash','synthetic-pending',now()-interval '2 hours')",
      [id, `retention-${id}@example.test`],
    );
    await pool.query(
      "INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$3,now()-interval '1 hour'),($2,$3,now()+interval '1 hour')",
      [expired, live, id],
    );
    await pool.query(
      "INSERT INTO account_tokens(token_hash,user_id,purpose,email,expires_at) VALUES($1,$3,'reset','synthetic@example.test',now()-interval '1 hour'),($2,$3,'verify','synthetic@example.test',now()+interval '1 hour')",
      [expired, live, id],
    );
    const oldAudit = randomUUID(),
      newAudit = randomUUID();
    await pool.query(
      "INSERT INTO account_audit(id,action,created_at) VALUES($1,'synthetic',now()-interval '181 days'),($2,'synthetic',now())",
      [oldAudit, newAudit],
    );
    const before = (await pool.query('SELECT count(*)::int AS count FROM properties')).rows[0]
      .count;
    await cleanupExpired(pool, 180);
    expect(
      (await pool.query('SELECT token_hash FROM sessions WHERE user_id=$1', [id])).rows,
    ).toEqual([{ token_hash: live }]);
    expect(
      (await pool.query('SELECT token_hash FROM account_tokens WHERE user_id=$1', [id])).rows,
    ).toEqual([{ token_hash: live }]);
    expect(
      (await pool.query('SELECT mfa_pending_secret FROM users WHERE id=$1', [id])).rows[0]
        .mfa_pending_secret,
    ).toBeNull();
    expect((await pool.query('SELECT count(*)::int AS count FROM properties')).rows[0].count).toBe(
      before,
    );
    expect(
      (await pool.query('SELECT id FROM account_audit WHERE id IN ($1,$2)', [oldAudit, newAudit]))
        .rows,
    ).toEqual([{ id: newAudit }]);
  });
  it('reserves property quota atomically under concurrent creates', async () => {
    const limited = await createApp(pool, { maxProperties: 1 });
    try {
      const registered = (
        await limited.inject({
          method: 'POST',
          url: '/auth/register',
          payload: account(`quota-${randomUUID()}@example.test`),
        })
      ).json();
      const headers = { authorization: `Bearer ${registered.token}` };
      const results = await Promise.all(
        [1, 2].map(() =>
          limited.inject({
            method: 'POST',
            url: '/properties',
            headers,
            payload: sampleProperties[0],
          }),
        ),
      );
      expect(results.map((r) => r.statusCode).sort()).toEqual([201, 409]);
      const usage = (await limited.inject({ url: '/portfolio/usage', headers })).json();
      expect(usage).toMatchObject({ properties: 1, propertyLimit: 1, storageBytes: 0 });
      expect((await limited.inject({ url: '/portfolio/usage' })).statusCode).toBe(401);
      const count = await pool.query(
        'SELECT count(*)::int AS count FROM valuations v JOIN properties p ON p.id=v.property_id WHERE p.owner_id=$1',
        [registered.user.id],
      );
      expect(count.rows[0].count).toBe(1);
    } finally {
      await limited.close();
    }
  });
  it('charges collaborator uploads to the owner and rolls back account and global overflow', async () => {
    const bytes = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jF6cAAAAASUVORK5CYII=',
      'base64',
    );
    const baseline = Number(
      (await pool.query('SELECT COALESCE(sum(size),0)::bigint AS bytes FROM assets')).rows[0].bytes,
    );
    const limited = await createApp(pool, {
      maxAccountStorage: bytes.length,
      maxTotalStorage: baseline + bytes.length * 2,
    });
    const send = (id: string, headers: Record<string, string>) => {
      const boundary = 'release-quota-fixture';
      return limited.inject({
        method: 'POST',
        url: `/properties/${id}/assets`,
        headers: { ...headers, 'content-type': `multipart/form-data; boundary=${boundary}` },
        payload: Buffer.concat([
          Buffer.from(
            `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="fixture.png"\r\nContent-Type: image/png\r\n\r\n`,
          ),
          bytes,
          Buffer.from(`\r\n--${boundary}--\r\n`),
        ]),
      });
    };
    try {
      const users = await Promise.all(
        [1, 2, 3].map(async () =>
          (
            await limited.inject({
              method: 'POST',
              url: '/auth/register',
              payload: account(`storage-${randomUUID()}@example.test`),
            })
          ).json(),
        ),
      );
      const headers = users.map((u) => ({ authorization: `Bearer ${u.token}` }));
      const properties = await Promise.all(
        users.map(async (_u, i) =>
          (
            await limited.inject({
              method: 'POST',
              url: '/properties',
              headers: headers[i],
              payload: sampleProperties[0],
            })
          ).json(),
        ),
      );
      await pool.query(
        "INSERT INTO property_members(property_id,user_id,role) VALUES($1,$2,'editor')",
        [properties[0].id, users[1].user.id],
      );
      const first = await send(properties[0].id, headers[1]);
      expect(first.statusCode).toBe(201);
      expect(
        (await limited.inject({ url: '/portfolio/usage', headers: headers[0] })).json()
          .storageBytes,
      ).toBe(bytes.length);
      expect(
        (await limited.inject({ url: '/portfolio/usage', headers: headers[1] })).json()
          .storageBytes,
      ).toBe(0);
      expect((await send(properties[0].id, headers[1])).statusCode).toBe(409);
      expect((await send(properties[1].id, headers[1])).statusCode).toBe(201);
      expect((await send(properties[2].id, headers[2])).statusCode).toBe(503);
      expect(
        (await limited.inject({ url: '/portfolio/usage', headers: headers[2] })).json()
          .storageBytes,
      ).toBe(0);
    } finally {
      await limited.close();
    }
  });
  it('trusts only the nearest controlled hop, and ignores forwarding headers without proxy mode', async () => {
    for (const proxy of [false, true]) {
      const check = await createApp(pool, { proxy });
      check.get('/__fixture/client-ip', async (req) => ({ ip: req.ip }));
      try {
        const response = await check.inject({
          url: '/__fixture/client-ip',
          remoteAddress: '127.0.0.1',
          headers: { 'x-forwarded-for': '198.51.100.1, 203.0.113.5' },
        });
        expect(response.json().ip).toBe(proxy ? '203.0.113.5' : '127.0.0.1');
      } finally {
        await check.close();
      }
    }
  });
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
  it('persists rental periods, protects ownership and never creates a valuation for rental-only edits', async () => {
    const before = (await app.inject({ url: `/properties/${propertyId}`, headers: owner })).json();
    const rental = { status: 'rented', start: '2026-10-01', end: '2027-09-30' };
    const saved = await app.inject({
      method: 'PUT',
      url: `/properties/${propertyId}`,
      headers: owner,
      payload: { ...sampleProperties[0], rental },
    });
    expect(saved.statusCode).toBe(200);
    expect(saved.json().rental).toEqual(rental);
    const detail = (await app.inject({ url: `/properties/${propertyId}`, headers: owner })).json();
    expect(detail.rental).toEqual(rental);
    expect(detail.valuations).toEqual(before.valuations);
    expect(
      (
        await app.inject({
          method: 'PUT',
          url: `/properties/${propertyId}`,
          headers: other,
          payload: { ...sampleProperties[0], rental: null },
        })
      ).statusCode,
    ).toBe(404);
    expect(
      (
        await app.inject({
          method: 'PUT',
          url: `/properties/${propertyId}`,
          headers: owner,
          payload: { ...sampleProperties[0], rental: { ...rental, end: '2026-09-01' } },
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (await app.inject({ url: '/properties', headers: owner }))
        .json()
        .find((p: { id: string }) => p.id === propertyId).rental,
    ).toEqual(rental);
    // Simulate a pre-feature stored row in this isolated test database.
    await pool.query("UPDATE properties SET data=data-'rental' WHERE id=$1", [propertyId]);
    expect(
      (await app.inject({ url: `/properties/${propertyId}`, headers: owner })).json().rental,
    ).toBeNull();
  });
  it('keeps other portfolios empty', async () =>
    expect((await app.inject({ url: '/properties', headers: other })).json()).toEqual([]));
  it('returns only the authenticated portfolio history, including archived observations', async () => {
    expect((await app.inject({ url: '/portfolio/valuations' })).statusCode).toBe(401);
    expect((await app.inject({ url: '/portfolio/valuations', headers: other })).json()).toEqual([]);
    const before = (await app.inject({ url: '/portfolio/valuations', headers: owner })).json();
    const detail = (await app.inject({ url: `/properties/${propertyId}`, headers: owner })).json();
    expect(before).toEqual(detail.valuations);
    expect(Object.keys(before[0]).sort()).toEqual(
      ['currency', 'id', 'marketValue', 'origin', 'propertyId', 'recordedAt'].sort(),
    );
    await app.inject({
      method: 'PATCH',
      url: `/properties/${propertyId}/archive`,
      headers: owner,
      payload: { archived: true },
    });
    expect((await app.inject({ url: '/portfolio/valuations', headers: owner })).json()).toEqual(
      before,
    );
    await app.inject({
      method: 'PATCH',
      url: `/properties/${propertyId}/archive`,
      headers: owner,
      payload: { archived: false },
    });
  });
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
  it('persists workspace assumptions and prevents concurrent edits from silently overwriting each other', async () => {
    const url = `/properties/${propertyId}/workspace`;
    expect((await app.inject(url)).statusCode).toBe(401);
    expect((await app.inject({ url, headers: other })).statusCode).toBe(404);
    expect((await app.inject({ url, headers: owner })).json()).toEqual({
      version: 0,
      checklists: [],
      purchaseCheck: null,
    });
    const input = {
      expectedVersion: 0,
      checklists: [
        {
          id: randomUUID(),
          title: 'Übergabe',
          date: '2026-10-11',
          notes: 'Synthetischer Test',
          items: [{ id: randomUUID(), label: 'Schlüssel', done: true, note: '3 Stück' }],
        },
      ],
      purchaseCheck: {
        currency: 'EUR',
        purchasePrice: 320000,
        transferTaxPercent: 0,
        notaryPercent: 0,
        agentPercent: 0,
        otherCosts: 100,
        renovationBudget: 10000,
        equity: 80000,
      },
    };
    const writes = await Promise.all([
      app.inject({ method: 'PUT', url, headers: owner, payload: input }),
      app.inject({ method: 'PUT', url, headers: owner, payload: { ...input, checklists: [] } }),
    ]);
    expect(writes.map((r) => r.statusCode).sort()).toEqual([200, 409]);
    const saved = writes.find((r) => r.statusCode === 200)!.json();
    expect((await app.inject({ url, headers: owner })).json()).toEqual(saved);
    expect(saved).toMatchObject({ version: 1, purchaseCheck: input.purchaseCheck });
    const db = await pool.query(
      'SELECT data,version FROM property_workspaces WHERE property_id=$1',
      [propertyId],
    );
    expect(db.rows[0].data.purchaseCheck.currency).toBe('EUR');
    expect(
      (
        await app.inject({
          method: 'PUT',
          url,
          headers: owner,
          payload: { ...input, expectedVersion: 1, ownerId: randomUUID() },
        })
      ).statusCode,
    ).toBe(400);
    const original = (await pool.query('SELECT data FROM properties WHERE id=$1', [propertyId]))
      .rows[0].data;
    expect(
      (
        await app.inject({
          method: 'PUT',
          url: `/properties/${propertyId}`,
          headers: owner,
          payload: { ...original, currency: 'USD' },
        })
      ).statusCode,
    ).toBe(200);
    expect((await app.inject({ url, headers: owner })).json().purchaseCheck.currency).toBe('EUR');
    await app.inject({
      method: 'PUT',
      url: `/properties/${propertyId}`,
      headers: owner,
      payload: original,
    });
  });
  it('shares reads through a hashed single-use invitation while keeping viewers read-only', async () => {
    const invitationUrl = `/properties/${propertyId}/invitations`;
    expect(
      (
        await app.inject({
          method: 'POST',
          url: invitationUrl,
          headers: other,
          payload: { role: 'editor' },
        })
      ).statusCode,
    ).toBe(404);
    const invitation = await app.inject({
      method: 'POST',
      url: invitationUrl,
      headers: owner,
      payload: { role: 'viewer' },
    });
    expect(invitation.statusCode).toBe(201);
    const invite = invitation.json();
    expect(invite.code).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const db = (
      await pool.query('SELECT token_hash,expires_at FROM property_invitations WHERE id=$1', [
        invite.id,
      ])
    ).rows[0];
    expect(db.token_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(db.token_hash).not.toBe(invite.code);
    expect(db.expires_at.getTime() - Date.now()).toBeGreaterThan(6 * 86400000);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/invitations/accept',
          headers: owner,
          payload: { code: invite.code },
        })
      ).statusCode,
    ).toBe(409);
    const accepted = await Promise.all([
      app.inject({
        method: 'POST',
        url: '/invitations/accept',
        headers: other,
        payload: { code: invite.code },
      }),
      app.inject({
        method: 'POST',
        url: '/invitations/accept',
        headers: other,
        payload: { code: invite.code },
      }),
    ]);
    expect(accepted.map((r) => r.statusCode).sort()).toEqual([200, 404]);
    expect(accepted.find((r) => r.statusCode === 200)!.json()).toMatchObject({
      id: propertyId,
      access: 'viewer',
    });
    expect((await app.inject({ url: '/properties', headers: other })).json()).toEqual([
      expect.objectContaining({ id: propertyId, access: 'viewer' }),
    ]);
    expect(
      (await app.inject({ url: `/properties/${propertyId}`, headers: other })).json().access,
    ).toBe('viewer');
    expect(
      (await app.inject({ url: '/portfolio/valuations', headers: other })).json().length,
    ).toBeGreaterThan(0);
    expect((await app.inject({ url: '/portfolio/assets', headers: other })).json()).toEqual([
      expect.objectContaining({ id: assetId, propertyId }),
    ]);
    expect(
      (await app.inject({ url: '/portfolio/assets', headers: other })).json()[0],
    ).not.toHaveProperty('content');
    expect((await app.inject({ url: `/assets/${assetId}`, headers: other })).statusCode).toBe(200);
    expect(
      (await app.inject({ url: `/properties/${propertyId}/workspace`, headers: other })).statusCode,
    ).toBe(200);
    const original = (await pool.query('SELECT data FROM properties WHERE id=$1', [propertyId]))
      .rows[0].data;
    for (const request of [
      { method: 'PUT' as const, url: `/properties/${propertyId}`, payload: original },
      {
        method: 'PUT' as const,
        url: `/properties/${propertyId}/workspace`,
        payload: { expectedVersion: 1, checklists: [], purchaseCheck: null },
      },
      { method: 'DELETE' as const, url: `/assets/${assetId}` },
      { method: 'GET' as const, url: `/properties/${propertyId}/shares` },
    ])
      expect((await app.inject({ ...request, headers: other })).statusCode).toBe(404);
    expect((await upload(propertyId, other)).statusCode).toBe(404);
    const memberId = (await app.inject({ url: '/auth/me', headers: other })).json().id;
    const shares = (
      await app.inject({ url: `/properties/${propertyId}/shares`, headers: owner })
    ).json();
    expect(shares).toMatchObject({
      members: [{ userId: memberId, role: 'viewer' }],
      invitations: [],
    });
    expect(JSON.stringify(shares)).not.toContain(invite.code);
    expect(
      (
        await app.inject({
          method: 'DELETE',
          url: `/properties/${propertyId}/shares/${memberId}`,
          headers: owner,
        })
      ).statusCode,
    ).toBe(204);
  });
  it('allows editors to collaborate but keeps billing, destruction and sharing with the owner; revocation stops every private read and write', async () => {
    const invite = (
      await app.inject({
        method: 'POST',
        url: `/properties/${propertyId}/invitations`,
        headers: owner,
        payload: { role: 'editor' },
      })
    ).json();
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/invitations/accept',
          headers: other,
          payload: { code: invite.code },
        })
      ).statusCode,
    ).toBe(200);
    const original = (await pool.query('SELECT data FROM properties WHERE id=$1', [propertyId]))
      .rows[0].data;
    const edited = await app.inject({
      method: 'PUT',
      url: `/properties/${propertyId}`,
      headers: other,
      payload: { ...original, title: 'Gemeinsam bearbeitet' },
    });
    expect(edited.statusCode).toBe(200);
    expect(edited.json().access).toBe('editor');
    expect(
      (
        await app.inject({
          method: 'PUT',
          url: `/properties/${propertyId}`,
          headers: other,
          payload: {
            ...original,
            ownerId: (await app.inject({ url: '/auth/me', headers: other })).json().id,
          },
        })
      ).statusCode,
    ).toBe(400);
    const workspace = (
      await app.inject({ url: `/properties/${propertyId}/workspace`, headers: other })
    ).json();
    expect(
      (
        await app.inject({
          method: 'PUT',
          url: `/properties/${propertyId}/workspace`,
          headers: other,
          payload: {
            expectedVersion: workspace.version,
            checklists: [],
            purchaseCheck: workspace.purchaseCheck,
          },
        })
      ).statusCode,
    ).toBe(200);
    const image = await upload(propertyId, other);
    expect(image.statusCode).toBe(201);
    expect(
      (await app.inject({ method: 'DELETE', url: `/assets/${image.json().id}`, headers: other }))
        .statusCode,
    ).toBe(204);
    const job = (
      await pool.query('SELECT id FROM analysis_jobs WHERE property_id=$1 LIMIT 1', [propertyId])
    ).rows[0];
    expect((await app.inject({ url: `/analyses/${job.id}`, headers: other })).statusCode).toBe(200);
    const ownerOnly = [
      {
        method: 'POST' as const,
        url: `/properties/${propertyId}/analyses`,
        payload: { model: 'gpt-6-luna', consent: true },
      },
      { method: 'POST' as const, url: `/analyses/${job.id}/cancel` },
      { method: 'POST' as const, url: `/analyses/${job.id}/apply` },
      {
        method: 'PATCH' as const,
        url: `/properties/${propertyId}/archive`,
        payload: { archived: true },
      },
      { method: 'DELETE' as const, url: `/properties/${propertyId}` },
      {
        method: 'POST' as const,
        url: `/properties/${propertyId}/invitations`,
        payload: { role: 'editor' },
      },
    ];
    for (const request of ownerOnly)
      expect((await app.inject({ ...request, headers: other })).statusCode).toBe(404);
    const memberId = (await app.inject({ url: '/auth/me', headers: other })).json().id;
    expect(
      (
        await app.inject({
          method: 'DELETE',
          url: `/properties/${propertyId}/shares/${memberId}`,
          headers: other,
        })
      ).statusCode,
    ).toBe(404);
    expect(
      (
        await app.inject({
          method: 'DELETE',
          url: `/properties/${propertyId}/shares/${memberId}`,
          headers: owner,
        })
      ).statusCode,
    ).toBe(204);
    for (const url of [
      `/properties/${propertyId}`,
      `/properties/${propertyId}/workspace`,
      `/assets/${assetId}`,
      `/analyses/${job.id}`,
    ])
      expect((await app.inject({ url, headers: other })).statusCode).toBe(404);
    for (const url of ['/properties', '/portfolio/valuations', '/portfolio/assets'])
      expect((await app.inject({ url, headers: other })).json()).toEqual([]);
    expect(
      (
        await app.inject({
          method: 'PUT',
          url: `/properties/${propertyId}`,
          headers: other,
          payload: original,
        })
      ).statusCode,
    ).toBe(404);
    expect((await upload(propertyId, other)).statusCode).toBe(404);
    await app.inject({
      method: 'PUT',
      url: `/properties/${propertyId}`,
      headers: owner,
      payload: original,
    });
  });
  it('rejects expired, revoked and malformed invitations without granting access', async () => {
    const url = `/properties/${propertyId}/invitations`;
    const expired = (
      await app.inject({ method: 'POST', url, headers: owner, payload: { role: 'viewer' } })
    ).json();
    await pool.query(
      "UPDATE property_invitations SET created_at=now()-interval '8 days',expires_at=now()-interval '1 day' WHERE id=$1",
      [expired.id],
    );
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/invitations/accept',
          headers: other,
          payload: { code: expired.code },
        })
      ).statusCode,
    ).toBe(404);
    const revoked = (
      await app.inject({ method: 'POST', url, headers: owner, payload: { role: 'editor' } })
    ).json();
    expect(
      (await app.inject({ method: 'DELETE', url: `${url}/${revoked.id}`, headers: owner }))
        .statusCode,
    ).toBe(204);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/invitations/accept',
          headers: other,
          payload: { code: revoked.code },
        })
      ).statusCode,
    ).toBe(404);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/invitations/accept',
          headers: other,
          payload: { code: 'invalid' },
        })
      ).statusCode,
    ).toBe(400);
    expect((await app.inject({ url: '/portfolio/assets' })).statusCode).toBe(401);
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
    for (const table of [
      'valuations',
      'assets',
      'analysis_jobs',
      'property_workspaces',
      'property_members',
      'property_invitations',
    ])
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
