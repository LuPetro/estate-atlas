import { writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { database } from './database';
import { connectionString } from './runtime-config';
import { cleanupExpired } from './maintenance-rules';
const retention = Number(process.env.AUDIT_RETENTION_DAYS ?? 180);
if (!Number.isInteger(retention) || retention < 7 || retention > 730)
  throw new Error('Invalid AUDIT_RETENTION_DAYS');
const pool = database(await connectionString(process.env));
let stopping = false;
const controller = new AbortController();
const stop = () => {
  stopping = true;
  controller.abort();
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
pool.on('error', () => {
  console.error('Maintenance database connection unavailable.');
  stop();
});
let nextCleanup = 0;
try {
  while (!stopping) {
    if (Date.now() >= nextCleanup) {
      await cleanupExpired(pool, retention);
      console.log('Expired credentials and retention cleanup completed.');
      nextCleanup = Date.now() + 86400000;
    }
    await pool.query('SELECT 1');
    await writeFile('/tmp/maintenance-health', String(Date.now()));
    await delay(30000, undefined, { signal: controller.signal }).catch(() => {});
  }
} finally {
  await pool.end();
}
