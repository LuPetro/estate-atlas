import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const command = fileURLToPath(new URL('./docker', import.meta.url));
const child = spawn(command, ['up', '-d', '--build', '--wait'], { stdio: 'inherit' });
child.on('error', (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.on('exit', (code) => {
  process.exitCode = code ?? 1;
});
