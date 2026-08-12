import { expect, test } from '@playwright/test';

/**
 * Boot smoke on the built single-file artifact (brief #5 §5).
 *
 * ⚠ HARNESS DIFF, brief #11 — the ONLY test this brief rewrites. The charter's
 * slot table became a slot LIST (the Week column held three em-dashes across a
 * third of the sheet), so `tbody tr` no longer exists. The CONTRACT is
 * unchanged and deliberately restated, not weakened: three save slots, each
 * bare one marked <em>empty</em>, no console errors. The row selector moved
 * from an incidental DOM shape to an explicit [data-slot] hook, so the next
 * layout change cannot break it for cosmetic reasons.
 */

test('the artifact boots clean to the title screen', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });

  await page.goto('/');
  await expect(page.locator('h1')).toHaveText('GUILD VIGIL');
  await expect(page.locator('[data-slot]')).toHaveCount(3); // three save slots
  await expect(page.locator('em:has-text("empty")')).toHaveCount(3); // fresh origin
  expect(errors).toEqual([]);
});
