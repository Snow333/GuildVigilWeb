/**
 * Brief #8 rollout step 1 — the style layer's e2e criteria on the built artifact:
 * the #style-drawer reference route renders the grammar vocabulary, status chips
 * are label-paired, and the flat-mode toggle strips ornament by class.
 */

import { test, expect } from '@playwright/test';

test('the style drawer renders the grammar and flat mode toggles', async ({ page }) => {
  await page.goto('/#style-drawer');

  await expect(page.locator('[data-drawer-intro]')).toBeVisible();

  // status chips exist ONLY label-paired (color dot + text in one chip)
  const chips = page.locator('[data-status-chips] .gv-chip');
  await expect(chips).toHaveCount(4);
  await expect(chips.nth(0)).toContainText('ready');
  await expect(chips.nth(2)).toContainText('wounded 1');

  // flat mode: class on <body>, ornament off, data intact
  const body = page.locator('body');
  await expect(body).not.toHaveClass(/gv-flat/);
  await page.locator('[data-flat-toggle]').click();
  await expect(body).toHaveClass(/gv-flat/);
  await expect(chips.nth(0)).toContainText('ready'); // labels survive flat mode
  await page.locator('[data-flat-toggle]').click();
  await expect(body).not.toHaveClass(/gv-flat/);
});
