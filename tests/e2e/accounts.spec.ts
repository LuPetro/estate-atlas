import { test, expect } from '@playwright/test';
import { base32, totp } from '../../apps/api/src/account-security';
const password = 'Account browser test password 1234';
const mfaCode = () =>
  totp(base32(Buffer.from('12345678901234567890')), Math.floor(Date.now() / 30000));
test.beforeEach(async ({ page }) => {
  await page.route('https://basemaps.cartocdn.com/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'image/png',
      body: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jF6cAAAAASUVORK5CYII=',
        'base64',
      ),
    }),
  );
});
test('account profile, session list, email verification, export and reset work in the browser', async ({
  page,
  request,
}) => {
  const email = `account-browser-${Date.now()}@example.test`;
  await page.goto('/');
  await page.getByRole('button', { name: 'Konto erstellen', exact: true }).click();
  await page.getByLabel('Dein Name').fill('Synthetic account browser');
  await page.getByLabel('E-Mail-Adresse').fill(email);
  await page.getByLabel('Passwort', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Konto erstellen', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Portfolioübersicht' })).toBeVisible();
  await page.goto('/account');
  await expect(page.getByRole('heading', { name: 'Persönlich. Sicher.' })).toBeVisible();
  const profile = page
    .locator('.account-card')
    .filter({ has: page.getByRole('heading', { name: 'Profil', exact: true }) });
  await profile.getByLabel('Dein Name').fill('Updated browser profile');
  await profile.getByRole('button', { name: 'Profil speichern' }).click();
  await expect(page.getByRole('status')).toContainText('Profil gespeichert');
  await expect(page.locator('.account-session')).toContainText('Diese Sitzung');
  const mails = (await (
    await request.get(`http://localhost:4001/__fixtures/mail?email=${encodeURIComponent(email)}`)
  ).json()) as { purpose: string; token: string }[];
  const token = mails.find((m) => m.purpose === 'verify')!.token;
  await page.goto(`/account-action#purpose=verify&token=${token}`);
  await expect(page.getByLabel('Linkcode')).toHaveValue(token);
  await expect(page).toHaveURL(/\/account-action$/);
  await page.getByRole('button', { name: 'Bestätigen', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('E-Mail bestätigt');
  await page.goto('/account');
  await expect(page.locator('.account-card').first()).toContainText('E-Mail bestätigt');
  const exporter = page
    .locator('.account-card')
    .filter({ has: page.getByRole('heading', { name: 'Deine Daten mitnehmen' }) });
  await exporter.getByLabel('Aktuelles Passwort').fill(password);
  const downloaded = page.waitForEvent('download');
  await exporter.getByRole('button', { name: 'Daten exportieren' }).click();
  expect((await downloaded).suggestedFilename()).toBe('estateatlas-export.json');
  await page.screenshot({ path: `work/account-${test.info().project.name}.png`, fullPage: true });
  await page.goto('/account-action');
  await page.getByLabel('E-Mail-Adresse').fill(email);
  await page.getByRole('button', { name: 'Bestätigen', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Falls ein aktives Konto');
  const resetMails = await (
    await request.get(`http://localhost:4001/__fixtures/mail?email=${encodeURIComponent(email)}`)
  ).json();
  const reset = resetMails.find((m: any) => m.purpose === 'reset').token;
  await page.goto(`/account-action#purpose=reset&token=${reset}`);
  await page.getByLabel('Neues Passwort').fill('New account browser password 5678');
  await page.getByRole('button', { name: 'Bestätigen', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Passwort geändert');
  await page.goto('/account');
  await expect(page.locator('main > p[role="alert"]')).toContainText('Bitte anmelden');
});
test('admin MFA login, search, invitations and audit are usable without exposing property contents', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByLabel('E-Mail-Adresse').fill('admin-browser@example.test');
  await page.getByLabel('Passwort', { exact: true }).fill('Browser fixture password 1234');
  await page.getByLabel('Zwei-Faktor-Code (falls eingerichtet)').fill(mfaCode());
  await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Portfolioübersicht' })).toBeVisible();
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Menschen. Zugang. Überblick.' })).toBeVisible();
  await page.getByLabel('Nutzer suchen').fill('admin-browser');
  await expect(page.locator('.admin-user')).toHaveCount(1);
  await page.locator('.admin-user').click();
  await expect(page.locator('.admin-details')).toContainText('Zwei-Faktor-Anmeldung');
  await page.getByRole('button', { name: 'Einladungen', exact: true }).click();
  const creator = page
    .locator('.account-card')
    .filter({ has: page.getByRole('heading', { name: 'Beta-Einladungen', exact: true }) });
  await creator.getByLabel('E-Mail-Bindung (optional)').fill('invited-browser@example.test');
  await creator.getByLabel('Aktuelles Passwort').fill('Browser fixture password 1234');
  await creator.getByLabel('Zwei-Faktor- oder Wiederherstellungscode').fill(mfaCode());
  await creator.getByRole('button', { name: 'Einladung erstellen' }).click();
  await expect(page.locator('.secret-code')).toBeVisible();
  await expect(page.locator('.account-session')).toContainText('invited-browser@example.test');
  await page.getByRole('button', { name: 'Auditprotokoll' }).click();
  await expect(page.locator('.audit-event').filter({ hasText: 'beta.invited' })).toBeVisible();
  await page.screenshot({ path: `work/admin-${test.info().project.name}.png`, fullPage: true });
});
