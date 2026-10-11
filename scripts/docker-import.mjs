import { spawn } from 'node:child_process';
import { mkdirSync, openSync, closeSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import dotenv from 'dotenv';
import pg from 'pg';
const root = fileURLToPath(new URL('../', import.meta.url));
process.env.DOCKER_CONFIG = path.join(root, '.local/docker/cli');
dotenv.config({ path: path.join(root, '.env'), quiet: true });
if (!process.env.DATABASE_URL) throw new Error('Original DATABASE_URL is required in .env.');
const source = new URL(process.env.DATABASE_URL);
if (!['localhost', '127.0.0.1'].includes(source.hostname))
  throw new Error('Only the existing local database may be imported.');
const tables = [
  'users',
  'sessions',
  'properties',
  'valuations',
  'assets',
  'analysis_jobs',
  'schema_migrations',
];
const countsSql = `SELECT json_build_object(${tables.map((t) => `'${t}',(SELECT count(*) FROM public.${t})`).join(',')})::text`;
async function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      stdio: ['ignore', 'pipe', 'inherit'],
      ...options,
    });
    let output = '';
    child.stdout?.on('data', (chunk) => (output += chunk));
    child.once('error', reject);
    child.once('exit', (code) =>
      code === 0
        ? resolve(output.trim())
        : reject(new Error(`${path.basename(command)} exited with status ${code}.`)),
    );
  });
}
const compose = (args, options) => run(path.join(root, 'scripts/docker'), args, options);
await compose(['up', '-d', '--wait', 'db']);
const runningApi = await compose(['ps', '-q', '--status', 'running', 'api']);
// Only container-id lines count.
if (runningApi.split('\n').some((line) => /^[a-f0-9]{12,64}$/.test(line)))
  throw new Error('Stop the Docker API before importing.');
const targetTables = await compose([
  'exec',
  '-T',
  'db',
  'psql',
  '-U',
  'postgres',
  '-d',
  'estateatlas',
  '-Atc',
  "SELECT count(*) FROM pg_tables WHERE schemaname NOT IN ('pg_catalog','information_schema')",
]);
if (targetTables.split('\n').at(-1) !== '0')
  throw new Error('Import refused: Docker database is not empty. Nothing was overwritten.');
const backupDir = path.join(root, '.local/backups');
mkdirSync(backupDir, { recursive: true, mode: 0o700 });
const backup = path.join(
  backupDir,
  `before-docker-${new Date().toISOString().replaceAll(':', '-')}.dump`,
);
const client = new pg.Client({ connectionString: source.toString() });
await client.connect();
let expected;
try {
  await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  expected = JSON.parse((await client.query(countsSql)).rows[0].json_build_object);
  const snapshot = (await client.query('SELECT pg_export_snapshot()')).rows[0].pg_export_snapshot;
  const fd = openSync(backup, 'wx', 0o600);
  try {
    await run(
      'docker',
      [
        'run',
        '--rm',
        '--network',
        'host',
        ...['PGHOST', 'PGPORT', 'PGUSER', 'PGPASSWORD', 'PGDATABASE'].flatMap((k) => ['--env', k]),
        'postgres:18.4-bookworm',
        'pg_dump',
        '--format=custom',
        '--no-owner',
        '--no-acl',
        `--snapshot=${snapshot}`,
      ],
      {
        env: {
          ...process.env,
          PGHOST: source.hostname,
          PGPORT: source.port,
          PGUSER: decodeURIComponent(source.username),
          PGPASSWORD: decodeURIComponent(source.password),
          PGDATABASE: decodeURIComponent(source.pathname.slice(1)),
        },
        stdio: ['ignore', fd, 'inherit'],
      },
    );
  } finally {
    closeSync(fd);
  }
  await client.query('COMMIT');
  writeFileSync(
    backup + '.json',
    JSON.stringify({ createdAt: new Date().toISOString(), tables: expected }, null, 2) + '\n',
    { mode: 0o600 },
  );
} finally {
  await client.end();
}
const input = openSync(backup, 'r');
try {
  await compose(
    [
      'exec',
      '-T',
      'db',
      'pg_restore',
      '-U',
      'postgres',
      '--role=estateatlas',
      '-d',
      'estateatlas',
      '--no-owner',
      '--no-acl',
      '--clean',
      '--if-exists',
      '--single-transaction',
      '--exit-on-error',
    ],
    { stdio: [input, 'pipe', 'inherit'] },
  );
} finally {
  closeSync(input);
}
const restoredText = await compose([
  'exec',
  '-T',
  'db',
  'psql',
  '-U',
  'postgres',
  '-d',
  'estateatlas',
  '-Atc',
  countsSql,
]);
const restored = JSON.parse(restoredText.split('\n').at(-1));
if (JSON.stringify(restored) !== JSON.stringify(expected))
  throw new Error(
    'Restored row counts do not match. Do not start the app; the original database and backup remain intact.',
  );
console.log(
  'Import completed and all table row counts verified. Original database and private backup are retained.',
);
console.log('Keep the original app paused until Docker Web/API have been verified.');
