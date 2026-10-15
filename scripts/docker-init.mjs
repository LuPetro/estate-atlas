import { mkdirSync, writeFileSync, existsSync, chmodSync, statSync, readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import {
  sourceRoot as root,
  configuration as dir,
  backups as backupDir,
} from './environment-paths.mjs';
// A key entered from an administrator shell may have a different owner.
// Avoid requiring ownership just to read an already correctly protected secret.
const ensureMode = (file, mode) => {
  if ((statSync(file).mode & 0o777) !== mode) chmodSync(file, mode);
};
mkdirSync(dir, { recursive: true, mode: 0o700 });
chmodSync(dir, 0o700);
for (const name of ['postgres-admin-password', 'postgres-app-password', 'account-encryption-key']) {
  const file = path.join(dir, name);
  if (!existsSync(file))
    writeFileSync(file, randomBytes(32).toString('hex') + '\n', { flag: 'wx', mode: 0o644 });
  // Compose mounts file secrets without remapping the host UID. The parent is
  // private on the host; containers need to read the mounted file as non-root.
  ensureMode(file, 0o644);
}
const openai = path.join(dir, 'openai-api-key');
if (!existsSync(openai)) writeFileSync(openai, '', { flag: 'wx', mode: 0o644 });
ensureMode(openai, 0o644);
const smtp = path.join(dir, 'smtp-password');
if (!existsSync(smtp)) writeFileSync(smtp, '', { flag: 'wx', mode: 0o644 });
ensureMode(smtp, 0o644);
mkdirSync(backupDir, { recursive: true, mode: 0o700 });
writeFileSync(
  path.join(dir, 'backup-user.env'),
  `BACKUP_UID=${process.getuid()}\nBACKUP_GID=${process.getgid()}\n`,
  { mode: 0o600 },
);
const env = path.join(dir, 'compose.env');
const site = path.join(dir, 'site.json');
if (!existsSync(site))
  writeFileSync(site, readFileSync(path.join(root, 'config/site.example.json')), {
    flag: 'wx',
    mode: 0o644,
  });
if (!existsSync(env))
  writeFileSync(
    env,
    'WEB_ORIGIN=http://localhost:3000\nNEXT_PUBLIC_API_URL=http://localhost:4000\nWEB_PORT=3000\nAPI_PORT=4000\nALLOW_LOCAL_HTTP=true\n',
    { flag: 'wx', mode: 0o600 },
  );
console.error(
  'Docker configuration initialized; existing secrets and the original .env are preserved.',
);
