import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
dotenv.config({ quiet: true });
const resolve = createRequire(import.meta.url).resolve;
const root = fileURLToPath(new URL('../', import.meta.url));
const children = [];
let stopping = false;
const start = (args, cwd = root) => {
  // Invoke each CLI directly instead of retaining several nested pnpm processes.
  // This leaves memory available for the apps on small VPS instances.
  const child = spawn(process.execPath, args, { cwd, stdio: 'inherit', env: process.env });
  children.push(child);
  return child;
};
const migrate = start([resolve('tsx/cli'), 'apps/api/src/migrate.ts']);
migrate.on('exit', (code) => {
  if (stopping) return;
  if (code) {
    process.exit(code);
  }
  start([resolve('tsx/cli'), 'watch', 'apps/api/src/server.ts']);
  start(
    [resolve('next/dist/bin/next'), 'dev', '--hostname', '127.0.0.1'],
    fileURLToPath(new URL('../apps/web/', import.meta.url)),
  );
});
const stop = () => {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill('SIGTERM');
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
