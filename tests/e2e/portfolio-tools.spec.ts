import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import * as XLSX from 'xlsx';

async function nav(page: Page, label: string) {
  const menu = page.getByRole('button', { name: 'Navigation öffnen' });
  if (await menu.isVisible()) await menu.click();
  await page
    .getByRole('navigation')
    .getByRole('button', { name: new RegExp('^' + label) })
    .click();
}

test('imports a reviewed table, manages a dated reminder and downloads a private PDF on desktop and mobile', async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.goto('/?register=1');
  await page.getByLabel('Dein Name').fill('Mara Beispiel');
  await page
    .getByLabel('E-Mail-Adresse')
    .fill(`tools-${Date.now()}-${test.info().project.name}@example.test`);
  await page
    .getByLabel('Passwort', { exact: true })
    .fill('Synthetic portfolio tools password 1234');
  await page.getByRole('button', { name: 'Konto erstellen', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Portfolioübersicht' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
  await expect(page.getByRole('button', { name: 'Profil von Mara Beispiel öffnen' })).toHaveText(
    'MB',
  );
  await page.screenshot({
    path: `work/quick-start-${test.info().project.name}.png`,
    fullPage: true,
    scale: 'css',
  });

  const csv = Buffer.from(
    'Bezeichnung;Adresse;Land;Breitengrad;Längengrad;Immobilienart;Kaufpreis;Marktwert;Währung;Fläche\nTESTDATEN Importwohnung;Private Testadresse 12;AT;48,2;16,3;Wohnung;100000;120000;EUR;70\nUngültige Zeile;Testadresse 2;AT;999;16,3;Haus;100000;120000;EUR;70',
  );
  const openImport = () =>
    page
      .locator('.page-heading-actions')
      .getByRole('button', { name: 'CSV / Excel importieren' })
      .click();
  await openImport();
  await page
    .getByLabel('CSV- oder Excel-Datei auswählen')
    .setInputFiles({ name: 'synthetic-import.csv', mimeType: 'text/csv', buffer: csv });
  await expect(page.getByRole('dialog').getByRole('status')).toContainText('1 von 2 Zeilen');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await openImport();
  await expect(page.locator('.csv-preview')).toHaveCount(0);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([
      [
        'title',
        'address',
        'country',
        'latitude',
        'longitude',
        'type',
        'purchasePrice',
        'marketValue',
        'currency',
        'area',
      ],
      [
        'TESTDATEN Excelwohnung',
        'Private Testadresse',
        'AT',
        48.2,
        16.3,
        'apartment',
        100000,
        120000,
        'EUR',
        70,
      ],
    ]),
    'Bestand',
  );
  await page.getByLabel('CSV- oder Excel-Datei auswählen').setInputFiles({
    name: 'synthetic-import.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }),
  });
  await expect(page.locator('.csv-preview')).toContainText('TESTDATEN Excelwohnung');
  await page
    .getByLabel('CSV- oder Excel-Datei auswählen')
    .setInputFiles({ name: 'synthetic-import.csv', mimeType: 'text/csv', buffer: csv });
  await expect(page.locator('.csv-preview')).toContainText('Breitengrad');
  let releaseImport!: () => void;
  let importStarted!: () => void;
  const heldImport = new Promise<void>((resolve) => {
    releaseImport = resolve;
  });
  const startedImport = new Promise<void>((resolve) => {
    importStarted = resolve;
  });
  await page.route('**/api/properties/import', async (route) => {
    importStarted();
    await heldImport;
    await route.continue();
  });
  await page.getByRole('button', { name: '1 Immobilie importieren', exact: true }).click();
  await startedImport;
  try {
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Schließen', exact: true })).toBeDisabled();
  } finally {
    releaseImport();
  }
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.property-card')).toHaveCount(1);
  await expect(page.locator('.property-card')).toContainText('TESTDATEN Importwohnung');

  await nav(page, 'Wiedervorlagen');
  await page.getByLabel('Was möchtest du im Blick behalten?').fill('TESTDATEN Versicherung prüfen');
  await page.getByLabel('Fällig am').fill('2026-11-02');
  await page.getByLabel('Notiz (optional)').fill('Synthetischer Termin für die Funktionsprüfung');
  await page
    .locator('.reminder-form')
    .getByRole('button', { name: 'Speichern', exact: true })
    .click();
  const row = page.locator('.reminder-row').filter({ hasText: 'TESTDATEN Versicherung prüfen' });
  await expect(row.locator('time')).toHaveAttribute('dateTime', '2026-11-02');
  await expect(row).toContainText('2.11.2026');
  await page.screenshot({
    path: `work/reminders-${test.info().project.name}.png`,
    fullPage: true,
    scale: 'css',
  });
  await row.getByRole('checkbox', { name: /erledigt markieren/ }).click();
  await page.locator('.reminder-completed summary').click();
  await expect(row.getByRole('checkbox')).toBeChecked();
  await row.getByRole('checkbox', { name: /wieder öffnen/ }).click();
  await expect(row.getByRole('checkbox')).not.toBeChecked();
  page.once('dialog', (dialog) => dialog.accept());
  await row.getByRole('button', { name: /löschen/ }).click();
  await expect(page.locator('.reminder-row')).toHaveCount(0);

  await nav(page, 'Übersicht');
  await page.getByRole('button', { name: 'PDF-Bericht', exact: true }).click();
  await expect(page.getByLabel('Adressen in den Bericht aufnehmen')).not.toBeChecked();
  await page.screenshot({
    path: `work/report-${test.info().project.name}.png`,
    fullPage: true,
    scale: 'css',
  });
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: '1 Immobilie als PDF', exact: true }).click();
  const download = await downloaded;
  expect(download.suggestedFilename()).toMatch(/^estateatlas-portfolio-.*\.pdf$/);
  const bytes = await readFile((await download.path())!);
  expect(bytes.subarray(0, 8).toString()).toBe('%PDF-1.4');
  expect(bytes.toString()).not.toContain('Private Testadresse');
  expect(bytes.toString()).toContain('EUR');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true,
  );
  await page.getByRole('button', { name: 'Profil von Mara Beispiel öffnen' }).click();
  await expect(page.getByRole('heading', { name: 'Persönlich. Sicher.' })).toBeVisible();
});
