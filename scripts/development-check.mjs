import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'dotenv';
import { configuration, operationsRoot, environment } from './environment-paths.mjs';

export function developmentErrors(env, gateway) {
  const errors = [];
  if (env.PUBLIC_DOMAIN !== 'dev.estateatlas.app' || gateway.DEV_DOMAIN !== env.PUBLIC_DOMAIN)
    errors.push('Development must use dev.estateatlas.app.');
  for (const key of ['WEB_ORIGIN', 'ACCOUNT_PUBLIC_URL'])
    if (env[key] !== `https://${env.PUBLIC_DOMAIN}`)
      errors.push(`${key}: development HTTPS required.`);
  if (
    env.ALLOW_LOCAL_HTTP !== 'false' ||
    env.TRUST_PROXY !== '1' ||
    env.NEXT_PUBLIC_API_URL !== '/api'
  )
    errors.push('Development requires HTTPS cookies, /api and exactly one proxy hop.');
  if (env.REGISTRATION_MODE !== 'invite') errors.push('Development remains invite-only.');
  if (!gateway.DEV_ACCESS_USER || !/^\$2[aby]\$\d\d\$.{53}$/.test(gateway.DEV_AUTH_HASH || ''))
    errors.push('Development requires the additional gateway password.');
  if (
    !env.POSTGRES_VOLUME_NAME ||
    !/development|^estate-atlas_postgres_data$/.test(env.POSTGRES_VOLUME_NAME)
  )
    errors.push('Development cannot use a production database volume.');
  if (env.SMTP_HOST)
    errors.push('Development mail delivery must remain disabled until configured separately.');
  return errors;
}

if (process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname) {
  try {
    if (environment !== 'development') throw new Error('Development context required.');
    const env = {
      ...parse(await readFile(path.join(configuration, 'compose.env'))),
      ...process.env,
    };
    const gateway = parse(await readFile(path.join(operationsRoot, '.local/gateway/compose.env')));
    const errors = developmentErrors(env, gateway);
    if (errors.length) throw new Error(errors.join('\n'));
    if (process.argv.includes('--live')) {
      const password = (
        await readFile(path.join(operationsRoot, '.local/gateway/access-password'), 'utf8')
      ).trim();
      const headers = {
        Authorization: `Basic ${Buffer.from(`${gateway.DEV_ACCESS_USER}:${password}`).toString('base64')}`,
      };
      for (const endpoint of ['/api/health', '/manifest.webmanifest', '/']) {
        const url = `${env.WEB_ORIGIN}${endpoint}`;
        const unauthenticated = await fetch(url, {
          redirect: 'manual',
          signal: AbortSignal.timeout(15000),
        });
        if (unauthenticated.status !== 401)
          throw new Error('Development gateway is not protected.');
        const response = await fetch(url, {
          headers,
          redirect: 'error',
          signal: AbortSignal.timeout(15000),
        });
        if (!response.ok || !response.headers.get('x-robots-tag')?.includes('noindex'))
          throw new Error(`Development HTTPS check failed: ${endpoint}`);
        if (endpoint === '/api/health' && (await response.json()).status !== 'ok')
          throw new Error('Development API health response is invalid.');
      }
    }
    console.log('Private development checks passed. SMTP/legal production checks remain separate.');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
