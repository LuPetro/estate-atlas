import { beforeAll, beforeEach, afterAll, it, expect, vi } from 'vitest';
import EmbeddedPostgres from 'embedded-postgres';
import { randomBytes } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import { createApp } from '../app';
import { database, migrate } from '../database';
import { sampleProperties } from '@estate-atlas/shared';
import { fixtureProvider } from '../../../../tests/fixtures/analysis';
import type { AnalysisRuntime } from './provider';
import { AnalysisRunner } from './runner';
let pool: pg.Pool, server: EmbeddedPostgres, app: FastifyInstance;
let owner: { authorization: string }, other: { authorization: string };
const runtime: AnalysisRuntime = {
  config: {
    enabled: true,
    reason: null,
    models: ['fixture-model', 'fixture-alternative'],
    defaultModel: 'fixture-model',
  },
  provider: fixtureProvider(),
  userDailyLimit: 100,
  globalDailyLimit: 100,
};
const root = resolve('.local');
beforeAll(async () => {
  mkdirSync(root, { recursive: true });
  const password = randomBytes(24).toString('hex');
  server = new EmbeddedPostgres({
    databaseDir: resolve(root, `analysis-test-postgres-${process.pid}`),
    user: 'analysis_test',
    password,
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
  await server.createDatabase('analysis_test');
  pool = database(`postgresql://analysis_test:${password}@127.0.0.1:55436/analysis_test`);
  await migrate(pool);
  await migrate(pool);
  app = await createApp(pool, { analysis: runtime });

  for (const [email, set] of [
    [
      'owner-analysis@example.test',
      (h: { authorization: string }) => {
        owner = h;
      },
    ],
    [
      'other-analysis@example.test',
      (h: { authorization: string }) => {
        other = h;
      },
    ],
  ] as const) {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email, name: 'TESTDATEN Benutzer', password: 'Correct horse battery staple 42' },
    });
    set({ authorization: `Bearer ${res.json().token}` });
  }
});
beforeEach(async () => {
  await app.close();
  app = await createApp(pool, { analysis: runtime });
});
afterAll(async () => {
  await app?.close();
  await pool?.end();
  await server?.stop();
});
const create = async () => {
  const r = await app.inject({
    method: 'POST',
    url: '/properties',
    headers: owner,
    payload: { ...sampleProperties[0], title: 'TESTDATEN isolierte Analyse', isTestData: false },
  });
  expect(r.statusCode).toBe(201);
  return r.json();
};
const enqueue = (
  id: string,
  headers = owner,
  payload: Record<string, unknown> = { model: 'fixture-model', consent: true },
) => app.inject({ method: 'POST', url: `/properties/${id}/analyses`, headers, payload });
const get = (id: string) => app.inject({ url: `/analyses/${id}`, headers: owner });
const post = (id: string, verb: string, headers = owner) =>
  app.inject({ method: 'POST', url: `/analyses/${id}/${verb}`, headers });
