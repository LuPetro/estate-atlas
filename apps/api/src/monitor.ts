import { readdir, stat, writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { accountRuntime } from './account-runtime';
const runtime = await accountRuntime(
  { ...process.env, ACCOUNT_ENCRYPTION_KEY_FILE: undefined },
  false,
);
const recipient = process.env.OPS_ALERT_EMAIL;
if (recipient && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient))
  throw new Error('Invalid OPS_ALERT_EMAIL');
let previous: string | undefined;
let lastAlert = 0;
const controller = new AbortController();
const stop = () => controller.abort();
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
try {
  while (!controller.signal.aborted) {
    const failures: string[] = [];
    for (const [name, url] of [
      ['API', 'http://api:4000/health'],
      ['Web', 'http://web:3000/'],
      ['Recherche-Worker', 'http://worker:4002/health'],
    ]) {
      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
        if (!response.ok) failures.push(name);
      } catch {
        failures.push(name);
      }
    }
    try {
      const files = (await readdir('/backups'))
        .filter((name) => /^estateatlas-\d{8}T\d{6}Z\.dump$/.test(name))
        .sort();
      if (
        !files.length ||
        Date.now() - (await stat(`/backups/${files.at(-1)}`)).mtimeMs > 26 * 3600000
      )
        failures.push('Backup');
    } catch {
      failures.push('Backup');
    }
    const state = failures.length ? failures.join(', ') : 'ok';
    if (state !== previous || (state !== 'ok' && Date.now() - lastAlert >= 86400000)) {
      console.log(`EstateAtlas operational check: ${state}`);
      // One alert per state change, daily reminder on continuing failure, no private content.
      if (recipient && runtime.mail && (state !== 'ok' || previous !== undefined)) {
        try {
          await runtime.mail({
            to: recipient,
            purpose: 'notice',
            text:
              state === 'ok'
                ? 'EstateAtlas: Web, API, Recherche-Worker und lokales Backup sind wieder erreichbar.'
                : `EstateAtlas: Betriebsprüfung fehlgeschlagen (${state}). Prüfe Docker-Healthchecks und Logs auf dem Server.`,
          });
        } catch {
          console.error('Operational notification could not be delivered.');
        } finally {
          lastAlert = Date.now();
        }
      }
      previous = state;
    }
    await writeFile('/tmp/monitor-health', String(Date.now()));
    await delay(60000, undefined, { signal: controller.signal }).catch(() => {});
  }
} finally {
  stop();
}
