// One-time adoption of the existing private test data. Never copies Dev data to Prod.
import { mkdir, readFile, writeFile, copyFile, cp, access, chmod } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { parse } from 'dotenv';
import { operationsRoot as root } from './environment-paths.mjs';

const exists = async (file) =>
  access(file).then(
    () => true,
    () => false,
  );
const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, { encoding: 'utf8', ...options });
  if (result.status !== 0) throw new Error(`${command} failed; no credentials were printed.`);
  return result.stdout?.trim();
};
const serialize = (env) =>
  Object.entries(env)
    .map(([k, v]) => `${k}='${String(v).replaceAll("'", "\\'")}'`)
    .join('\n') + '\n';
const legacy = path.join(root, '.local/docker');
const old = parse(await readFile(path.join(legacy, 'compose.env')));
const contact = old.ACME_EMAIL;
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact || '')) throw new Error('Set ACME_EMAIL first.');
const gateway = path.join(root, '.local/gateway');
await mkdir(gateway, { recursive: true, mode: 0o700 });
await mkdir(path.join(gateway, 'config'), { recursive: true, mode: 0o755 });
// Only Caddyfiles are mounted. The root container has no DAC override capability.
await chmod(path.join(gateway, 'config'), 0o755);
if (!(await exists(path.join(gateway, 'compose.env')))) {
  const password = randomBytes(24).toString('base64url');
  const hash = run(
    'docker',
    ['run', '--rm', '-i', 'caddy:2.11.2-alpine', 'caddy', 'hash-password'],
    { input: password + '\n' },
  );
  if (!/^\$2[aby]\$\d\d\$.{53}$/.test(hash))
    throw new Error('Caddy did not return a password hash.');
  await writeFile(path.join(gateway, 'access-password'), password + '\n', {
    flag: 'wx',
    mode: 0o600,
  });
  await writeFile(
    path.join(gateway, 'compose.env'),
    serialize({
      DEV_DOMAIN: 'dev.estateatlas.app',
      PROD_DOMAIN: 'estateatlas.app',
      ACME_EMAIL: contact,
      DEV_ACCESS_USER: 'estateatlas-dev',
      DEV_AUTH_HASH: hash,
    }),
    { flag: 'wx', mode: 0o600 },
  );
}
if (!(await exists(path.join(gateway, 'config/production.caddy'))))
  await writeFile(
    path.join(gateway, 'config/production.caddy'),
    '# Production is not published.\n',
  );

for (const environment of ['development', 'production']) {
  const state = path.join(root, '.local/environments', environment);
  const config = path.join(state, 'docker');
  await mkdir(config, { recursive: true, mode: 0o700 });
  if (!(await exists(path.join(config, 'compose.env')))) {
    if (environment === 'development') {
      run('docker', ['volume', 'inspect', 'estate-atlas_postgres_data']);
      for (const name of [
        'postgres-admin-password',
        'postgres-app-password',
        'account-encryption-key',
        'openai-api-key',
        'smtp-password',
        'site.json',
      ])
        await copyFile(path.join(legacy, name), path.join(config, name));
      const env = {
        ...old,
        PUBLIC_DOMAIN: 'dev.estateatlas.app',
        WEB_ORIGIN: 'https://dev.estateatlas.app',
        ACCOUNT_PUBLIC_URL: 'https://dev.estateatlas.app',
        EXPO_PUBLIC_API_URL: 'https://dev.estateatlas.app/api',
        NEXT_PUBLIC_API_URL: '/api',
        WEB_PORT: '3100',
        API_PORT: '4100',
        ALLOW_LOCAL_HTTP: 'false',
        TRUST_PROXY: '1',
        ACCOUNT_REQUIRE_VERIFICATION: 'false',
        POSTGRES_VOLUME_NAME: 'estate-atlas_postgres_data',
      };
      delete env.REGISTRATION_MODE;
      for (const name of Object.keys(env)) if (name.startsWith('SMTP_')) delete env[name];
      await writeFile(path.join(config, 'compose.env'), serialize(env), {
        flag: 'wx',
        mode: 0o600,
      });
      await mkdir(path.join(state, 'backups'), { recursive: true, mode: 0o700 });
      await cp(path.join(root, '.local/backups/automatic'), path.join(state, 'backups/automatic'), {
        recursive: true,
      });
      const proof = path.join(root, '.local/backups/restore-check.json');
      if (await exists(proof))
        await copyFile(proof, path.join(state, 'backups/restore-check.json'));
      await writeFile(
        path.join(state, 'adopt-legacy'),
        'Keep the existing test database volume; stop the legacy stack before starting Dev.\n',
        { mode: 0o600 },
      );
    } else {
      const env = parse(await readFile(path.join(root, 'config/production.env.example')));
      Object.assign(env, {
        PUBLIC_DOMAIN: 'estateatlas.app',
        ACME_EMAIL: contact,
        OPS_ALERT_EMAIL: contact,
        WEB_ORIGIN: 'https://estateatlas.app',
        ACCOUNT_PUBLIC_URL: 'https://estateatlas.app',
        EXPO_PUBLIC_API_URL: 'https://estateatlas.app/api',
        WEB_PORT: '3200',
        API_PORT: '4200',
        POSTGRES_VOLUME_NAME: 'estate-atlas-production_postgres_data',
        ANALYSIS_ENABLED: 'false',
      });
      await writeFile(path.join(config, 'compose.env'), serialize(env), {
        flag: 'wx',
        mode: 0o600,
      });
    }
  }
  run(path.join(root, '.local/node/bin/node'), [path.join(root, 'scripts/docker-init.mjs')], {
    env: { ...process.env, EA_ENVIRONMENT: environment, EA_OPERATIONS_ROOT: root },
  });
}
if (
  spawnSync('docker', ['network', 'inspect', 'estate-atlas-edge'], { stdio: 'ignore' }).status !== 0
)
  run('docker', ['network', 'create', 'estate-atlas-edge']);
console.log('Dev prepared with existing test data. Prod has separate empty secrets/configuration.');
console.log(
  'Gateway user: estateatlas-dev. Password remains in .local/gateway/access-password (mode 600).',
);
