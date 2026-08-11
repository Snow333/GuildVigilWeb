import { test, expect } from '@playwright/test';
import { newCampaign } from './newCampaign';

/**
 * Brief #8 rollout step 7 — the flat-mode acceptance criterion on the built
 * artifact: "flat mode toggle works on every converted screen and persists."
 * Player-wide: toggled in Settings, honored immediately (ornament off, data
 * intact), and still on after a full page reload + campaign load.
 */

test('flat mode toggles in Settings, strips ambience, and persists across reload', async ({ page }) => {
  await page.goto('/');
  await newCampaign(page, 'E2E Test');

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

/**
 * Brief #9 — readable type: the typographic accessibility contract. Standalone
 * toggle (NOT tied to flat mode): swaps both faces to Atkinson Hyperlegible,
 * persists player-wide, and composes with flat mode.
 */
test('readable type swaps the faces, persists across reload, and composes with flat mode', async ({ page }) => {
  const deskFont = () =>
    page.locator('.gv-desk').first().evaluate((el) => getComputedStyle(el).fontFamily);

  await page.goto('/');
  await newCampaign(page, 'E2E Type');

  const body = page.locator('body');
  await expect(body).not.toHaveClass(/gv-readable/);
  expect(await deskFont()).toContain('Alegreya'); // brief #9 program is the default voice

  await page.locator('button:has-text("Settings")').click();
  await page.locator('h1:has-text("Settings")').waitFor();
  await page.locator('[data-readable-on]').click();
  await expect(body).toHaveClass(/gv-readable/);
  expect(await deskFont()).toContain('Atkinson Hyperlegible');

  // Persists player-wide: the title honors it before any campaign loads.
  await page.reload();
  await page.locator('h1:has-text("GUILD VIGIL")').waitFor();
  await expect(body).toHaveClass(/gv-readable/);
  await page.locator('button:has-text("Load")').click();
  await page.locator('h1:has-text("Town Hub")').waitFor();
  await expect(body).toHaveClass(/gv-readable/);

  // Composes with flat mode — orthogonal switches, both records in gv_settings.
  await page.locator('button:has-text("Settings")').click();
  await page.locator('[data-flat-on]').click();
  await expect(body).toHaveClass(/gv-flat/);
  await expect(body).toHaveClass(/gv-readable/);

  // Off again: the desk voice returns without touching flat mode.
  await page.locator('[data-readable-off]').click();
  await expect(body).not.toHaveClass(/gv-readable/);
  await expect(body).toHaveClass(/gv-flat/);
  expect(await deskFont()).toContain('Alegreya');
});
