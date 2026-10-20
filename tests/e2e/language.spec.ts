import { expect, test } from '@playwright/test';

test.use({ locale: 'en-US' });

test('detects browser language and allows a remembered manual language choice', async ({ page }) => {
  await page.goto('/portfolio');
  const english = page.getByRole('button', { name: 'EN', exact: true });
  const german = page.getByRole('button', { name: 'DE', exact: true });

  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('heading', { name: 'Welcome back.' })).toBeVisible();

  await german.click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'de');
  await expect(page.getByRole('heading', { name: 'Schön, dass du da bist.' })).toBeVisible();

  await english.click();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('heading', { name: 'Welcome back.' })).toBeVisible();
});

test('uses the primary browser language when a fallback language is also enabled', async ({ browser }) => {
  const context = await browser.newContext({ locale: 'de-AT' });
  const page = await context.newPage();
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'languages', { get: () => ['de-AT', 'en-US'] });
  });

  await page.goto('/portfolio');
  await expect(page.locator('html')).toHaveAttribute('lang', 'de');
  await expect(page.getByRole('heading', { name: 'Schön, dass du da bist.' })).toBeVisible();
  await context.close();
});