it('authenticates config and requires explicit consent and an allowed model', async () => {
  expect((await app.inject('/analyses/config')).statusCode).toBe(401);
  expect((await app.inject({ url: '/analyses/config', headers: owner })).json().enabled).toBe(true);
  const p = await create();
  expect((await enqueue(p.id, owner, { model: 'fixture-model', consent: false })).statusCode).toBe(
    400,
  );
  expect((await enqueue(p.id, owner, { model: 'unapproved', consent: true })).statusCode).toBe(400);
});
it('queues only once, survives another API instance, calculates and applies idempotently', async () => {
  const p = await create();
  const a = (await enqueue(p.id, owner, { model: 'fixture-alternative', consent: true })).json();
  expect(a.status).toBe('queued');
  expect(a.result).toBeNull();
  expect(a.model).toBe('fixture-alternative');
  expect((await enqueue(p.id)).json().id).toBe(a.id);
  const second = await createApp(pool, { analysis: runtime });
  try {
    expect((await second.inject({ url: `/analyses/${a.id}`, headers: owner })).json().status).toBe(
      'queued',
    );
  } finally {
    await second.close();
  }
  const provider = vi.spyOn(runtime.provider!, 'research');
  await new AnalysisRunner(pool, runtime).tick();
  expect(provider).toHaveBeenCalledTimes(1);
  provider.mockRestore();
  const done = (await get(a.id)).json();
  expect(done.status).toBe('succeeded');
  expect(done.result.sources).toHaveLength(4);
  expect(
    (await app.inject({ url: `/properties/${p.id}`, headers: owner })).json().marketValue,
  ).toBe(p.marketValue);
  for (let i = 0; i < 2; i++) expect((await post(a.id, 'apply')).statusCode).toBe(200);
  const detail = (await app.inject({ url: `/properties/${p.id}`, headers: owner })).json();
  expect(detail.marketValue).toBe(done.result.mid);
  expect(detail.valuations.filter((v: { origin: string }) => v.origin === 'analysis')).toHaveLength(
    1,
  );
});
it('protects status, cancellation and adoption from foreign owners', async () => {
  const p = await create();
  const a = (await enqueue(p.id)).json();
  expect((await enqueue(p.id, other)).statusCode).toBe(404);
  expect((await app.inject({ url: `/analyses/${a.id}`, headers: other })).statusCode).toBe(404);
  for (const verb of ['cancel', 'apply'])
    expect((await post(a.id, verb, other)).statusCode).toBe(404);
  await post(a.id, 'cancel');
});
it('never calls a provider for a cancelled queued job', async () => {
  const p = await create();
  const a = (await enqueue(p.id)).json();
  await post(a.id, 'cancel');
  const provider = vi.spyOn(runtime.provider!, 'research');
  expect(await new AnalysisRunner(pool, runtime).tick()).toBe(false);
  expect(provider).not.toHaveBeenCalled();
  provider.mockRestore();
});
it('does not apply a result to changed property attributes', async () => {
  const p = await create();
  const a = (await enqueue(p.id)).json();
  await new AnalysisRunner(pool, runtime).tick();
  await app.inject({
    method: 'PUT',
    url: `/properties/${p.id}`,
    headers: owner,
    payload: {
      ...sampleProperties[0],
      title: 'TESTDATEN geänderte Fläche',
      isTestData: false,
      area: p.area + 10,
    },
  });
  expect((await post(a.id, 'apply')).statusCode).toBe(409);
});
it('fails on insufficient evidence without creating a price or retrying', async () => {
  const p = await create();
  const a = (await enqueue(p.id)).json();
  const original = runtime.provider!;
  runtime.provider = {
    id: original.id,
    async research() {
      return {
        research: { candidates: [], uncertainties: [] },
        consultedUrls: [],
        usage: { inputTokens: 0, outputTokens: 0, searchCalls: 0 },
      };
    },
  };
  try {
    const runner = new AnalysisRunner(pool, runtime);
    await runner.tick();
    const done = (await get(a.id)).json();
    expect(done.status).toBe('failed');
    expect(done.result).toBeNull();
    expect(done.diagnostics).toMatchObject({ extracted: 0, verified: 0, accepted: 0, websites: 0 });
    expect(done).not.toHaveProperty('research');
    expect(done).not.toHaveProperty('usage');
    const saved = (await pool.query('SELECT usage,research FROM analysis_jobs WHERE id=$1', [a.id]))
      .rows[0];
    expect(saved.usage).toEqual({ inputTokens: 0, outputTokens: 0, searchCalls: 0 });
    expect(saved.research.research.candidates).toEqual([]);
    expect(await runner.tick()).toBe(false);
  } finally {
    runtime.provider = original;
  }
});
it('preserves failed research evidence and explains comparison exclusions only to its owner', async () => {
  const p = await create();
  const a = (await enqueue(p.id)).json();
  const original = runtime.provider!;
  runtime.provider = {
    id: original.id,
    async research(...args) {
      const report = await original.research(...args);
      report.research.candidates[0]!.condition = 'renovation';
      report.research.candidates[1]!.currency = 'JPY';
      report.research.candidates[2]!.active = false;
      return { ...report, artifact: { report: 'TESTDATEN private report', extracted: {} } };
    },
  };
  try {
    await new AnalysisRunner(pool, runtime).tick();
    const done = (await get(a.id)).json();
    expect(done.status).toBe('failed');
    expect(done.diagnostics).toMatchObject({
      extracted: 4,
      accepted: 1,
      websites: 1,
      exclusions: { condition: 1, currency: 1, inactive: 1 },
    });
    expect(done.result).toBeNull();
    expect(JSON.stringify(done)).not.toContain('private report');
    expect((await app.inject({ url: `/analyses/${a.id}`, headers: other })).statusCode).toBe(404);
    expect(
      (await pool.query('SELECT research FROM analysis_jobs WHERE id=$1', [a.id])).rows[0].research
        .report,
    ).toBe('TESTDATEN private report');
  } finally {
    runtime.provider = original;
  }
});
it('marks interrupted paid jobs failed rather than repeating them', async () => {
  const p = await create();
  const a = (await enqueue(p.id)).json();
  await pool.query(
    "UPDATE analysis_jobs SET status='running',updated_at=now()-interval '2 minutes' WHERE id=$1",
    [a.id],
  );
  const provider = vi.spyOn(runtime.provider!, 'research');
  expect(await new AnalysisRunner(pool, runtime).tick()).toBe(false);
  expect(provider).not.toHaveBeenCalled();
  expect((await get(a.id)).json().status).toBe('failed');
  provider.mockRestore();
});
it('retains cost reservations after property deletion', async () => {
  const p = await create();
  const a = (await enqueue(p.id)).json();
  await app.inject({ method: 'DELETE', url: `/properties/${p.id}`, headers: owner });
  expect((await pool.query('SELECT * FROM analysis_requests WHERE id=$1', [a.id])).rowCount).toBe(
    1,
  );
  expect((await get(a.id)).statusCode).toBe(404);
});

