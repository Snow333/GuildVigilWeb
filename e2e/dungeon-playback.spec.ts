import { expect, test, type Page } from '@playwright/test';
import { newCampaign } from './newCampaign';

/**
 * Brief #18 finding 4 — the after-action gate, on the built artifact.
 *
 * WHY THIS SPEC EXISTS AT ALL. Nothing in the e2e suite had ever mounted a
 * DUNGEON playback. `core-loop` and `combat-field` both take the FIRST posting
 * each week, which lands on surface missions — and the surface branch renders a
 * different, always-ungated "After-action report ▸". So the gated dungeon
 * button was unreachable from the suite, and an assertion placed in either of
 * those specs passes whether the fix is present or not (observed twice while
 * writing this).
 *
 * The repro is Steven's own: campaign "Dungeon Look", take the LAST posting.
 *
 * ⚠ A bare `.click()` is NOT a gate here either. Playwright auto-waits for
 * actionability, so clicking a disabled button simply waits out the playback
 * and then succeeds. The gate has to assert the button's state at MOUNT, while
 * the playhead is still near tick 0, with a short timeout.
 */

const MAX_WEEKS = 16;

/** Advance until a mission resolves into a dungeon playback; leaves it mounted. */
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

    // The LAST posting is the deep one — the dungeon mounting from status.md.
    await postings.last().locator('button:has-text("Accept")').click();
    await page.locator('h1:has-text("Dispatch setup")').waitFor();
    await page.locator('button:has-text("Launch dispatch")').click();

    const playback = page.locator('h1:has-text("Dispatch playback")');
    const surface = page.locator('h1:has-text("Dispatch — quest")');
    await expect(playback.or(surface)).toBeVisible();
    if (await playback.isVisible()) return;

    // A surface mission — take its (already ungated) report and keep going.
    await page.locator('button:has-text("After-action report")').click();
    await page.locator('h1:has-text("After-action")').waitFor();
    await page.locator('button:has-text("Return to town")').click();
    await page.locator('h1:has-text("Town Hub")').waitFor();
  }
  throw new Error(`no dungeon playback reached in ${MAX_WEEKS} weeks`);
}

test('the dungeon after-action is reachable in one click, without finishing or skipping', async ({ page }) => {
  await page.goto('/');
  await newCampaign(page, 'Dungeon Look');
  await reachDungeonPlayback(page);

  // The playhead is at the very start of a multi-hundred-tick record.
  await expect(page.locator('.gv-strip-seg').first()).toBeVisible();

  const afterAction = page.locator('button:has-text("After-action ▸")');
  await expect(afterAction, 'reachable before the record has finished').toBeEnabled({ timeout: 1000 });
  await expect(afterAction, 'and it does not ask to be finished or skipped first')
    .not.toContainText('finish or skip');

  // One click finishes the record AND transitions — no Skip in between.
  await afterAction.click();
  await page.locator('h1:has-text("After-action")').waitFor();

  // Skip still exists for "finish the record but stay and read it".
  await page.goBack().catch(() => undefined);
});
