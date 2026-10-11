import { test, expect, type Page } from '@playwright/test';
const password = 'EstateAtlas browser test password 42';
// The isolated build uses a synthetic CARTO key. Tile fixtures never contact
// CARTO or use a real key; provider failure is exercised separately below.
test.beforeEach(async ({ page }) => {
  await page.route('https://basemaps.cartocdn.com/**', (route) =>
    route.fulfill({
      contentType: 'image/png',
      body: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jF6cAAAAASUVORK5CYII=',
        'base64',
      ),
    }),
  );
});
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
  await nav(page, 'Wertentwicklung');
  await expect(page.locator('.portfolio-history-card')).toHaveCount(0);
  await page.getByLabel('Archiv einblenden', { exact: true }).check();
  await expect(page.locator('.portfolio-history-card')).toHaveCount(1);
  await expect(page.locator('.portfolio-totals article')).toHaveCount(0);
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
  await verifyRentalHistory(page);
});
test('labeled fixtures, filters, all views and interactive map use the same portfolio', async ({
  page,
}) => {
  let tileRequests = 0;
  page.on('request', (request) => {
    if (/basemaps\.cartocdn\.com|tile\.openstreetmap\.org/.test(request.url())) tileRequests++;
  });
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
  await page.getByLabel('Land filtern', { exact: true }).selectOption('AT');
  await expect(page.locator('.stat-grid')).toContainText('01');
  await expect(page.locator('.map-caption')).toContainText('1 Immobilien');
  await page.getByText('Dashboard anpassen', { exact: true }).click();
  await page.getByLabel('Karte', { exact: true }).uncheck();
  await expect(page.locator('.map-panel')).toHaveCount(0);
  await page.reload();
  await page.getByText('Dashboard anpassen', { exact: true }).click();
  await expect(page.getByLabel('Karte', { exact: true })).not.toBeChecked();
  await page.getByLabel('Karte', { exact: true }).check();
  await nav(page, 'Wertentwicklung');
  await expect(page.locator('.portfolio-history-card')).toHaveCount(4);
  await expect(page.locator('.portfolio-totals')).toContainText('USD');
  await page.getByLabel('Währung filtern', { exact: true }).selectOption('EUR');
  await expect(page.locator('.portfolio-history-card')).toHaveCount(3);
  await expect(page.locator('.portfolio-totals')).not.toContainText('USD');
  await page.getByLabel('Land filtern', { exact: true }).selectOption('AT');
  await expect(page.locator('.portfolio-history-card')).toHaveCount(1);
  await page.getByLabel('Zeitraum für alle Immobilien').selectOption('30');
  await expect(page.locator('.portfolio-history-card')).toContainText('Ein erster Wert');
  await page.screenshot({ path: `work/values-${test.info().project.name}.png`, fullPage: true });
  await page.getByLabel('Vermietung filtern').selectOption('vacant');
  await expect(page.locator('.portfolio-history-card')).toHaveCount(0);
  await nav(page, 'Übersicht');
  await page.getByRole('button', { name: 'Listenansicht' }).click();
  await expect(page.locator('.as-list')).toBeVisible();
  await page.getByRole('button', { name: 'Tabellenansicht' }).click();
  await expect(page.locator('tbody tr')).toHaveCount(4);
  await nav(page, 'Weltkarte');
  await expect(page.getByLabel('Interaktive Immobilienkarte')).toBeVisible();
  await expect(page.locator('.leaflet-marker-icon').first()).toBeVisible();
  await expect(page.locator('.atlas-map')).toHaveClass(/atlas-map-simple/);
  await expect(page.locator('.leaflet-control-attribution')).toContainText('Natural Earth');
  await expect(page.locator('.leaflet-tile')).toHaveCount(0);
  expect(tileRequests).toBe(0);
  await page.screenshot({
    path: `work/map-simple-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Details anzeigen', exact: true }).click();
  await expect(page.locator('.atlas-map')).toHaveClass(/atlas-map-carto/);
  await expect(page.locator('.leaflet-control-attribution')).toContainText('CARTO');
  const map = page.getByLabel('Interaktive Immobilienkarte');
  const initialMarkers = await map.locator('.leaflet-marker-icon').count();
  // Grouping and recentering remain usable after zooming out and panning.
  await map.locator('.leaflet-control-zoom-out').click();
  await expect.poll(() => map.locator('.leaflet-marker-icon').count()).toBeLessThan(initialMarkers);
  await expect(map).not.toHaveClass(/leaflet-zoom-anim/);
  await expect(map.locator('.leaflet-map-pane')).not.toHaveClass(/leaflet-cluster-anim/);
  await expect(map.locator('.atlas-cluster')).not.toHaveCount(0);
  const bounds = (await map.boundingBox())!;
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width / 2 + 100, bounds.y + bounds.height / 2 + 50, {
    steps: 10,
  });
  await page.mouse.up();
  await page
    .getByRole('button', { name: 'Alle gefilterten Immobilien auf der Karte anzeigen' })
    .click();
  await expect(map.locator('.leaflet-marker-icon')).toHaveCount(initialMarkers);
  await page.getByLabel('Land filtern', { exact: true }).selectOption('AT');
  await expect(page.locator('.leaflet-marker-icon')).toHaveCount(1);
  await page.getByRole('button', { name: 'Vereinfacht anzeigen', exact: true }).click();
  await expect(page.locator('.atlas-map')).toHaveClass(/atlas-map-simple/);
  await expect(page.locator('.leaflet-tile')).toHaveCount(0);
  await expect(page.locator('.leaflet-marker-icon')).toHaveCount(1);
  await page.locator('.leaflet-marker-icon').click();
  await expect(page.locator('.map-popup')).toContainText('Wien');
  await expect(page.locator('.map-popup-action')).toHaveText('Details öffnen →');
  await page.screenshot({ path: `work/map-theme-${test.info().project.name}.png`, fullPage: true });
  await page.locator('.map-popup').click();
  await expect(page.getByRole('heading', { name: 'Stadtwohnung · Wien' })).toBeVisible();
});

// Extend the same isolated owner's CRUD flow instead of consuming another
// registration allowance. Production anti-abuse limits stay enabled in E2E.
async function verifyRentalHistory(page: Page) {
  await create(page);
  const card = page.locator('.property-card').filter({ hasText: 'Meine echte Testimmobilie' });
  await expect(card).toContainText('Vermietung nicht angegeben');
  await card.click();
  const history = page.getByRole('region', { name: 'Wertentwicklung', exact: true });
  await expect(history).toContainText('Ein erster Wert – noch kein Trend');
  await page.getByRole('button', { name: 'Bearbeiten', exact: true }).click();
  await page.getByLabel('Vermietungsstatus', { exact: true }).selectOption('rented');
  await page.getByLabel('Mietbeginn', { exact: true }).fill('2020-01-01');
  await page.getByLabel('Unbefristet', { exact: true }).uncheck();
  await page.getByLabel('Mietende', { exact: true }).fill('2019-01-01');
  await page.getByRole('button', { name: 'Immobilie speichern' }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText(
    'Mietende darf nicht vor',
  );
  await page.getByLabel('Mietende', { exact: true }).fill('2099-12-31');
  await page.getByLabel('Marktwert (eigene Schätzung)').fill('310000');
  await page.getByRole('button', { name: 'Immobilie speichern' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.reload();
  await expect(card).toContainText('Vermietet');
  await expect(card).toContainText('31.12.2099');
  await card.click();
  await expect(history).toContainText('30.000');
  await expect(history).toContainText('10,7 %');
  await expect(history.getByRole('img')).toHaveAttribute(
    'aria-label',
    /2 gespeicherte Wertangaben/,
  );
  await history.getByLabel('Wertangabe auswählen').fill('0');
  await expect(history.locator('.chart-selection')).toContainText('280.000');
  await history.getByRole('button', { name: '30 Tage', exact: true }).click();
  await expect(history.getByRole('button', { name: '30 Tage', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await history.getByText('Alle Wertangaben ansehen').click();
  await expect(history.locator('.history>div')).toHaveCount(2);
  await history.screenshot({ path: `work/qa/rental-history-${test.info().project.name}.png` });
  await page.getByRole('button', { name: 'Bearbeiten', exact: true }).click();
  await page.getByLabel('Währung', { exact: true }).selectOption('USD');
  await page.getByLabel('Unbefristet', { exact: true }).check();
  await page.getByRole('button', { name: 'Immobilie speichern' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await card.click();
  await expect(page.getByRole('dialog')).toContainText('unbefristet');
  await expect(history).toContainText('Ein erster Wert – noch kein Trend');
  await history.getByLabel('Währung der Wertentwicklung').selectOption('EUR');
  await expect(history).toContainText('30.000');
  await expect(history.getByRole('img')).toHaveAttribute('aria-label', /in EUR, 2 gespeicherte/);
  await page.getByRole('button', { name: 'Schließen', exact: true }).click();
}

test('keeps map selection usable when CARTO tiles fail and switches attribution to OSM', async ({
  page,
}) => {
  await page.route('https://basemaps.cartocdn.com/**', (route) => route.abort());
  await register(page);
  await expect(page.locator('.property-map')).toHaveClass(/atlas-map-simple/);
  await expect(page.locator('.leaflet-tile')).toHaveCount(0);
  await page.getByRole('button', { name: 'Details anzeigen', exact: true }).click();
  await expect(page.locator('.property-map')).toHaveClass(/atlas-map-osm/);
  await expect(page.locator('.leaflet-control-attribution')).toContainText('OpenStreetMap');
  await expect(page.locator('.leaflet-control-attribution')).not.toContainText('CARTO');
  await expect(page.getByRole('status')).toContainText('Ersatzkarte');
  await page.getByRole('button', { name: 'Immobilie hinzufügen', exact: true }).click();
  const map = page.locator('.location-map');
  await expect(map).toHaveClass(/atlas-map-simple/);
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Details anzeigen', exact: true })
    .click();
  await expect(map).toHaveClass(/atlas-map-osm/);
  const bounds = (await map.boundingBox())!;
  await map.click({ position: { x: bounds.width / 2, y: bounds.height / 2 } });
  await expect(map.locator('.atlas-marker')).toBeVisible();
  await expect(page.getByLabel('Breitengrad')).not.toHaveValue('');
  await expect(page.getByLabel('Längengrad')).not.toHaveValue('');
});
test('uploads a private photo, researches labeled fixtures and adopts a result', async ({
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
  let startedResearch = 0;
  page.on('request', (r) => {
    if (r.method() === 'POST' && /\/properties\/[^/]+\/analyses$/.test(new URL(r.url()).pathname))
      startedResearch++;
  });
  await page.getByRole('button', { name: 'Recherche vorbereiten', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Marktpreis recherchieren' })).toBeDisabled();
  expect(startedResearch).toBe(0);
  await page.getByLabel('Ich stimme zu').check();
  await page.getByRole('button', { name: 'Marktpreis recherchieren' }).click();
  await expect(page.getByRole('button', { name: 'Recherche abbrechen' })).toBeVisible();
  await expect(page.locator('.ai-result')).toContainText('4 Vergleichsobjekte');
  await page
    .locator('.ai-panel')
    .screenshot({ path: `work/qa/analysis-${test.info().project.name}.png` });
  await page.getByText('Vergleichsobjekte & Quellen ansehen').click();
  await expect(page.getByRole('link', { name: 'TESTDATEN Vergleich 1' })).toBeVisible();
  await page.getByRole('button', { name: 'Geprüften Wert übernehmen' }).click();
  await expect(page.getByRole('button', { name: 'Wert übernommen', exact: true })).toBeDisabled();
  await expect(page.locator('.history')).toContainText('KI-Recherche · von dir übernommen');
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
  await expect(page.locator('.location-map')).toHaveClass(/atlas-map-simple/);
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Details anzeigen', exact: true })
    .click();
  await expect(page.getByLabel('Breitengrad')).toHaveValue('52.532');
  await expect(page.getByLabel('Längengrad')).toHaveValue('13.384');
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

test('shows disabled setup without research or fabricated results', async ({ page }) => {
  await page.route('**/analyses/config', (route) =>
    route.fulfill({
      json: {
        enabled: false,
        reason: 'TESTDATEN: OpenAI-Key und Freigabe fehlen.',
        models: ['gpt-6-luna'],
        defaultModel: 'gpt-6-luna',
      },
    }),
  );
  await register(page);
  await create(page);
  await page.locator('.property-card').filter({ hasText: 'Meine echte Testimmobilie' }).click();
  await expect(page.getByRole('button', { name: 'Marktpreis recherchieren' })).toBeDisabled();
  await expect(page.locator('.ai-panel')).toContainText('OpenAI-Key und Freigabe fehlen');
  await expect(page.locator('.ai-result')).toHaveCount(0);
});
test('can cancel research and explains insufficient comparisons without changing the value', async ({
  page,
}) => {
  await register(page);
  await create(page);
  await page.locator('.property-card').filter({ hasText: 'Meine echte Testimmobilie' }).click();
  await page.getByRole('button', { name: 'Recherche vorbereiten', exact: true }).click();
  await page.getByLabel('Ich stimme zu').check();
  await page.getByRole('button', { name: 'Marktpreis recherchieren' }).click();
  await page.getByRole('button', { name: 'Recherche abbrechen' }).click();
  await expect(page.locator('.analysis-status')).toContainText('Recherche abgebrochen');
  await expect(page.locator('.ai-result')).toHaveCount(0);
  await page.getByRole('button', { name: 'Bearbeiten', exact: true }).click();
  await page.getByLabel('Adresse', { exact: true }).fill('TESTDATEN Diagnose Teststraße 1, Wien');
  await page.getByLabel('Breitengrad').fill('48.2082');
  await page.getByLabel('Längengrad').fill('16.3738');
  await page.getByRole('button', { name: 'Immobilie speichern' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.locator('.property-card').filter({ hasText: 'Meine echte Testimmobilie' }).click();
  await page.getByRole('button', { name: 'Recherche vorbereiten', exact: true }).click();
  await page.getByLabel('Ich stimme zu').check();
  await page.getByRole('button', { name: 'Marktpreis recherchieren' }).click();
  await expect(page.locator('.analysis-status')).toContainText('0 aus 0 Websites');
  await page.getByText('Was hat die Recherche gefunden?').click();
  await expect(page.locator('.ai-panel')).toContainText('4 Angebote ausgelesen');
  await expect(page.locator('.ai-panel')).toContainText('4 × Andere Währung');
  await expect(page.getByRole('link', { name: /Quelle öffnen/ })).toHaveCount(4);
  await expect(page.locator('.ai-result')).toHaveCount(0);
  await page
    .locator('.ai-panel')
    .screenshot({ path: `work/qa/analysis-diagnostics-${test.info().project.name}.png` });
  await page.reload();
  await expect(page.locator('.value-card')).toContainText('280.000');
  await page.locator('.property-card').filter({ hasText: 'Meine echte Testimmobilie' }).click();
  await page.getByText('Was hat die Recherche gefunden?').click();
  await expect(page.locator('.ai-panel')).toContainText('4 × Andere Währung');
});
