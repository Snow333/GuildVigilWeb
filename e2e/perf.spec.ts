import { expect, test } from '@playwright/test';
import { newCampaign } from './newCampaign';

/**
 * Track P — the scroll-quiet switch works on the built artifact.
 * (Frame timing itself is tools/perf-scroll.mjs; timings are too noisy to gate on.)
 *
 * A sheet under a still mouse used to lift on :hover while the page scrolled
 * under it. That repaint was the main cost. This proves, in a real browser,
 * that a scrolling page holds the sheet at rest and lets it lift again after.
 */
test('hover lift is off while scrolling and back after', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 500 });
  await page.goto('/');
  await newCampaign(page, 'Perf Check');

  // The town hub is a tall page of sheets.
  const sheet = page.locator('.gv-sheet').first();
  await sheet.waitFor();
  const total = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  test.skip(total < 50, 'page is not tall enough to scroll');

  // Park the mouse on a sheet and let the hover lift settle.
  const box = (await sheet.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + Math.min(30, box.height / 2));
  await page.waitForTimeout(400);
  const restShadow = await sheet.evaluate((el) => getComputedStyle(el).boxShadow);

  const restTransition = await sheet.evaluate((el) => getComputedStyle(el).transitionDuration);
  expect(restTransition).not.toBe('0s'); // at rest the lift is animated

  await page.mouse.wheel(0, 120);
  await expect(page.locator('body.gv-scrolling')).toHaveCount(1);
  // Mid-scroll every sheet, hovered or not, holds its pose with no lift animation.
  const mid = await page.evaluate(() => ({
    durations: [...document.querySelectorAll('.gv-sheet')].map((el) => getComputedStyle(el).transitionDuration),
    hoveredShadow: (() => {
      const h = document.querySelector('.gv-sheet:hover');
      return h ? getComputedStyle(h).boxShadow : null;
    })(),
  }));
  expect(mid.durations.length).toBeGreaterThan(0);
  expect(mid.durations.every((d) => d === '0s')).toBe(true);
  if (mid.hoveredShadow !== null) expect(mid.hoveredShadow).toBe(restShadow);

  // Idle again: the class clears.
  await expect(page.locator('body.gv-scrolling')).toHaveCount(0, { timeout: 2000 });
});

test('the desk leather does not use a fixed background', async ({ page }) => {
  await page.goto('/');
  await newCampaign(page, 'Perf Desk');
  await page.locator('.gv-desk').first().waitFor();
  const attach = await page.evaluate(() => {
    const d = document.querySelector('.gv-desk');
    return d ? getComputedStyle(d).backgroundAttachment : 'no desk found';
  });
  expect(attach).toBe('scroll');
});
