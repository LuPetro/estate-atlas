import { describe, it, expect } from 'vitest';
import { assertDevelopment } from './assert-development.mjs';
import { validatePromotion } from './promote-images.mjs';
import { developmentErrors } from './development-check.mjs';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { parse } from 'dotenv';

const sha = 'a'.repeat(40);
const run = {
  id: 20,
  run_attempt: 2,
  head_sha: sha,
  head_branch: 'main',
  head_repository: { full_name: 'LuPetro/estate-atlas' },
  event: 'workflow_run',
  path: '.github/workflows/development.yml',
  status: 'completed',
  conclusion: 'success',
};
const job = {
  name: 'deploy-development',
  head_sha: sha,
  status: 'completed',
  conclusion: 'success',
};
const request =
  (runs = [run], jobs = [job], latest = run) =>
  async (url) =>
    url.includes('/workflows/')
      ? { workflow_runs: runs }
      : url.includes('/jobs')
        ? { jobs }
        : latest;

describe('Dev is required before Prod', () => {
  it('accepts the exact successful Dev deployment attempt', async () => {
    expect(await assertDevelopment(sha, request())).toEqual(run);
  });
  it.each(['failure', 'cancelled', 'skipped', null])(
    'rejects newer %s Dev runs instead of using older green ones',
    async (conclusion) => {
      await expect(
        assertDevelopment(sha, request([run, { ...run, id: 21, conclusion }])),
      ).rejects.toThrow();
    },
  );
  it('rejects absent, fork, wrong workflow, wrong branch, pending and skipped deployment jobs', async () => {
    for (const change of [
      { head_sha: 'b'.repeat(40) },
      { head_branch: 'feature' },
      { head_repository: { full_name: 'fork/repo' } },
      { event: 'pull_request' },
      { path: '.github/workflows/ci.yml' },
      { status: 'in_progress' },
    ])
      await expect(assertDevelopment(sha, request([{ ...run, ...change }]))).rejects.toThrow();
    await expect(assertDevelopment(sha, request([]))).rejects.toThrow();
    await expect(
      assertDevelopment(sha, request([run], [{ ...job, conclusion: 'skipped' }])),
    ).rejects.toThrow();
    await expect(assertDevelopment(sha, request([run], [], run))).rejects.toThrow();
    await expect(
      assertDevelopment(sha, request([run], [job], { ...run, run_attempt: 3 })),
    ).rejects.toThrow();
  });
});

describe('promotion uses the Dev images and never Dev data/configuration', () => {
  const record = {
    commit: sha,
    result: 'success',
    runId: 20,
    runAttempt: 2,
    apiImage: 'sha256:' + 'b'.repeat(64),
    webImage: 'sha256:' + 'c'.repeat(64),
  };
  it('returns immutable image IDs from the matching successful run', () => {
    expect(validatePromotion(record, sha, '20', '2')).toEqual({
      API_IMAGE: record.apiImage,
      WEB_IMAGE: record.webImage,
    });
  });
  it('blocks wrong commits, reruns, failed checks and missing or mutable image references', () => {
    for (const change of [
      { result: 'running' },
      { commit: 'b'.repeat(40) },
      { runId: 21 },
      { runAttempt: 3 },
      { apiImage: 'estate-atlas-api:latest' },
      { webImage: '' },
    ])
      expect(() => validatePromotion({ ...record, ...change }, sha, '20', '2')).toThrow();
    expect(() => validatePromotion(record, sha, '', '2')).toThrow();
  });
  it('writes valid, reusable Dev release JSON and environment lines from the actual deploy script', async () => {
    const dir = await mkdtemp(path.resolve('.local/dev-record-fixture-'));
    try {
      const state = path.join(dir, '.local/environments/development');
      await mkdir(path.join(state, 'docker'), { recursive: true });
      await mkdir(path.join(dir, 'bin'));
      await writeFile(
        path.join(state, 'docker/compose.env'),
        'PUBLIC_DOMAIN=dev.estateatlas.app\nAPI_IMAGE=old\nWEB_IMAGE=old\n',
      );
      await writeFile(
        path.join(dir, 'bin/docker'),
        '#!/usr/bin/env bash\nprintf "%s\\n" "sha256:' + 'd'.repeat(64) + '"\n',
        { mode: 0o755 },
      );
      const script = (await readFile('scripts/deploy-development', 'utf8'))
        .split("node --input-type=module <<'JS'\n")[1]
        .split('\nJS\n')[0];
      const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
        encoding: 'utf8',
        env: {
          ...process.env,
          PATH: `${dir}/bin:${process.env.PATH}`,
          EA_OPERATIONS_ROOT: dir,
          RELEASE_SHA: sha,
          DEVELOPMENT_RUN_ID: '20',
          DEVELOPMENT_RUN_ATTEMPT: '2',
          API_IMAGE: 'api-fixture',
          WEB_IMAGE: 'web-fixture',
        },
      });
      expect(result.status, result.stderr).toBe(0);
      const saved = JSON.parse(await readFile(path.join(state, 'last-release.json'), 'utf8'));
      expect(saved).toMatchObject({ commit: sha, result: 'success', runId: 20, runAttempt: 2 });
      expect(parse(await readFile(path.join(state, 'docker/compose.env')))).toEqual({
        PUBLIC_DOMAIN: 'dev.estateatlas.app',
        API_IMAGE: saved.apiImage,
        WEB_IMAGE: saved.webImage,
      });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe('private Dev allows postponed SMTP without weakening HTTPS or exposing Prod data', () => {
  const env = {
    PUBLIC_DOMAIN: 'dev.estateatlas.app',
    WEB_ORIGIN: 'https://dev.estateatlas.app',
    ACCOUNT_PUBLIC_URL: 'https://dev.estateatlas.app',
    ALLOW_LOCAL_HTTP: 'false',
    TRUST_PROXY: '1',
    NEXT_PUBLIC_API_URL: '/api',
    REGISTRATION_MODE: 'invite',
    POSTGRES_VOLUME_NAME: 'estate-atlas-development_postgres_data',
  };
  const gateway = {
    DEV_DOMAIN: env.PUBLIC_DOMAIN,
    DEV_ACCESS_USER: 'estateatlas-dev',
    DEV_AUTH_HASH: '$2a$14$' + 'a'.repeat(53),
  };
  it('does not require fake legal texts, mail confirmations or verified admin data', () => {
    expect(developmentErrors(env, gateway)).toEqual([]);
  });
  it('blocks missing perimeter protection, public signup, HTTP and production volumes', () => {
    expect(developmentErrors(env, { ...gateway, DEV_AUTH_HASH: '' })).not.toEqual([]);
    for (const change of [
      { REGISTRATION_MODE: 'open' },
      { ALLOW_LOCAL_HTTP: 'true' },
      { WEB_ORIGIN: 'http://dev.estateatlas.app' },
      { TRUST_PROXY: '2' },
      { POSTGRES_VOLUME_NAME: 'estate-atlas-production_postgres_data' },
    ])
      expect(developmentErrors({ ...env, ...change }, gateway)).not.toEqual([]);
  });
});
