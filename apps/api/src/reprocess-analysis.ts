import { z } from 'zod';
import { database } from './database';
import { connectionString } from './runtime-config';
import { reprocessAnalysis } from './analysis/reprocess';
// Docker-only maintenance entry point. Exact owner/job IDs arrive over stdin.
// Credentials and private reports are never printed. Nothing calls OpenAI.
let data = '';
for await (const chunk of process.stdin) {
  data += chunk;
  if (data.length > 1000) throw new Error('Maintenance input exceeds limit.');
}
const request = z.object({ jobId: z.uuid(), ownerId: z.uuid() }).strict().parse(JSON.parse(data));
const pool = database(await connectionString(process.env));
try {
  const job = await reprocessAnalysis(pool, request.jobId, request.ownerId);
  console.log(
    JSON.stringify({
      status: job.status,
      accepted: job.diagnostics?.accepted,
      websites: job.diagnostics?.websites,
      exclusions: job.diagnostics?.exclusions,
      reason: job.reason,
    }),
  );
} catch {
  console.error('Maintenance repair failed. No new research was started.');
  process.exitCode = 1;
} finally {
  await pool.end();
}
