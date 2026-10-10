import dotenv from 'dotenv';
import { database, migrate } from './database';
dotenv.config({ path: new URL('../../../.env', import.meta.url), quiet: true });
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL fehlt.');
const pool = database(process.env.DATABASE_URL);
try {
  await migrate(pool);
  console.log('Database migrations applied.');
} finally {
  await pool.end();
}
