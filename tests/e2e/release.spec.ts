import { test, expect } from '@playwright/test';
test('PWA exposes installable metadata and public help without loading third-party fonts', async ({
  page,
  request,
}) => {
  const thirdPartyFonts: string[] = [];
  page.on('request', (req) => {
    if (/fonts\.(googleapis|gstatic)\.com/.test(req.url())) thirdPartyFonts.push(req.url());
  });
  await page.goto('/install');
  await expect(page.getByRole('heading', { name: 'EstateAtlas auf deinem Gerät' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Auf deinem iPhone oder iPad' })).toBeVisible();
  const manifest = await request.get('/manifest.webmanifest');
  expect(manifest.status()).toBe(200);
  expect((await manifest.json()).display).toBe('standalone');
  expect((await request.get('/icons/apple-touch-icon.png')).headers()['content-type']).toContain(
    'image/png',
  );
  const home = await request.get('/');
  expect(home.headers()['content-security-policy']).toContain("frame-ancestors 'none'");
  expect(home.headers()['referrer-policy']).toBe('no-referrer');
  expect((await request.get('/api/health')).status()).toBe(200);
  await page.getByRole('link', { name: 'Konto löschen', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Dein Konto löschen' })).toBeVisible();
  expect(thirdPartyFonts).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});
test('offline fallback caches only generic assets and never portfolio data or mail codes', async ({
  page,
  context,
}) => {
  await page.goto('/portfolio');
  await expect(page.getByRole('heading', { name: 'Schön, dass du da bist.' })).toBeVisible();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await page.request.get('/api/auth/config');
  await page.goto('/account-action#purpose=reset&token=synthetic-never-cache-code');
  await expect(page.getByLabel('Linkcode')).toHaveValue('synthetic-never-cache-code');
  const urls = await page.evaluate(async () =>
    (
      await Promise.all(
        (await caches.keys()).map(async (name) =>
          (await (await caches.open(name)).keys()).map((request) => new URL(request.url).pathname),
        ),
      )
    ).flat(),
  );
  expect(urls.sort()).toEqual(['/offline.css', '/offline.html']);
  await context.setOffline(true);
  await page.goto('/portfolio');
  await expect(page.getByRole('heading', { name: 'Gerade ohne Verbindung.' })).toBeVisible();
  await expect(page.locator('body')).not.toContainText('synthetic-never-cache-code');
  await context.setOffline(false);
  await page.getByRole('link', { name: 'Erneut versuchen' }).click();
  await page.goto('/portfolio');
  await expect(page.getByRole('heading', { name: 'Schön, dass du da bist.' })).toBeVisible();
});
