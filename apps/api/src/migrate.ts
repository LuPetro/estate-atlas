import dotenv from 'dotenv';
import { database, migrate } from './database';
import { connectionString } from './runtime-config';
dotenv.config({ path: new URL('../../../.env', import.meta.url), quiet: true });
const pool = database(await connectionString(process.env));
try {
  await migrate(pool);
  console.log('Database migrations applied.');
} finally {
  await pool.end();
}
