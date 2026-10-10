import { spawn } from 'node:child_process';
import dotenv from 'dotenv';
dotenv.config({ quiet: true });
const children = [];
const start = (args) => {
  const child = spawn('pnpm', args, { stdio: 'inherit', env: process.env });
  children.push(child);
  return child;
};
const migrate = start(['db:migrate']);
migrate.on('exit', (code) => {
  if (code) {
    process.exit(code);
  }
  start(['dev:api']);
  start(['dev:web']);
});
let stopping = false;
const stop = () => {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill('SIGTERM');
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
