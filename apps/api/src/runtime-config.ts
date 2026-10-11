import { readFile } from 'node:fs/promises';

export function browserSecurity(env: NodeJS.ProcessEnv) {
  const origin = env.WEB_ORIGIN ?? 'http://localhost:3000';
  const localHttp = env.ALLOW_LOCAL_HTTP === 'true';
  if (localHttp) {
    const url = new URL(origin);
    if (
      url.protocol !== 'http:' ||
      !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
      url.origin !== origin
    )
      throw new Error('ALLOW_LOCAL_HTTP is restricted to an exact localhost HTTP origin.');
  }
  return { origin, production: env.NODE_ENV === 'production' && !localHttp };
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
