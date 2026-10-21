import { describe, it, expect } from 'vitest';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import path from 'node:path';
import { approvedRun, assertReleaseCi, requiredJobs } from './assert-release-ci.mjs';

const root = process.cwd();
const sha = 'a'.repeat(40);
const green = {
  id: 10,
  run_attempt: 1,
  head_sha: sha,
  head_branch: 'main',
  event: 'push',
  path: '.github/workflows/main.yml',
  head_repository: { full_name: 'LuPetro/estate-atlas' },
  status: 'completed',
  conclusion: 'success',
};
const verifyJobs = requiredJobs.map((name) => ({
  name,
  head_sha: sha,
  status: 'completed',
  conclusion: 'success',
}));
const verifyJob = verifyJobs[0];

describe('release CI authorization', () => {
  it.each(['failure', 'cancelled', 'skipped', 'timed_out', null])(
    'blocks a newer %s result despite an older green run',
    (conclusion) => {
      expect(() =>
        approvedRun({ workflow_runs: [green, { ...green, id: 11, conclusion }] }, sha),
      ).toThrow();
    },
  );
  it('blocks a pending rerun and mismatched commit, branch, repository or workflow', () => {
    for (const change of [
      { status: 'in_progress' },
      { head_sha: 'b'.repeat(40) },
      { head_branch: 'feature' },
      { head_repository: { full_name: 'other/repo' } },
      { event: 'pull_request' },
      { path: '.github/workflows/other.yml' },
    ])
      expect(() => approvedRun({ workflow_runs: [{ ...green, ...change }] }, sha)).toThrow();
    expect(() => approvedRun({}, sha)).toThrow();
    expect(() => approvedRun({ workflow_runs: [green] }, 'main')).toThrow();
  });
  it('requires the verify job in the exact attempt and rechecks for a racing rerun', async () => {
    const seen = [];
    const request = async (url) => {
      seen.push(url);
      if (url.includes('/workflows/')) return { workflow_runs: [green] };
      if (url.includes('/jobs')) return { jobs: verifyJobs };
      return green;
    };
    expect(await assertReleaseCi(sha, request)).toEqual(green);
    expect(seen[0]).not.toContain('status=success');
    expect(seen[1]).toContain('/attempts/1/jobs');
    for (const jobs of [
      [],
      [{ ...verifyJob, conclusion: 'skipped' }],
      [{ ...verifyJob, head_sha: 'b'.repeat(40) }],
    ]) {
      await expect(
        assertReleaseCi(sha, async (url) =>
          url.includes('/workflows/') ? { workflow_runs: [green] } : { jobs },
        ),
      ).rejects.toThrow('verify job');
    }
    await expect(
      assertReleaseCi(sha, async (url) => {
        if (url.includes('/workflows/')) return { workflow_runs: [green] };
        if (url.includes('/jobs')) return { jobs: verifyJobs };
        return { ...green, run_attempt: 2, status: 'in_progress' };
      }),
    ).rejects.toThrow('changed during approval');
  });
});

