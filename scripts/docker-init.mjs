import { mkdirSync, writeFileSync, existsSync, chmodSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const dir = path.join(root, '.local/docker');
mkdirSync(dir, { recursive: true, mode: 0o700 });
chmodSync(dir, 0o700);
for (const name of ['postgres-admin-password', 'postgres-app-password']) {
  const file = path.join(dir, name);
  if (!existsSync(file))
    writeFileSync(file, randomBytes(32).toString('hex') + '\n', { flag: 'wx', mode: 0o644 });
  // Compose mounts file secrets without remapping the host UID. The parent is
  // private on the host; containers need to read the mounted file as non-root.
  chmodSync(file, 0o644);
}
const env = path.join(dir, 'compose.env');
if (!existsSync(env))
  writeFileSync(
    env,
    'WEB_ORIGIN=http://localhost:3000\nNEXT_PUBLIC_API_URL=http://localhost:4000\nWEB_PORT=3000\nAPI_PORT=4000\nALLOW_LOCAL_HTTP=true\n',
    { flag: 'wx', mode: 0o600 },
  );
console.error(
  'Docker configuration initialized; existing secrets and the original .env are preserved.',
);
