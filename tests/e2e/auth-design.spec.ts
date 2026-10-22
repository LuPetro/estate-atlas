import { expect, test } from '@playwright/test';

test('house animation pauses, keeps buildings grounded and has a complete reduced-motion view', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  const art = page.locator('[data-auth-art]');
  await expect(art).toBeVisible();
  const front = art.locator('[data-art-part="front-house"]');
  const initialPosition = await front.boundingBox();
  const pause = page.getByRole('button', { name: 'Hausanimation pausieren' });
  await pause.click();
  const resume = page.getByRole('button', { name: 'Hausanimation fortsetzen' });
  await expect(resume).toBeFocused();
  const times = () =>
    art.evaluate((element) =>
      element.getAnimations({ subtree: true }).map((animation) => ({
        time: animation.currentTime,
        state: animation.playState,
      })),
    );
  await expect
    .poll(async () => (await times()).every((animation) => animation.state === 'paused'))
    .toBe(true);
  const paused = await times();
  expect(paused.length).toBeGreaterThan(0);
  await page.waitForTimeout(200);
  expect(await times()).toEqual(paused);
  await page.keyboard.press('Enter');
  await expect(pause).toBeFocused();
  await expect
    .poll(async () => (await times()).some((animation) => animation.state === 'running'))
    .toBe(true);

  // Inspect different points in the cycle: the house must never detach from its base.
  for (const time of [800, 3000, 9000, 18000]) {
    await art.evaluate((element, time) => {
      for (const animation of element.getAnimations({ subtree: true })) {
        animation.pause();
        animation.currentTime = time;
      }
    }, time);
    expect(await front.boundingBox()).toEqual(initialPosition);
    await page.screenshot({ path: `work/auth-motion-${test.info().project.name}-${time}.png` });
  }

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(pause).toBeHidden();
  expect(await art.evaluate((element) => element.getAnimations({ subtree: true }).length)).toBe(0);
  // No construction stage may leave its walls or windows invisible when motion is disabled.
  const opacities = await front
    .locator('g')
    .evaluateAll((groups) => groups.map((group) => Number(getComputedStyle(group).opacity)));
  expect(opacities.every((opacity) => opacity === 1)).toBe(true);
  await page.screenshot({ path: `work/auth-motion-${test.info().project.name}-reduced.png` });
});

test('login and registration remain usable with the keyboard and password visibility control', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Schön, dass du da bist.' })).toBeVisible();
  await expect(page.locator('[data-auth-art]')).toHaveCount(1);
  if (!test.info().project.name.includes('mobile')) {
    await expect(page.locator('[data-auth-art]')).toBeVisible();
  }
  await expect(page.locator('.brand .lucide-compass')).toBeVisible();
  await page.screenshot({
    path: `work/auth-login-${test.info().project.name}.png`,
    fullPage: true,
    animations: 'disabled',
  });

  const email = page.getByLabel('E-Mail-Adresse');
  const password = page.getByLabel('Passwort', { exact: true });
  await email.fill('synthetic-auth-design@example.test');
  await email.focus();
  await page.keyboard.press('Tab');
  await expect(password).toBeFocused();
  await password.fill('Synthetic auth design password 1234');
  await expect(password).toHaveAttribute('type', 'password');
  await expect(password).toHaveAttribute('autocomplete', 'current-password');

  const show = page.getByRole('button', { name: 'Passwort anzeigen', exact: true });
  await expect(show).toHaveAttribute('type', 'button');
  await show.focus();
  await page.keyboard.press('Enter');
  await expect(password).toHaveAttribute('type', 'text');
  await expect(password).toHaveValue('Synthetic auth design password 1234');

  const hide = page.getByRole('button', { name: 'Passwort verbergen', exact: true });
  await expect(hide).toHaveAttribute('type', 'button');
  await hide.focus();
  await page.keyboard.press('Enter');
  await expect(password).toHaveAttribute('type', 'password');
  await expect(password).toHaveValue('Synthetic auth design password 1234');

  await page.getByRole('button', { name: 'Konto erstellen', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Ein neuer Anfang.' })).toBeVisible();
  await expect(page.getByLabel('Dein Name')).toBeVisible();
  await expect(password).toHaveAttribute('autocomplete', 'new-password');
  await expect(email).toHaveValue('synthetic-auth-design@example.test');
  await expect(password).toHaveValue('Synthetic auth design password 1234');
  await page.screenshot({
    path: `work/auth-register-${test.info().project.name}.png`,
    fullPage: true,
    animations: 'disabled',
  });

  await page.getByRole('button', { name: 'Anmelden', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Schön, dass du da bist.' })).toBeVisible();
  await expect(page.getByLabel('Dein Name')).toHaveCount(0);
  await expect(password).toHaveAttribute('autocomplete', 'current-password');

  const loginTab = page.getByRole('tab', { name: 'Anmelden', exact: true });
  const registerTab = page.getByRole('tab', { name: 'Registrieren', exact: true });
  await loginTab.focus();
  await page.keyboard.press('ArrowRight');
  await expect(registerTab).toBeFocused();
  await expect(registerTab).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('heading', { name: 'Ein neuer Anfang.' })).toBeVisible();
  await page.keyboard.press('Home');
  await expect(loginTab).toBeFocused();
  await expect(loginTab).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('heading', { name: 'Schön, dass du da bist.' })).toBeVisible();
});

test('auth screens fit a small viewport and respect reduced motion', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Schön, dass du da bist.' })).toBeVisible();

  const checkLayoutAndMotion = async () => {
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
    ).toBe(true);
    const longRunningAnimations = await page.locator('[data-auth-screen]').evaluate(
      (element) =>
        element.getAnimations({ subtree: true }).filter((animation) => {
          const timing = animation.effect?.getComputedTiming();
          return timing && (timing.endTime === Infinity || Number(timing.endTime) > 1);
        }).length,
    );
    expect(longRunningAnimations).toBe(0);
    await expect(page.getByLabel('E-Mail-Adresse')).toBeVisible();
    await expect(page.getByLabel('Passwort', { exact: true })).toBeVisible();
  };

  await checkLayoutAndMotion();
  await page.getByRole('button', { name: 'Konto erstellen', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Ein neuer Anfang.' })).toBeVisible();
  await checkLayoutAndMotion();
  await page.getByRole('button', { name: 'Konto erstellen', exact: true }).scrollIntoViewIfNeeded();
  await expect(page.getByRole('button', { name: 'Konto erstellen', exact: true })).toBeInViewport();
});