const realGit = execFileSync('which', ['git'], { encoding: 'utf8' }).trim();
function git(cwd, ...args) {
  return execFileSync(
    realGit,
    [
      '-c',
      'user.name=EstateAtlas synthetic fixture',
      '-c',
      'user.email=fixture@example.invalid',
      ...args,
    ],
    { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  ).trim();
}
async function fixture() {
  const dir = await mkdtemp(path.join(root, '.local/deployment-fixture-'));
  const source = path.join(dir, 'source');
  const server = path.join(dir, 'server');
  const remote = path.join(dir, 'remote.git');
  const bin = path.join(dir, 'bin');
  await mkdir(path.join(source, 'scripts'), { recursive: true });
  await mkdir(bin);
  git(source, 'init', '-b', 'main');
  await writeFile(path.join(source, '.gitignore'), '.local/\n');
  await writeFile(path.join(source, 'property-fixture.txt'), 'Synthetic deployment fixture v1\n');
  for (const command of ['pnpm', 'docker', 'gateway']) {
    await writeFile(
      path.join(source, 'scripts', command),
      `#!/usr/bin/env bash\nset -eu\nprintf '%s\\n' '${command} '"$*" >> "$CALL_LOG"\nif [[ "${command}" == docker && "\u0024{FAIL_PHASE:-}" == containers ]] || [[ "${command}" == pnpm && "$*" == release:check && "\u0024{FAIL_PHASE:-}" == preflight ]]; then exit 7; fi\n`,
      { mode: 0o755 },
    );
  }
  await writeFile(
    path.join(source, 'scripts/production-check.mjs'),
    String.raw`
import { appendFileSync } from 'node:fs';
const live = process.argv.includes('--live');
appendFileSync(process.env.CALL_LOG, 'pnpm release:check' + (live ? ' --live' : '') + '\n');
if (!live && process.env.FAIL_PHASE === 'preflight') process.exit(7);
`,
  );
  await writeFile(
    path.join(source, 'scripts/promote-images.mjs'),
    '// Promotion is independently tested against real release records.\n',
  );
  await writeFile(
    path.join(source, 'scripts/development-check.mjs'),
    "import { appendFileSync } from 'node:fs'; appendFileSync(process.env.CALL_LOG, 'development-check ' + process.argv.slice(2).join(' ') + '\\n');\n",
  );
  await writeFile(
    path.join(bin, 'docker'),
    '#!/usr/bin/env bash\nif [[ "$1 $2" == "image inspect" ]]; then printf "sha256:' +
      'a'.repeat(64) +
      '\\n"; fi\nexit 0\n',
    { mode: 0o755 },
  );
  git(source, 'add', '.');
  git(source, 'commit', '-m', 'Synthetic fixture base');
  const base = git(source, 'rev-parse', 'HEAD');
  await writeFile(path.join(source, 'property-fixture.txt'), 'Synthetic deployment fixture v2\n');
  await writeFile(path.join(source, 'release-only.txt'), 'Synthetic new release file\n');
  git(source, 'add', '.');
  git(source, 'commit', '-am', 'Synthetic fixture release');
  const release = git(source, 'rev-parse', 'HEAD');
  git(source, 'branch', 'dev');
  git(dir, 'clone', '--bare', source, remote);
  git(dir, 'clone', remote, server);
  git(server, 'reset', '--hard', base);
  git(server, 'remote', 'set-url', 'origin', 'https://github.com/LuPetro/estate-atlas.git');
  await writeFile(
    path.join(bin, 'git'),
    '#!/usr/bin/env bash\nif [[ "$1" == fetch ]]; then exec "$REAL_GIT" fetch --no-tags "$FIXTURE_REMOTE" "${@: -1}"; fi\nexec "$REAL_GIT" "$@"\n',
    { mode: 0o755 },
  );
  const log = path.join(dir, 'calls');
  const env = {
    ...process.env,
    PATH: `${bin}:${process.env.PATH}`,
    REAL_GIT: realGit,
    FIXTURE_REMOTE: remote,
    CALL_LOG: log,
    DEPLOY_PATH: server,
    RELEASE_SHA: release,
    DEVELOPMENT_SHA: release,
    DEVELOPMENT_RUN_ID: '20',
    DEVELOPMENT_RUN_ATTEMPT: '1',
  };
  return {
    dir,
    server,
    source,
    remote,
    base,
    release,
    log,
    env,
    run: (extra = {}) =>
      spawnSync('bash', [path.join(root, 'scripts/deploy-production')], {
        env: { ...env, ...extra },
        encoding: 'utf8',
        timeout: 10000,
      }),
    runDev: () =>
      spawnSync('bash', [path.join(root, 'scripts/deploy-development')], {
        env,
        encoding: 'utf8',
        timeout: 10000,
      }),
    clean: () => rm(dir, { recursive: true, force: true }),
  };
}

describe('server deployment with real isolated Git repositories and no Docker/provider calls', () => {
  it('deploys dev independently of the working branch and records tested source and immutable images', async () => {
    const f = await fixture();
    try {
      const state = path.join(f.server, '.local/environments/development');
      await mkdir(path.join(state, 'docker'), { recursive: true });
      await writeFile(
        path.join(state, 'docker/compose.env'),
        'PUBLIC_DOMAIN=dev.estateatlas.app\n',
      );
      await writeFile(path.join(f.server, 'property-fixture.txt'), 'Synthetic local owner edits');
      const result = f.runDev();
      expect(result.status, result.stderr + result.stdout).toBe(0);
      const record = JSON.parse(
        await readFile(path.join(state, 'releases', `${f.release}.json`), 'utf8'),
      );
      expect(record).toMatchObject({
        commit: f.release,
        branch: 'dev',
        tree: git(f.server, 'rev-parse', `${f.release}^{tree}`),
        result: 'success',
        runId: 20,
        runAttempt: 1,
        apiImage: 'sha256:' + 'a'.repeat(64),
      });
      expect(JSON.parse(await readFile(path.join(state, 'last-release.json'), 'utf8'))).toEqual(
        record,
      );
      expect(await readFile(path.join(f.server, 'property-fixture.txt'), 'utf8')).toBe(
        'Synthetic local owner edits',
      );
      expect(git(f.server, 'rev-parse', 'HEAD')).toBe(f.base);
    } finally {
      await f.clean();
    }
  });
  it('refuses a stale dev commit even when main still points to it', async () => {
    const f = await fixture();
    try {
      git(f.remote, 'update-ref', 'refs/heads/dev', f.base);
      const result = f.runDev();
      expect(result.status).not.toBe(0);
      expect(result.stdout).toContain('dev moved');
      await expect(readFile(f.log, 'utf8')).rejects.toThrow();
    } finally {
      await f.clean();
    }
  });
  it.each(['dirty', 'unpublished', 'branch', 'untracked-conflict'])(
    'preserves %s development work while deploying the immutable main archive',
    async (state) => {
      const f = await fixture();
      try {
        if (state === 'dirty')
          await writeFile(path.join(f.server, 'property-fixture.txt'), 'Synthetic owner edits');
        if (state === 'unpublished') {
          await writeFile(path.join(f.server, 'owner-work.txt'), 'Synthetic owner commit');
          git(f.server, 'add', '.');
          git(f.server, 'commit', '-m', 'Synthetic unpublished work');
        }
        if (state === 'branch') git(f.server, 'switch', '-c', 'dev');
        if (state === 'untracked-conflict')
          await writeFile(
            path.join(f.server, 'release-only.txt'),
            'Synthetic untracked owner work',
          );
        const before = git(f.server, 'rev-parse', 'HEAD');
        const status = git(f.server, 'status', '--porcelain');
        const branch = git(f.server, 'branch', '--show-current');
        const result = f.run();
        expect(result.status, result.stderr + result.stdout).toBe(0);
        expect(git(f.server, 'rev-parse', 'HEAD')).toBe(before);
        expect(git(f.server, 'status', '--porcelain')).toBe(status);
        expect(git(f.server, 'branch', '--show-current')).toBe(branch);
        expect(
          await readFile(
            path.join(f.server, '.local/releases', f.release, 'property-fixture.txt'),
            'utf8',
          ),
        ).toBe('Synthetic deployment fixture v2\n');
      } finally {
        await f.clean();
      }
    },
  );
  it('blocks promotion of a source tree different from the approved Dev commit', async () => {
    const f = await fixture();
    try {
      expect(f.run({ DEVELOPMENT_SHA: f.base }).status).not.toBe(0);
      await expect(readFile(f.log, 'utf8')).rejects.toThrow();
    } finally {
      await f.clean();
    }
  });
  it('deploys an immutable main archive, runs preflight before Docker and HTTPS afterwards, and preserves the checkout', async () => {
    const f = await fixture();
    try {
      const result = f.run();
      expect(result.status, result.stdout + result.stderr).toBe(0);
      expect(git(f.server, 'rev-parse', 'HEAD')).toBe(f.base);
      expect(git(f.server, 'branch', '--show-current')).toBe('main');
      expect((await readFile(f.log, 'utf8')).trim().split('\n')).toEqual([
        'pnpm release:check',
        'docker up -d --no-build --wait',
        'gateway enable-production',
        'pnpm release:check --live',
      ]);
      expect(
        JSON.parse(await readFile(path.join(f.server, '.local/deploy/last-release.json'), 'utf8')),
      ).toMatchObject({ result: 'success', checkoutCommit: f.base, commit: f.release });
    } finally {
      await f.clean();
    }
  });
  it.each(['origin', 'moved'])(
    'refuses %s server state without touching containers or losing work',
    async (state) => {
      const f = await fixture();
      try {
        let release = f.release;
        if (state === 'untracked-conflict')
          await writeFile(
            path.join(f.server, 'release-only.txt'),
            'Synthetic untracked owner work',
          );
        if (state === 'dirty')
          await writeFile(
            path.join(f.server, 'property-fixture.txt'),
            'Synthetic uncommitted owner work',
          );
        if (state === 'unpublished') {
          await writeFile(path.join(f.server, 'owner-work.txt'), 'Synthetic local commit');
          git(f.server, 'add', '.');
          git(f.server, 'commit', '-m', 'Synthetic unpublished owner work');
        }
        if (state === 'branch') git(f.server, 'checkout', '-b', 'owner-work');
        if (state === 'origin')
          git(f.server, 'remote', 'set-url', 'origin', 'https://example.invalid/other.git');
        if (state === 'moved') release = f.base;
        const head = git(f.server, 'rev-parse', 'HEAD');
        expect(f.run({ RELEASE_SHA: release }).status).not.toBe(0);
        expect(git(f.server, 'rev-parse', 'HEAD')).toBe(head);
        await expect(readFile(f.log, 'utf8')).rejects.toThrow();
        if (state === 'untracked-conflict')
          expect(await readFile(path.join(f.server, 'release-only.txt'), 'utf8')).toBe(
            'Synthetic untracked owner work',
          );
        if (state === 'dirty')
          expect(await readFile(path.join(f.server, 'property-fixture.txt'), 'utf8')).toBe(
            'Synthetic uncommitted owner work',
          );
      } finally {
        await f.clean();
      }
    },
  );
  it.each(['preflight', 'containers'])(
    'stops after %s failure and never reports release success',
    async (phase) => {
      const f = await fixture();
      try {
        expect(f.run({ FAIL_PHASE: phase }).status).not.toBe(0);
        const calls = await readFile(f.log, 'utf8');
        expect(calls).not.toContain('--live');
        if (phase === 'preflight') expect(calls).not.toContain('docker');
        expect(
          JSON.parse(
            await readFile(path.join(f.server, '.local/deploy/last-release.json'), 'utf8'),
          ),
        ).toMatchObject({ phase, result: 'failed' });
      } finally {
        await f.clean();
      }
    },
  );
  it('refuses a second deployment while the server lock is held', async () => {
    const f = await fixture();
    let holder;
    try {
      await mkdir(path.join(f.server, '.local/deploy'), { recursive: true });
      holder = spawn(
        'bash',
        ['-c', 'exec 9>"$DEPLOY_PATH/.local/deploy/lock"; flock -x 9; echo ready; read -r release'],
        { env: f.env },
      );
      await once(holder.stdout, 'data');
      const result = f.run();
      expect(result.status).not.toBe(0);
      expect(result.stdout).toContain('Another server deployment');
      expect(git(f.server, 'rev-parse', 'HEAD')).toBe(f.base);
    } finally {
      if (holder) {
        const ended = once(holder, 'exit');
        holder.stdin.end('release\n');
        await ended;
      }
      await f.clean();
    }
  });
});

describe('SSH transport without making any SSH connection', () => {
  it('blocks restarting the retired legacy database after its volume was adopted by Dev', async () => {
    const dir = await mkdtemp(path.join(root, '.local/legacy-retirement-fixture-'));
    try {
      await mkdir(path.join(dir, 'scripts'), { recursive: true });
      await mkdir(path.join(dir, '.local/node/bin'), { recursive: true });
      await mkdir(path.join(dir, '.local/environments/development'), { recursive: true });
      await writeFile(path.join(dir, '.local/environments/development/legacy-adopted'), 'adopted');
      await writeFile(
        path.join(dir, 'scripts/docker'),
        await readFile(path.join(root, 'scripts/docker')),
      );
      await writeFile(path.join(dir, '.local/node/bin/node'), '#!/bin/sh\nexit 0\n', {
        mode: 0o755,
      });
      await writeFile(
        path.join(dir, '.local/node/bin/docker'),
        '#!/bin/sh\nprintf called > "$DOCKER_CALLED"\n',
        { mode: 0o755 },
      );
      const called = path.join(dir, 'docker-called');
      const result = spawnSync('bash', [path.join(dir, 'scripts/docker'), 'up', '-d'], {
        encoding: 'utf8',
        env: {
          ...process.env,
          EA_OPERATIONS_ROOT: dir,
          EA_ENVIRONMENT: 'local',
          DOCKER_CALLED: called,
        },
      });
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain('legacy stack is retired');
      await expect(readFile(called)).rejects.toThrow();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
  it('buffers the entire received script before executing commands that consume stdin', async () => {
    const dir = await mkdtemp(path.join(root, '.local/receiver-fixture-'));
    try {
      await mkdir(path.join(dir, '.git'));
      const proof = path.join(dir, 'completed');
      const result = spawnSync('bash', [path.join(root, 'scripts/receive-deployment')], {
        encoding: 'utf8',
        timeout: 10000,
        input: 'cat >/dev/null\nprintf complete > "$PROOF"\n',
        env: { ...process.env, DEPLOY_PATH: dir, PROOF: proof },
      });
      expect(result.status, result.stderr).toBe(0);
      expect(await readFile(proof, 'utf8')).toBe('complete');
      const incoming = execFileSync(
        'find',
        [path.join(dir, '.local/deploy/incoming'), '-type', 'f'],
        { encoding: 'utf8' },
      );
      expect(incoming.trim()).toBe('');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
  it('pins the host key, sends the approved script, handles decimal port 08 and quotes hostile paths literally', async () => {
    const dir = await mkdtemp(path.join(root, '.local/ssh-fixture-'));
    try {
      const bin = path.join(dir, 'bin');
      await mkdir(bin);
      const keyPath = path.join(dir, 'key');
      execFileSync('ssh-keygen', ['-q', '-t', 'ed25519', '-N', '', '-f', keyPath]);
      const log = path.join(dir, 'args');
      const stdin = path.join(dir, 'stdin');
      const received = path.join(dir, 'received-path');
      const injected = path.join(dir, 'must-not-exist');
      await writeFile(
        path.join(bin, 'ssh'),
        '#!/usr/bin/env bash\nprintf "%s\\0" "$@" > "$SSH_ARGS"\ncat > "$SSH_STDIN"\n',
        { mode: 0o755 },
      );
      await writeFile(
        path.join(bin, 'timeout'),
        '#!/usr/bin/env bash\nprintf "%s" "$DEPLOY_PATH" > "$RECEIVED_PATH"\n',
        { mode: 0o755 },
      );
      const hostilePath = `${dir}/estate atlas/'; touch ${injected}; #`;
      await mkdir(path.join(hostilePath, '.git'), { recursive: true });
      const env = {
        ...process.env,
        PATH: `${bin}:${process.env.PATH}`,
        DEPLOY_KEY: await readFile(keyPath, 'utf8'),
        DEVELOPMENT_RUN_ID: '10',
        DEVELOPMENT_RUN_ATTEMPT: '1',
        DEPLOY_HOST: 'vps.example.invalid',
        DEPLOY_USER: 'codexdev',
        DEPLOY_PORT: '08',
        DEPLOY_PATH: hostilePath,
        RELEASE_SHA: sha,
        DEPLOY_KNOWN_HOSTS: 'Synthetic pinned key',
        SSH_ARGS: log,
        SSH_STDIN: stdin,
        RECEIVED_PATH: received,
      };
      const run = (change = {}) =>
        spawnSync('bash', [path.join(root, 'scripts/deploy-ssh')], {
          env: { ...env, ...change },
          encoding: 'utf8',
          timeout: 10000,
        });
      const result = run();
      expect(result.status, result.stdout + result.stderr).toBe(0);
      const args = (await readFile(log, 'utf8')).split('\0').filter(Boolean);
      expect(args.slice(0, 2)).toEqual(['-F', '/dev/null']);
      expect(args).toContain('StrictHostKeyChecking=yes');
      expect(args).toContain('GlobalKnownHostsFile=/dev/null');
      expect(args).toContain('8');
      const tempKey = args[args.indexOf('-i') + 1];
      await expect(readFile(tempKey)).rejects.toThrow();
      expect(await readFile(stdin, 'utf8')).toBe(
        await readFile(path.join(root, 'scripts/deploy-production'), 'utf8'),
      );
      execFileSync('bash', ['-c', args.at(-1)], { env });
      expect(await readFile(received, 'utf8')).toBe(hostilePath);
      await expect(readFile(injected)).rejects.toThrow();
      for (const change of [
        { DEPLOY_PORT: '0' },
        { DEPLOY_PORT: '65536' },
        { DEPLOY_HOST: '-bad' },
        { DEPLOY_KEY: 'SYNTHETIC_INVALID_SECRET' },
        { RELEASE_SHA: 'main' },
      ]) {
        await rm(log, { force: true });
        const rejected = run(change);
        expect(rejected.status).not.toBe(0);
        expect(rejected.stdout + rejected.stderr).not.toContain('SYNTHETIC_INVALID_SECRET');
        await expect(readFile(log)).rejects.toThrow();
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
