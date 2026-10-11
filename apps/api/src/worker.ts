import { writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { database } from './database';
import { connectionString } from './runtime-config';
import { analysisRuntime } from './analysis/provider';
import { AnalysisRunner } from './analysis/runner';
const pool = database(await connectionString(process.env));
const runner = new AnalysisRunner(pool, await analysisRuntime(process.env));
let stopping = false;
const stop = () => {
  stopping = true;
  runner.stop();
};
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
pool.on('error', () => {
  console.error('Analysis worker database connection failed.');
  stop();
});
const health = async () => {
  try {
    await writeFile('/tmp/analysis-worker-health', String(Date.now()));
  } catch {
    stop();
  }
};
await health();
const heartbeat = setInterval(() => void health(), 5000);
try {
  while (!stopping) {
    await runner.tick();
    if (!stopping) await delay(1000);
  }
} finally {
  clearInterval(heartbeat);
  await pool.end();
}
