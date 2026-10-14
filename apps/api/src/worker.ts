import { writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { database } from './database';
import { connectionString } from './runtime-config';
import { analysisRuntime } from './analysis/provider';
import { AnalysisRunner } from './analysis/runner';
import { createServer } from 'node:http';
const pool = database(await connectionString(process.env));
const runner = new AnalysisRunner(pool, await analysisRuntime(process.env));
let stopping = false;
let heartbeatAt = Date.now();
// Docker network only; no host port or provider/key information exposed.
const healthServer = createServer((request, response) => {
  response.setHeader('Cache-Control', 'no-store');
  response.writeHead(
    request.url !== '/health' ? 404 : stopping || Date.now() - heartbeatAt > 20000 ? 503 : 200,
  );
  response.end();
});
healthServer.listen(4002, '0.0.0.0');
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
    heartbeatAt = Date.now();
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
  healthServer.close();
  clearInterval(heartbeat);
  await pool.end();
}
