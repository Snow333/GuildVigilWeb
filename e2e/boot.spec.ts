import { expect, test } from '@playwright/test';

/** Boot smoke on the built single-file artifact (brief #5 §5). */

test('the artifact boots clean to the title screen', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });

  await page.goto('/');
  await expect(page.locator('h1')).toHaveText('GUILD VIGIL');
  await expect(page.locator('tbody tr')).toHaveCount(3); // three save slots
  await expect(page.locator('em:has-text("empty")')).toHaveCount(3); // fresh origin
  expect(errors).toEqual([]);
});
