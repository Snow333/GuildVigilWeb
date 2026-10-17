import { expect, test } from '@playwright/test';
import { newCampaign } from './newCampaign';

/**
 * Track Q2 (M2) on the built artifact: a guild at level 10 sees a full board.
 *
 * Steven's playtest: past about week 17 the board showed 1–3 jobs. The party is
 * raised to level 10 in the save itself (the same JSON the game writes), then
 * loaded through the real Load button, the week is advanced with the real
 * button, and the board the player sees is read. The unit suite
 * (tests/campaign/midBoard.test.ts) proves the draw over 90-week careers; this
 * proves the screen shows it and a mid-level job launches.
 *
 * Screenshots go OUTSIDE the repo (GV_SHOTS, set by the session that looks at them).
 */

const SHOTS = process.env['GV_SHOTS'];

test('a level-10 guild opens the board to 4+ jobs it can take, and a mid-level job launches', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.goto('/');
  await newCampaign(page, 'Mid Board E2E');
  await page.locator('button:has-text("Save")').first().click();

  await page.evaluate(() => {
    const key = Object.keys(localStorage).find((k) => k.startsWith('gv_save_'))!;
    const env = JSON.parse(localStorage.getItem(key)!) as {
      state: { week: number; open: unknown[]; party: { hero: { classLevels: { level: number }[] } }[] };
    };
    for (const kit of env.state.party) kit.hero.classLevels[0]!.level = 10;
    env.state.week = 30;
    env.state.open = [];
    localStorage.setItem(key, JSON.stringify(env));
  });
  await page.locator('button:has-text("Quit to title")').click();
  await page.locator('h1:has-text("GUILD VIGIL")').waitFor();
  await page.reload();
  await page.locator('button:has-text("Load")').click();
  await page.locator('h1:has-text("Town Hub")').waitFor();

  await page.locator('button:has-text("Advance Week")').click();
  await page.locator('button:has-text("Quest board")').click();
  await page.locator('h1:has-text("Quest board")').waitFor();

  const regular = page.locator('[data-posting]:not([data-commission])');
  const total = await regular.count();
  expect(total).toBeGreaterThanOrEqual(4);
  expect(total).toBeLessThanOrEqual(6);
  // Takeable = not marked "hard" (the board's word for "beyond us").
  const takeable = await page.locator('[data-posting]:not([data-commission]):not([data-ease="hard"])').count();
  expect(takeable).toBeGreaterThanOrEqual(4);

  // Real mid-level jobs are on it: authored ids are 1000+, and every row shows a name and pay.
  const ids = await regular.evaluateAll((els) => els.map((e) => Number(e.getAttribute('data-quest-id'))));
  expect(ids.some((id) => id >= 1000)).toBe(true);
  for (const row of await regular.all()) {
    await expect(row.locator('b')).not.toHaveText('');
    await expect(row).toContainText(/\d+g/);
  }
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/mid-board.png`, fullPage: true });

  const mid = page.locator('[data-posting]:not([data-commission]):not([data-ease="hard"])');
  const midIds = await mid.evaluateAll((els) => els.map((e) => Number(e.getAttribute('data-quest-id'))).filter((id) => id >= 1000));
  expect(midIds.length).toBeGreaterThan(0);
  const name = (await page.locator(`[data-posting][data-quest-id="${midIds[0]}"] b`).first().innerText()).trim();
  await page.locator(`[data-posting][data-quest-id="${midIds[0]}"] button:has-text("Accept")`).click();
  await page.locator('h1:has-text("Dispatch setup")').waitFor();
  await page.locator('button:has-text("Launch dispatch")').click();
  await page.locator('button:has-text("After-action ▸")').click();
  await page.locator('h1:has-text("After-action")').waitFor();
  await expect(page.locator('body')).toContainText(name);
});
