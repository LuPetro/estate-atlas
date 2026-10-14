import { readFile } from 'node:fs/promises';

export function browserSecurity(env: NodeJS.ProcessEnv) {
  const origin = env.WEB_ORIGIN ?? 'http://localhost:3000';
  const localHttp = env.ALLOW_LOCAL_HTTP === 'true';
  const url = new URL(origin);
  if (
    url.origin !== origin ||
    url.username ||
    url.password ||
    !['http:', 'https:'].includes(url.protocol)
  )
    throw new Error('WEB_ORIGIN must be an exact HTTP(S) origin.');
  if (env.NODE_ENV === 'production' && !localHttp && url.protocol !== 'https:')
    throw new Error('Public production WEB_ORIGIN requires HTTPS.');
  if (localHttp) {
    if (
      url.protocol !== 'http:' ||
      !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
      url.origin !== origin
    )
      throw new Error('ALLOW_LOCAL_HTTP is restricted to an exact localhost HTTP origin.');
  }
  return { origin, production: env.NODE_ENV === 'production' && !localHttp };
}

export function operationLimits(env: NodeJS.ProcessEnv) {
  const integer = (name: string, fallback: number, maximum: number) => {
    const value = env[name] === undefined ? fallback : Number(env[name]);
    if (!Number.isSafeInteger(value) || value < 1 || value > maximum)
      throw new Error(`Invalid ${name}`);
    return value;
  };
  if (env.TRUST_PROXY && env.TRUST_PROXY !== '1')
    throw new Error('TRUST_PROXY supports only one controlled proxy hop.');
  return {
    proxy: env.TRUST_PROXY === '1',
    maxProperties: integer('MAX_PROPERTIES_PER_ACCOUNT', 100, 10000),
    maxAccountStorage: integer('MAX_ACCOUNT_STORAGE_MB', 250, 10000) * 1024 * 1024,
    maxTotalStorage: integer('MAX_TOTAL_STORAGE_MB', 2048, 100000) * 1024 * 1024,
  };
}

export async function connectionString(env: NodeJS.ProcessEnv) {
  if (env.DATABASE_URL) return env.DATABASE_URL;
  if (!env.DATABASE_PASSWORD_FILE)
    throw new Error('DATABASE_URL or DATABASE_PASSWORD_FILE is required.');
  const password = (await readFile(env.DATABASE_PASSWORD_FILE, 'utf8')).trim();
  if (!password) throw new Error('Database password file is empty.');
  const url = new URL('postgresql://db:5432/estateatlas');
  url.hostname = env.DATABASE_HOST ?? 'db';
  url.port = env.DATABASE_PORT ?? '5432';
  url.pathname = '/' + (env.DATABASE_NAME ?? 'estateatlas');
  url.username = env.DATABASE_USER ?? 'estateatlas';
  url.password = password;
  return url.toString();
}
