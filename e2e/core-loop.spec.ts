import { expect, test, type Page } from '@playwright/test';
import { newCampaign } from './newCampaign';

/**
 * The core flow (brief #5 §5): new campaign → advance week → accept quest →
 * forecast renders → launch → skip replay → after-action → level-up → save →
 * reload → state persists.
 *
 * The campaign is fully deterministic ("E2E Test" seeds the world), and the
 * accept policy below (lowest challenge, then lowest quest id) reproduces a
 * known trace: the first level-up lands on week 20, passing through camp
 * fights, dungeon completions, a failure, and three wipes on the way — every
 * outcome branch crosses the DOM in one run.
 */

const MAX_WEEKS = 24;

/**
 * Accept the easiest visible posting (challenge, then quest id) — the v1 policy
 * by hand. Returns false on a bare board (the expiry cooldown makes those real:
 * the guild waits out a restock).
 */
async function acceptEasiest(page: Page): Promise<boolean> {
  await page.locator('button:has-text("Quest board")').click();
  await page.locator('h1:has-text("Quest board")').waitFor();
  if (await page.locator('text=The board is bare').isVisible()) {
    await page.locator('button:has-text("◂ Town")').click();
    await page.locator('h1:has-text("Town Hub")').waitFor();
    return false;
  }
  // Step-3 conversion: postings are notices carrying data-quest-id/data-challenge —
  // same accept policy as the old table-cell parse (lowest challenge, then lowest id).
  const rows = page.locator('[data-posting]');
  const n = await rows.count();
  let best = { challenge: Infinity, questId: Infinity, row: -1 };
  for (let i = 0; i < n; i++) {
    const questId = Number(await rows.nth(i).getAttribute('data-quest-id'));
    const challenge = Number(await rows.nth(i).getAttribute('data-challenge'));
    if (challenge < best.challenge || (challenge === best.challenge && questId < best.questId)) {
      best = { challenge, questId, row: i };
    }
  }
  expect(best.row, 'a posting to accept').toBeGreaterThanOrEqual(0);
  await rows.nth(best.row).locator('button:has-text("Accept")').click();
  await page.locator('h1:has-text("Dispatch setup")').waitFor();
  return true;
}

/** Launch, sit through playback (skip) or the surface resolution, take the report, go home. */
async function launchAndReturn(page: Page): Promise<void> {
  await page.locator('button:has-text("Launch dispatch")').click();
  const playback = page.locator('h1:has-text("Dispatch playback")');
  const surface = page.locator('text=resolved on the surface');
  await expect(playback.or(surface)).toBeVisible();
  if (await playback.isVisible()) {
    await page.locator('button:has-text("Skip ▸▸")').click();
    await page.locator('text=end of record').waitFor();
    await page.locator('button:has-text("After-action ▸")').click();
  } else {
    await page.locator('button:has-text("After-action report")').click();
  }
  await page.locator('h1:has-text("After-action")').waitFor();
  await page.locator('button:has-text("Return to town")').click();
  await page.locator('h1:has-text("Town Hub")').waitFor();
}

test('the core loop: play until a level-up, spend it, save, reload, persist', async ({ page }) => {
  test.setTimeout(300_000); // ~20 deterministic weeks of real UI play

  await page.goto('/');
  await newCampaign(page, 'E2E Test');

  // Forecast panel renders before the first launch (constraint 3 on screen).
  expect(await acceptEasiest(page)).toBe(true); // week 1 always posts
  await page.locator('button:has-text("Run forecast")').click();
  // Step-6 conversion: the forecast is the scribe's tally carrying the same
  // explicit numbers the old <pre> did — the contract reads [data-forecast].
  await expect(page.locator('[data-forecast]')).toContainText('median haul');
  await launchAndReturn(page);

  // Grind the deterministic trace until someone can level (wk 21 on this seed,
  // post rank-cap + expiry-cooldown rebalance).
  let leveled = false;
  for (let week = 2; week <= MAX_WEEKS; week++) {
    if (await page.locator('button:has-text("level up!")').first().isVisible()) {
      leveled = true;
      break;
    }
    await page.locator('button:has-text("Advance Week")').click();
    if (await acceptEasiest(page)) {
      await launchAndReturn(page);
    }
  }
  expect(leveled, `a hero ready to level within ${MAX_WEEKS} weeks`).toBe(true);

  // The wizard: class → skills → commit; the sheet must show the new level.
  await page.locator('button:has-text("level up!")').first().click();
  await page.locator('h1:has-text("Torvald")').waitFor();
  await page.locator('button:has-text("Level up ●")').click();
  await page.locator('button:has-text("Fighter → 2")').click();
  // Spend every point wherever the rank cap leaves headroom (the wizard greys
  // capped skills — finding #4: ranks ≤ character level).
  while (await page.locator('button:has-text("Commit level-up")').isDisabled()) {
    await page.locator('button:text-is("+"):enabled').first().click();
  }
  await page.locator('button:has-text("Commit level-up")').click();
  await expect(page.locator('h1')).toContainText('level 2');
  await page.locator('button:has-text("◂ Town")').click();

  // Save → quit → reload the page → load → identical status line.
  await page.locator('button:has-text("Save")').first().click();
  // Step-2 conversion: the status line is the deskbar's plates ([data-town-status]),
  // same identity semantics as the old first-<p> check.
  const saved = await page.locator('[data-town-status]').textContent();
  expect(saved).toContain('PARTY LEVEL'); // sanity: we captured the status plates
  await page.locator('button:has-text("Quit to title")').click();
  await page.locator('h1:has-text("GUILD VIGIL")').waitFor();
  await page.reload();
  await page.locator('button:has-text("Load")').click();
  await page.locator('h1:has-text("Town Hub")').waitFor();
  expect(await page.locator('[data-town-status]').textContent()).toBe(saved);
});
