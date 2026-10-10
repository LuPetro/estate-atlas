import assert from 'node:assert/strict';
import dotenv from 'dotenv';
import { chromium } from '@playwright/test';

dotenv.config({ quiet: true });
const webUrl = process.env.WEB_ORIGIN ?? 'http://localhost:3000';
const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000').replace(/\/$/, '');
let browser;

try {
  const health = await fetch(`${apiUrl}/health`, { signal: AbortSignal.timeout(10000) });
  assert.equal(health.status, 200, `API: HTTP ${health.status}`);
  assert.equal((await health.json()).status, 'ok');
  console.log('✓ API auf dem Server erreichbar (HTTP 200).');

  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const browserErrors = [];
  page.on('pageerror', (error) => browserErrors.push(error.message));
  const sessionResponse = page.waitForResponse(
    (response) => response.url() === `${apiUrl}/auth/me`,
    { timeout: 20000 },
  );
  // Attach the rejection handler before navigation to avoid an unhandled timeout.
  const sessionCheck = sessionResponse.then(
    (response) => ({ response }),
    (error) => ({ error }),
  );
  const web = await page.goto(webUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  assert.equal(web?.status(), 200, `Web: HTTP ${web?.status()}`);
  console.log('✓ Web-App im Server-Browser erreichbar (HTTP 200).');

  const session = await sessionCheck;
  if (session.error) throw session.error;
  assert.equal(session.response.status(), 401, 'Ein frischer Browser darf nicht angemeldet sein.');
  await page.getByLabel('E-Mail-Adresse').waitFor({ state: 'visible', timeout: 10000 });
  await page.getByLabel('Passwort').waitFor({ state: 'visible', timeout: 10000 });
  console.log('✓ Web-App erreicht die API; HTTP 401 ist ohne Anmeldung korrekt.');

  const browserHealth = await page.evaluate(async (url) => {
    const response = await fetch(`${url}/health`, {
      credentials: 'include',
      signal: AbortSignal.timeout(10000),
    });
    return { status: response.status, body: await response.json() };
  }, apiUrl);
  assert.equal(browserHealth.status, 200);
  assert.equal(browserHealth.body.status, 'ok');
  assert.deepEqual(browserErrors, [], 'JavaScript-Fehler im Browser.');
  console.log('✓ Browser → API inklusive CORS funktioniert. Anmeldeformular ist sichtbar.');
  console.log('Keine Benutzer oder Immobilien erstellt; bestehende Daten bleiben unverändert.');
} catch (error) {
  console.error(`Web-Prüfung fehlgeschlagen: ${error.message}`);
  console.error('Datenbank und ./scripts/pnpm dev müssen laufen.');
  process.exitCode = 1;
} finally {
  await browser?.close();
}
