import { test, expect } from '@playwright/test';

/**
 * Brief #8 rollout step 7 — the flat-mode acceptance criterion on the built
 * artifact: "flat mode toggle works on every converted screen and persists."
 * Player-wide: toggled in Settings, honored immediately (ornament off, data
 * intact), and still on after a full page reload + campaign load.
 */

test('flat mode toggles in Settings, strips ambience, and persists across reload', async ({ page }) => {
  await page.goto('/');
  await page.fill('input', 'E2E Test');
  await page.locator('button:has-text("New campaign here")').first().click();
  await page.locator('h1:has-text("Town Hub")').waitFor();

  const body = page.locator('body');
  await expect(body).not.toHaveClass(/gv-flat/);
  await expect(page.locator('.gv-acc').first()).toBeVisible(); // ambience present by default

  await page.locator('button:has-text("Settings")').click();
  await page.locator('h1:has-text("Settings")').waitFor();
  await page.locator('[data-flat-on]').click();
  await expect(body).toHaveClass(/gv-flat/);

  // Ornament off, data intact: back in town the accessories are gone but the
  // deskbar's explicit numbers and every action remain.
  await page.locator('button:has-text("◂ Town")').click();
  await page.locator('h1:has-text("Town Hub")').waitFor();
  await expect(page.locator('[data-town-status]')).toContainText('WEEK');
  await expect(page.locator('.gv-acc').first()).toBeHidden();

  // Persists player-wide: reload the page — the TITLE screen already honors it,
  // and the loaded campaign stays flat.
  await page.reload();
  await page.locator('h1:has-text("GUILD VIGIL")').waitFor();
  await expect(body).toHaveClass(/gv-flat/);
  await page.locator('button:has-text("Load")').click();
  await page.locator('h1:has-text("Town Hub")').waitFor();
  await expect(body).toHaveClass(/gv-flat/);

  // And off again, from the same pressed-button pair.
  await page.locator('button:has-text("Settings")').click();
  await page.locator('[data-flat-off]').click();
  await expect(body).not.toHaveClass(/gv-flat/);
});
