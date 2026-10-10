import { test, expect, type Page } from '@playwright/test';
const password = 'EstateAtlas browser test password 42';
async function register(page: Page) {
  const email = `browser-${Date.now()}-${Math.random().toString(16).slice(2)}@example.test`;
  await page.goto('/');
  await page.getByRole('button', { name: 'Konto erstellen', exact: true }).click();
  await page.getByLabel('Dein Name').fill('Browser Test');
  await page.getByLabel('E-Mail-Adresse').fill(email);
  await page.getByLabel('Passwort', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Konto erstellen', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Alles im Blick.' })).toBeVisible();
  return email;
}
async function nav(page: Page, label: string) {
  const menu = page.getByRole('button', { name: 'Navigation öffnen' });
  if (await menu.isVisible()) await menu.click();
  await page
    .getByRole('navigation')
    .getByRole('button', { name: new RegExp('^' + label) })
    .click();
}
async function logout(page: Page) {
  if (!(await page.getByRole('button', { name: 'Abmelden' }).isVisible()))
    await page.getByRole('button', { name: 'Navigation öffnen' }).click();
  await page.getByRole('button', { name: 'Abmelden' }).click();
}
async function create(page: Page) {
  await page.getByRole('button', { name: 'Immobilie hinzufügen', exact: true }).click();
  await page.getByLabel('Bezeichnung').fill('Meine echte Testimmobilie');
  await page.getByLabel('Adresse', { exact: true }).fill('Browser Teststraße 1, Wien');
  await page.getByLabel('Breitengrad').fill('48.2082');
  await page.getByLabel('Längengrad').fill('16.3738');
  await page.getByLabel('Kaufpreis').fill('250000');
  await page.getByLabel('Marktwert (eigene Schätzung)').fill('280000');
  await page.getByLabel('Fläche (m²)').fill('75');
  await page.getByRole('button', { name: 'Immobilie speichern' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}
test('registers, creates, edits, persists, archives, restores and deletes a property', async ({
  page,
}) => {
  await register(page);
  await create(page);
  await page.locator('.property-card').filter({ hasText: 'Meine echte Testimmobilie' }).click();
  await expect(
    page.getByRole('dialog').getByRole('heading', { name: 'Meine echte Testimmobilie' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Bearbeiten', exact: true }).click();
  await page.getByLabel('Marktwert (eigene Schätzung)').fill('310000');
  await page.getByRole('button', { name: 'Immobilie speichern' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Alles im Blick.' })).toBeVisible();
  await expect(page.locator('.value-card')).toContainText('310.000');
  await page.locator('.property-card').filter({ hasText: 'Meine echte Testimmobilie' }).click();
  await expect(page.locator('.history>div')).toHaveCount(2);
  await page.getByRole('button', { name: 'Archivieren', exact: true }).click();
  await nav(page, 'Archiv');
  await page.locator('.property-card').filter({ hasText: 'Meine echte Testimmobilie' }).click();
  await page.getByRole('button', { name: 'Wiederherstellen', exact: true }).click();
  await nav(page, 'Immobilien');
  await page.locator('.property-card').filter({ hasText: 'Meine echte Testimmobilie' }).click();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Löschen', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(
    page.locator('.property-card').filter({ hasText: 'Meine echte Testimmobilie' }),
  ).toHaveCount(0);
});
test('labeled fixtures, filters, all views and interactive map use the same portfolio', async ({
  page,
}) => {
  await register(page);
  await page.getByRole('button', { name: 'Testdaten laden', exact: true }).click();
  await expect(page.locator('.property-card')).toHaveCount(4);
  await expect(page.locator('.test-banner')).toContainText('TESTDATEN');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `work/dashboard-${test.info().project.name}.png`, fullPage: true });
  await page.getByLabel('Land filtern', { exact: true }).selectOption('AT');
  await expect(page.locator('.property-card')).toHaveCount(1);
  await page.getByLabel('Land filtern', { exact: true }).selectOption('');
  await page.getByLabel('Immobilien suchen').fill('Berlin');
  await expect(page.locator('.property-card')).toHaveCount(1);
  await page.getByLabel('Immobilien suchen').fill('');
  await page.getByRole('button', { name: 'Listenansicht' }).click();
  await expect(page.locator('.as-list')).toBeVisible();
  await page.getByRole('button', { name: 'Tabellenansicht' }).click();
  await expect(page.locator('tbody tr')).toHaveCount(4);
  await nav(page, 'Weltkarte');
  await expect(page.getByLabel('Interaktive Immobilienkarte')).toBeVisible();
  await expect(page.locator('.leaflet-marker-icon').first()).toBeVisible();
  await page.getByLabel('Land filtern', { exact: true }).selectOption('AT');
  await expect(page.locator('.leaflet-marker-icon')).toHaveCount(1);
  await page.locator('.leaflet-marker-icon').click();
  await expect(page.locator('.map-popup')).toContainText('Wien');
  await page.locator('.map-popup').click();
  await expect(page.getByRole('heading', { name: 'Stadtwohnung · Wien' })).toBeVisible();
});
test('uploads a private photo and records a blocked analysis without inventing a result', async ({
  page,
}) => {
  await register(page);
  await create(page);
  await page.locator('.property-card').filter({ hasText: 'Meine echte Testimmobilie' }).click();
  await page.locator('input[type=file]').setInputFiles({
    name: 'private.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jF6cAAAAASUVORK5CYII=',
      'base64',
    ),
  });
  await expect(page.getByRole('link', { name: 'private.png' })).toBeVisible();
  await page.getByRole('button', { name: 'Analyseauftrag vorbereiten' }).click();
  await expect(page.locator('.analysis-status')).toContainText('Wartet auf Datenquellen');
  const assetUrl = await page.getByRole('link', { name: 'private.png' }).getAttribute('href');
  const anonymous = await page.context().browser()!.newContext();
  expect((await anonymous.request.get(assetUrl!)).status()).toBe(401);
  await anonymous.close();
});
test('logout revokes browser session; another account starts with an empty portfolio', async ({
  page,
}) => {
  const email = await register(page);
  await create(page);
  await logout(page);
  await expect(page.getByRole('button', { name: 'Anmelden', exact: true })).toBeVisible();
  await expect(page.locator('.auth-form .error')).toHaveCount(0);
  await page.getByLabel('E-Mail-Adresse').fill(email);
  await page.getByLabel('Passwort', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
  await expect(
    page.locator('.property-card').filter({ hasText: 'Meine echte Testimmobilie' }),
  ).toBeVisible();
  await logout(page);
  await register(page);
  await expect(page.locator('.property-card')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Dein Portfolio beginnt hier.' })).toBeVisible();
});

test('selects an address, fills GPS and country, adjusts the pin and persists the chosen position', async ({
  page,
}) => {
  await register(page);
  await page.getByRole('button', { name: 'Immobilie hinzufügen', exact: true }).click();
  await page.getByLabel('Bezeichnung').fill('Adresssuche Testobjekt');
  await page.getByLabel('Adresse', { exact: true }).fill('Fixturestraße 1 Berlin');
  const suggestion = page.getByRole('option', { name: /Synthetischer Adresstreffer/ });
  await expect(suggestion).toBeVisible();
  await page.getByLabel('Adresse', { exact: true }).press('ArrowDown');
  await page.getByLabel('Adresse', { exact: true }).press('Enter');
  await expect(page.getByLabel('Adresse', { exact: true })).toHaveValue(
    'Fixturestraße 1, 10115 Berlin, Deutschland',
  );
  await expect(page.getByLabel('Land (ISO-Code)')).toHaveValue('DE');
  await expect(page.getByLabel('Breitengrad')).toHaveValue('52.532');
  await expect(page.getByLabel('Längengrad')).toHaveValue('13.384');
  await expect(
    page.getByRole('listbox', { name: 'Adressvorschläge' }).getByRole('option'),
  ).toHaveCount(0);
  const marker = page.locator('.location-map .leaflet-marker-icon');
  await expect(marker).toBeVisible();
  await marker.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: `work/address-picker-${test.info().project.name}.png`,
    fullPage: true,
  });
  const before = await page.getByLabel('Längengrad').inputValue();
  const box = (await marker.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 35, box.y + box.height / 2 - 20, { steps: 12 });
  await page.mouse.up();
  await expect(page.getByLabel('Längengrad')).not.toHaveValue(before);
  const expectedLatitude = Number(await page.getByLabel('Breitengrad').inputValue());
  const expectedLongitude = Number(await page.getByLabel('Längengrad').inputValue());
  await page.getByLabel('Kaufpreis').fill('100000');
  await page.getByLabel('Marktwert (eigene Schätzung)').fill('110000');
  await page.getByLabel('Fläche (m²)').fill('50');
  const saved = page.waitForResponse(
    (response) => response.url().endsWith('/properties') && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Immobilie speichern' }).click();
  expect(await (await saved).json()).toMatchObject({
    country: 'DE',
    latitude: expectedLatitude,
    longitude: expectedLongitude,
  });
  await page.reload();
  await page.locator('.property-card').filter({ hasText: 'Adresssuche Testobjekt' }).click();
  await page.getByRole('button', { name: 'Bearbeiten', exact: true }).click();
  await expect(page.getByLabel('Breitengrad')).toHaveValue(String(expectedLatitude));
  await expect(page.getByLabel('Längengrad')).toHaveValue(String(expectedLongitude));
  await expect(page.locator('.location-map .leaflet-marker-icon')).toBeVisible();
  await page.getByLabel('Adresse', { exact: true }).fill('Andere Adresse ohne Treffer');
  await expect(page.getByLabel('Breitengrad')).toHaveValue('');
  await expect(page.getByLabel('Längengrad')).toHaveValue('');
  await expect(page.locator('.location-map .leaflet-marker-icon')).toHaveCount(0);
});

test('allows choosing a map position when the provider is unavailable or has no results', async ({
  page,
}) => {
  await register(page);
  await page.getByRole('button', { name: 'Immobilie hinzufügen', exact: true }).click();
  await page.getByLabel('Bezeichnung').fill('Pin Testobjekt');
  await page.getByLabel('Adresse', { exact: true }).fill('Adresse ohne Treffer');
  await expect(page.getByText('Keine Vorschläge gefunden.', { exact: false })).toBeVisible();
  await page.getByLabel('Adresse', { exact: true }).fill('Ausfall Testadresse');
  await expect(
    page.getByText('Adresssuche gerade nicht erreichbar.', { exact: false }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Erneut suchen', exact: true })).toBeVisible();
  const map = page.getByLabel('Immobilienposition auf der Karte wählen');
  await map.scrollIntoViewIfNeeded();
  await expect(
    page.locator('.location-map .leaflet-container, .location-map.leaflet-container'),
  ).toBeVisible();
  await map.click({ position: { x: 150, y: 150 } });
  await expect(page.getByLabel('Breitengrad')).not.toHaveValue('');
  await expect(page.getByLabel('Längengrad')).not.toHaveValue('');
  await expect(page.locator('.location-map .leaflet-marker-icon')).toBeVisible();
  await page.getByLabel('Kaufpreis').fill('100000');
  await page.getByLabel('Marktwert (eigene Schätzung)').fill('110000');
  await page.getByLabel('Fläche (m²)').fill('50');
  await page.getByRole('button', { name: 'Immobilie speichern' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.property-card').filter({ hasText: 'Pin Testobjekt' })).toBeVisible();
});
