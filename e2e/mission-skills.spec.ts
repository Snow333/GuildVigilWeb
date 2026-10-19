import { expect, test, type Page } from '@playwright/test';
import { newCampaign } from './newCampaign';

/**
 * Track S — the mission report shows what the mission skills did.
 *
 * Every fight in a dungeon is a chance for Deception, so a dungeon report with
 * NO Skills block means the player cannot see that a skill they built around
 * mattered. This reaches a real dungeon (the LAST posting, as dungeon-playback
 * does — the first lands on a surface fight) and reads the built artifact.
 */

const MAX_WEEKS = 16;

async function reachDungeonPlayback(page: Page): Promise<void> {
  for (let week = 0; week < MAX_WEEKS; week++) {
    await page.locator('button:has-text("Advance week")').first().click();
    await page.locator('button:has-text("Quest board")').click();
    await page.locator('h1:has-text("Quest board")').waitFor();
    const postings = page.locator('[data-posting]');
    if (await postings.count() === 0) {
      await page.locator('button:has-text("◂ Town")').click();
      await page.locator('h1:has-text("Town Hub")').waitFor();
      continue;
    }
    await postings.last().locator('button:has-text("Accept")').click();
    await page.locator('h1:has-text("Dispatch setup")').waitFor();
    await page.locator('button:has-text("Launch dispatch")').click();
    const playback = page.locator('h1:has-text("Dispatch playback")');
    const surface = page.locator('h1:has-text("Dispatch — quest")');
    await expect(playback.or(surface)).toBeVisible();
    if (await playback.isVisible()) return;
    await page.locator('button:has-text("After-action ▸")').click();
    await page.locator('h1:has-text("After-action")').waitFor();
    await page.locator('button:has-text("Return to town")').click();
    await page.locator('h1:has-text("Town Hub")').waitFor();
  }
  throw new Error(`no dungeon playback reached in ${MAX_WEEKS} weeks`);
}

test('a dungeon report lists what the mission skills did, in plain words', async ({ page }) => {
  await page.goto('/');
  await newCampaign(page, 'Dungeon Look');
  await reachDungeonPlayback(page);
  await page.locator('button:has-text("After-action ▸")').click();
  await page.locator('h1:has-text("After-action")').waitFor();

  const block = page.locator('[data-mission-skills]');
  await expect(block, 'a dungeon with fights must say what the skills did').toBeVisible();
  const lines = block.locator('[data-skill-line]');
  expect(await lines.count()).toBeGreaterThan(0);
  // Plain words: a hero's name, never a raw id, never a roll dump.
  const text = (await block.textContent()) ?? '';
  expect(text).not.toMatch(/hero_\d|d20|DC \d/);
  expect(text).toMatch(/Torvald|Shade|Mira|Elandra/);
  await page.screenshot({ path: 'C:/Users/sigse/AppData/Local/hermes/cache/scratch/trackS/report-skills.png', fullPage: true });
});
