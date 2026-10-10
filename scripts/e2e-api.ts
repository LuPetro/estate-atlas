import EmbeddedPostgres from 'embedded-postgres';
import { randomBytes } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { database, migrate } from '../apps/api/src/database';
import { createApp } from '../apps/api/src/app';
const root = resolve('.local');
mkdirSync(root, { recursive: true });
const password = randomBytes(24).toString('hex');
const server = new EmbeddedPostgres({
  databaseDir: resolve(root, `e2e-postgres-${process.pid}`),
  user: 'estateatlas_e2e',
  password,
  port: 55434,
  persistent: false,
  authMethod: 'scram-sha-256',
  createPostgresUser: false,
  postgresFlags: ['-h', '127.0.0.1', '-k', root],
  onLog: () => {},
  onError: () => {},
});
await server.initialise();
await server.start();
await server.createDatabase('estateatlas_e2e');
const pool = database(`postgresql://estateatlas_e2e:${password}@127.0.0.1:55434/estateatlas_e2e`);
await migrate(pool);
const app = await createApp(pool);
await app.listen({ host: '127.0.0.1', port: 4000 });
let stopping = false;
const stop = async () => {
  if (stopping) return;
  stopping = true;
  await app.close();
  await pool.end();
  await server.stop();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
