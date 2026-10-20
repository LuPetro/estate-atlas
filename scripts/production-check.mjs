import { readFile, stat, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { parse } from 'dotenv';
import {
  sourceRoot as root,
  configuration,
  stateRoot,
  backups,
  environment,
} from './environment-paths.mjs';
export function releaseErrors(env, site) {
  const errors = [];
  const domain = env.PUBLIC_DOMAIN ?? '';
  if (
    !/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/.test(domain) ||
    /(?:\.test|\.example|\.localhost|your-domain\.tld|example\.(com|org|net))$/.test(domain)
  )
    errors.push('PUBLIC_DOMAIN: echte kanonische Domain erforderlich.');
  for (const name of ['WEB_ORIGIN', 'ACCOUNT_PUBLIC_URL'])
    if (env[name] !== `https://${domain}`)
      errors.push(`${name}: muss exakt https://PUBLIC_DOMAIN entsprechen.`);
  if (env.NEXT_PUBLIC_API_URL !== '/api')
    errors.push('NEXT_PUBLIC_API_URL: /api für die gemeinsame Web-Adresse setzen.');
  if (env.ALLOW_LOCAL_HTTP !== 'false' || env.TRUST_PROXY !== '1')
    errors.push('HTTPS-Cookies und genau ein kontrollierter Proxy-Hop erforderlich.');
  if (env.ACCOUNT_REQUIRE_VERIFICATION !== 'true')
    errors.push('E-Mail-Verifizierung muss für den öffentlichen Betrieb aktiv sein.');
  if (!env.SMTP_HOST || !env.SMTP_FROM || !env.SMTP_USER || env.SMTP_ALLOW_INSECURE === 'true')
    errors.push('Authentifizierten SMTP-Versand mit TLS einrichten.');
  if (env.SMTP_SECURE === 'true' ? env.SMTP_PORT !== '465' : env.SMTP_PORT !== '587')
    errors.push('SMTP-Port und TLS-Modus prüfen (465/TLS oder 587/STARTTLS).');
  for (const name of ['ACME_EMAIL', 'OPS_ALERT_EMAIL'])
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(env[name] ?? ''))
      errors.push(`${name}: gültige Betreiberadresse erforderlich.`);
  if (env.SMTP_DELIVERY_CONFIRMED !== 'true')
    errors.push('SMTP_DELIVERY_CONFIRMED: echte Zustellung vor Veröffentlichung prüfen.');
  for (const [name, max] of [
    ['MAX_PROPERTIES_PER_ACCOUNT', 10000],
    ['MAX_ACCOUNT_STORAGE_MB', 10000],
    ['MAX_TOTAL_STORAGE_MB', 100000],
    ['AUDIT_RETENTION_DAYS', 730],
  ])
    if (
      !Number.isSafeInteger(Number(env[name])) ||
      Number(env[name]) < (name === 'AUDIT_RETENTION_DAYS' ? 7 : 1) ||
      Number(env[name]) > max
    )
      errors.push(`${name}: begrenzten positiven Wert konfigurieren.`);
  if (
    env.ANALYSIS_ENABLED === 'true' &&
    (!(Number(env.ANALYSIS_USER_DAILY_LIMIT) > 0) || !(Number(env.ANALYSIS_GLOBAL_DAILY_LIMIT) > 0))
  )
    errors.push('Öffentliche KI-Recherche braucht positive Konto- und Gesamtbudgets.');
  for (const name of [
    'operator',
    'address',
    'supportEmail',
    'privacyEmail',
    'hostingProvider',
    'hostingRegion',
    'legalNotice',
    'privacyNotice',
    'terms',
  ])
    if (typeof site[name] !== 'string' || !site[name].trim())
      errors.push(`site.json: ${name} fehlt.`);
  for (const name of ['supportEmail', 'privacyEmail'])
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(site[name] ?? ''))
      errors.push(`site.json: ${name} ist keine gültige Adresse.`);
  for (const name of ['address', 'hostingRegion', 'legalNotice', 'privacyNotice', 'terms'])
    if (/\b(entwurf|platzhalter|tbd|noch einzutragen|noch zu verifizieren|noch offen)\b/i.test(site[name] ?? ''))
      errors.push(`site.json: ${name} enthält noch einen offenen Platzhalter.`);
  if (site.reviewed !== true)
    errors.push('site.json: Betreiber muss veröffentlichte Texte prüfen und reviewed=true setzen.');
  return errors;
}
async function run() {
  const env = { ...parse(await readFile(path.join(configuration, 'compose.env'))), ...process.env };
  const site = JSON.parse(await readFile(path.join(configuration, 'site.json'), 'utf8'));
  const errors = releaseErrors(env, site);
  if (
    environment === 'production' &&
    env.POSTGRES_VOLUME_NAME !== 'estate-atlas-production_postgres_data'
  )
    errors.push('Production requires its own estate-atlas-production_postgres_data volume.');
  for (const name of [
    'smtp-password',
    'postgres-admin-password',
    'postgres-app-password',
    'account-encryption-key',
  ]) {
    const value = (await readFile(path.join(configuration, name), 'utf8')).trim();
    if (!value || (name === 'account-encryption-key' && !/^[a-f0-9]{64}$/.test(value)))
      errors.push(`Secret ${name} fehlt oder ist ungültig.`);
  }
  if (!process.argv.includes('--config-only')) {
    const dir = backups;
    const dumps = (await readdir(dir))
      .filter((name) => /^estateatlas-\d{8}T\d{6}Z\.dump$/.test(name))
      .sort();
    if (
      !dumps.length ||
      Date.now() - (await stat(path.join(dir, dumps.at(-1)))).mtimeMs > 26 * 3600000
    )
      errors.push('Kein frisches lokales Datenbankbackup (höchstens 26 Stunden).');
    const proof = await readFile(path.join(stateRoot, 'backups/restore-check.json'), 'utf8')
      .then(JSON.parse)
      .catch(() => null);
    if (
      !proof ||
      Date.now() - Date.parse(proof.checkedAt) > 7 * 86400000 ||
      !Number.isFinite(Date.parse(proof.checkedAt))
    )
      errors.push(
        'Isolierte Wiederherstellungsprobe fehlt oder ist älter als sieben Tage: ./scripts/check-backup',
      );
    const check = spawnSync(
      path.join(root, 'scripts/docker'),
      [
        'exec',
        '-T',
        'db',
        'psql',
        '-U',
        'postgres',
        '-d',
        'estateatlas',
        '-X',
        '-Atc',
        "SELECT count(*) FROM users WHERE role='admin' AND status='active' AND mfa_secret IS NOT NULL AND email_verified_at IS NOT NULL;",
      ],
      { encoding: 'utf8' },
    );
    if (check.status !== 0 || !(Number(check.stdout.trim()) > 0))
      errors.push(
        'Mindestens ein aktiver Admin mit bestätigter E-Mail und eingerichteter 2FA erforderlich.',
      );
  }
  if (errors.length) {
    console.error(
      'Veröffentlichung noch nicht freigegeben:\n' + errors.map((error) => `- ${error}`).join('\n'),
    );
    process.exitCode = 1;
    return;
  }
  if (process.argv.includes('--live')) {
    for (const endpoint of [
      '/api/health',
      '/manifest.webmanifest',
      '/legal',
      '/privacy',
      '/support',
      '/install',
      '/sw.js',
    ]) {
      const response = await fetch(`${env.WEB_ORIGIN}${endpoint}`, {
        redirect: 'error',
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw new Error(`Live-Prüfung fehlgeschlagen: ${endpoint}`);
      if (
        endpoint === '/api/health' &&
        !(response.headers.get('cache-control') ?? '').includes('no-store')
      )
        throw new Error('API no-store fehlt.');
    }
  }
  console.log(
    'Produktionsprüfung bestanden. Öffentliche DNS-/TLS-Erreichbarkeit nach Freischaltung mit --live prüfen; externe Sicherung und externer Uptime-Monitor bleiben vorerst zurückgestellt.',
  );
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  run().catch(() => {
    console.error(
      'Produktionsprüfung konnte nicht abgeschlossen werden. Dateien, Docker-Zugriff und Netzwerk prüfen. Keine Geheimnisse wurden ausgegeben.',
    );
    process.exitCode = 1;
  });
