import EmbeddedPostgres from 'embedded-postgres';
import { existsSync, writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';
import dotenv from 'dotenv';
const root = fileURLToPath(new URL('../', import.meta.url));
process.chdir(root);
if (!existsSync('.env')) {
  const password = randomBytes(24).toString('hex');
  writeFileSync(
    '.env',
    `DATABASE_URL=postgresql://estateatlas:${password}@127.0.0.1:55432/estateatlas\nAPI_HOST=127.0.0.1\nAPI_PORT=4000\nWEB_ORIGIN=http://localhost:3000\nNEXT_PUBLIC_API_URL=http://localhost:4000\nEXPO_PUBLIC_API_URL=http://localhost:4000\nNODE_ENV=development\n`,
    { mode: 0o600 },
  );
}
dotenv.config({ path: '.env', quiet: true });
const url = new URL(process.env.DATABASE_URL);
if (!['127.0.0.1', 'localhost'].includes(url.hostname))
  throw new Error(
    'db:start starts only the project-local database. Use external DATABASE_URL with dev:api instead.',
  );
const databaseDir = path.join(root, '.local/postgres');
mkdirSync(path.dirname(databaseDir), { recursive: true });
const server = new EmbeddedPostgres({
  databaseDir,
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  port: Number(url.port),
  persistent: true,
  authMethod: 'scram-sha-256',
  createPostgresUser: false,
  postgresFlags: ['-h', '127.0.0.1', '-k', path.join(root, '.local')],
  onLog: () => {},
  onError: () => {},
});
const probe = new pg.Client({ connectionString: url.toString(), connectionTimeoutMillis: 1000 });
try {
  await probe.connect();
  await probe.end();
  console.log('Project PostgreSQL is already available.');
  process.exit(0);
} catch {
  await probe.end().catch(() => {});
}
if (!existsSync(path.join(databaseDir, 'PG_VERSION'))) await server.initialise();
await server.start();
const client = server.getPgClient();
await client.connect();
const dbName = url.pathname.slice(1);
if (!/^[a-zA-Z0-9_]+$/.test(dbName)) throw new Error('Unsafe database name');
const present = await client.query('SELECT 1 FROM pg_database WHERE datname=$1', [dbName]);
if (!present.rowCount) await server.createDatabase(dbName);
await client.end();
console.log(`PostgreSQL ready on 127.0.0.1:${url.port}. Ctrl+C stops it; data is retained.`);
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  await server.stop();
  process.exit(0);
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