it('enforces daily limits even after deletion', async () => {
  const p = await create();
  const previous = runtime.globalDailyLimit;
  runtime.globalDailyLimit = 1;
  try {
    expect((await enqueue(p.id)).statusCode).toBe(429);
  } finally {
    runtime.globalDailyLimit = previous;
  }
});
it('does not call an external provider after attributes change in the queue', async () => {
  const p = await create();
  const a = (await enqueue(p.id)).json();
  await pool.query("UPDATE properties SET data=jsonb_set(data,'{area}','1') WHERE id=$1", [p.id]);
  const provider = vi.spyOn(runtime.provider!, 'research');
  await new AnalysisRunner(pool, runtime).tick();
  expect(provider).not.toHaveBeenCalled();
  expect((await get(a.id)).json().status).toBe('failed');
  provider.mockRestore();
});
it('cancels a running job without allowing a late result to overwrite cancellation', async () => {
  const p = await create();
  const a = (await enqueue(p.id)).json();
  const original = runtime.provider!;
  let began!: () => void;
  const started = new Promise<void>((r) => {
    began = r;
  });
  let release!: () => void;
  const waiting = new Promise<void>((r) => {
    release = r;
  });
  runtime.provider = {
    id: original.id,
    async research(...args) {
      began();
      await waiting;
      return original.research(...args);
    },
  };
  try {
    const pending = new AnalysisRunner(pool, runtime).tick();
    await started;
    await post(a.id, 'cancel');
    release();
    await pending;
    const done = (await get(a.id)).json();
    expect(done.status).toBe('cancelled');
    expect(done.result).toBeNull();
  } finally {
    runtime.provider = original;
  }
});
