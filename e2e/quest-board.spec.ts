import { expect, test } from '@playwright/test';
import { newCampaign } from './newCampaign';

/**
 * Track Q (M2) on the built artifact: the Marshal's letter button works.
 * New campaign → "We'll look into it." → the letter is put away → the board
 * shows the Marshal's commission → accept → launch → a real mission runs.
 *
 * Screenshots go OUTSIDE the repo (GV_SHOTS, set by the session that looks at them).
 */

const SHOTS = process.env['GV_SHOTS'];

test("answering the Marshal posts his commission, and it launches", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');
  await newCampaign(page, 'Commission E2E');

  const answer = page.locator('button:has-text("We\'ll look into it.")');
  await expect(answer).toBeVisible();
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/town-letter.png`, fullPage: true });
  await answer.click();
  await expect(answer, 'the letter is put away once answered').toHaveCount(0);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/town-answered.png`, fullPage: true });

  await page.locator('button:has-text("Quest board")').click();
  await page.locator('h1:has-text("Quest board")').waitFor();

  // Week 1: 4–6 regular postings plus the commission, at most 10 regular.
  const regular = page.locator('[data-posting]:not([data-commission])');
  const n = await regular.count();
  expect(n).toBeGreaterThanOrEqual(4);
  expect(n).toBeLessThanOrEqual(6);
  // At least two easy jobs for a level-1 guild in week 1.
  expect(await page.locator('[data-posting][data-ease="easy"]').count()).toBeGreaterThanOrEqual(2);

  const commission = page.locator('[data-posting][data-commission]');
  await expect(commission).toHaveCount(1);
  await expect(commission).toContainText("Marshal's commission");
  await expect(commission).toContainText('Guard the Last Granary');
  await expect(commission.locator('.gv-seal')).toBeVisible();
  // It sits at the top of the board.
  await expect(page.locator('[data-posting]').first()).toHaveAttribute('data-commission', '');
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/board.png`, fullPage: true });

  await commission.locator('button:has-text("Accept")').click();
  await page.locator('h1:has-text("Dispatch setup")').waitFor();
  await page.locator('button:has-text("Launch dispatch")').click();
  await page.locator('button:has-text("After-action ▸")').click();
  await page.locator('h1:has-text("After-action")').waitFor();
  await expect(page.locator('body')).toContainText('Guard the Last Granary');
  await page.locator('button:has-text("Return to town")').click();
  await page.locator('h1:has-text("Town Hub")').waitFor();

  // The answer survives a save → reload: the letter does not come back.
  await page.locator('button:has-text("Save")').click();
  await page.reload();
  await page.locator('button:has-text("Load")').first().click();
  await page.locator('h1:has-text("Town Hub")').waitFor();
  await expect(page.locator('button:has-text("We\'ll look into it.")')).toHaveCount(0);
});
