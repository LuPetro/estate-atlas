import dotenv from 'dotenv';
import { database } from './database';
import { createApp } from './app';
import { browserSecurity, connectionString } from './runtime-config';
dotenv.config({ path: new URL('../../../.env', import.meta.url), quiet: true });
const pool = database(await connectionString(process.env));
const app = await createApp(pool, {
  ...browserSecurity(process.env),
  logging: true,
  geocodingUrl: process.env.GEOCODING_URL,
});
await app.listen({
  host: process.env.API_HOST ?? '127.0.0.1',
  port: Number(process.env.API_PORT ?? 4000),
});
let stopping = false;
const stop = async () => {
  if (stopping) return;
  stopping = true;
  await app.close();
  await pool.end();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
