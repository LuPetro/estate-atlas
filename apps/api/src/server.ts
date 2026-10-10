import dotenv from 'dotenv';
import { database } from './database';
import { createApp } from './app';
dotenv.config({ path: new URL('../../../.env', import.meta.url), quiet: true });
if (!process.env.DATABASE_URL)
  throw new Error('DATABASE_URL fehlt. Zuerst ./scripts/pnpm db:start.');
const pool = database(process.env.DATABASE_URL);
const app = await createApp(pool, {
  origin: process.env.WEB_ORIGIN,
  production: process.env.NODE_ENV === 'production',
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
