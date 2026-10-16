import { expect, test, type Page } from '@playwright/test';
import { newCampaign } from './newCampaign';

/**
 * M1 track B — the mission report, on the built artifact.
 *  - quest names are real names, never "#3"
 *  - After-action opens with a plain "What happened" block that names every hero
 *  - "Auto level up" buttons (data-auto-level) really raise a hero's level
 */

const HEROES = ['Torvald', 'Shade', 'Mira', 'Elandra'];

/** Accept the easiest posting on the board (lowest challenge, then quest id). */
async function acceptEasiest(page: Page): Promise<void> {
  await page.locator('button:has-text("Quest board")').click();
  await page.locator('h1:has-text("Quest board")').waitFor();
  const rows = page.locator('[data-posting]');
  const n = await rows.count();
  expect(n, 'week 1 always posts').toBeGreaterThan(0);
  let best = { challenge: Infinity, questId: Infinity, row: -1 };
  for (let i = 0; i < n; i++) {
    const questId = Number(await rows.nth(i).getAttribute('data-quest-id'));
    const challenge = Number(await rows.nth(i).getAttribute('data-challenge'));
    if (challenge < best.challenge || (challenge === best.challenge && questId < best.questId)) {
      best = { challenge, questId, row: i };
    }
  }
  await rows.nth(best.row).locator('button:has-text("Accept")').click();
  await page.locator('h1:has-text("Dispatch setup")').waitFor();
}

/** Launch and open the report (works for dungeon playback and surface fights). */
async function launchToReport(page: Page): Promise<void> {
  await page.locator('button:has-text("Launch dispatch")').click();
  await page.locator('button:has-text("After-action ▸")').click();
  await page.locator('h1:has-text("After-action")').waitFor();
}

const levelOf = async (page: Page, hero: string): Promise<number> =>
  Number(await page.locator('tr', { hasText: hero }).locator('td').nth(1).textContent());

/** Dev panel: give one hero the XP for the next level (the level-up stays unspent). */
async function grantXp(page: Page, hero: string): Promise<void> {
  await page.keyboard.press('`');
  const panel = page.locator('[data-gv-dev]');
  await expect(panel).toContainText('Dev panel');
  await panel.locator('div', { hasText: new RegExp(`^${hero} L\\d`) }).last()
    .locator('button', { hasText: '+XP to level' }).click();
  await page.keyboard.press('`');
  await expect(panel).not.toContainText('Dev panel');
}

test('the report says what happened, names every hero, and uses the real quest name', async ({ page }) => {
  await page.goto('/');
  await newCampaign(page, 'Mission Report');
  await acceptEasiest(page);

  // Dispatch setup shows the quest's name, not "quest #N".
  const setupHeading = (await page.locator('h1:has-text("Dispatch setup")').textContent()) ?? '';
  expect(setupHeading).not.toMatch(/#\d/);
  expect(setupHeading.replace(/^Dispatch setup — /, '').length).toBeGreaterThan(3);

  await launchToReport(page);
  const reportHeading = (await page.locator('h1:has-text("After-action")').textContent()) ?? '';
  expect(reportHeading).not.toMatch(/#\d/);

  // "What happened": a plain sentence, then a table with every hero by name.
  await expect(page.locator('[data-mission-summary]')).toContainText('What happened');
  const sentence = (await page.locator('[data-mission-summary]').textContent()) ?? '';
  expect(sentence.length).toBeGreaterThan('What happened. '.length + 10);
  const table = page.locator('[data-mission-table]');
  for (const name of HEROES) await expect(table).toContainText(name);
  for (const head of ['damage dealt', 'damage taken', 'healing', 'kills', 'times downed', 'died?']) {
    await expect(table).toContainText(head);
  }
  expect(await table.textContent()).not.toMatch(/hero_\d/);
});

test('Auto level up on the report raises the hero, then town shows the new level', async ({ page }) => {
  await page.goto('/');
  await newCampaign(page, 'Mission Auto A');
  await acceptEasiest(page);
  await launchToReport(page);

  // No hero is ready, so no auto button yet.
  await expect(page.locator('[data-auto-level]')).toHaveCount(0);
  await grantXp(page, 'Torvald');
  await expect(page.locator('text=Ready to level:')).toBeVisible();
  const auto = page.locator('[data-auto-level="all"]');
  await expect(auto).toContainText('Auto level up all');
  await auto.click();
  await expect(page.locator('text=Ready to level:')).toHaveCount(0);

  await page.locator('button:has-text("Return to town")').click();
  await page.locator('h1:has-text("Town Hub")').waitFor();
  expect(await levelOf(page, 'Torvald')).toBe(2);
  expect(await levelOf(page, 'Shade')).toBe(1);
});

test('Auto level up in town: per-hero button and the Orders "all" button', async ({ page }) => {
  await page.goto('/');
  await newCampaign(page, 'Mission Auto B');

  await expect(page.locator('[data-auto-level]')).toHaveCount(0);
  await grantXp(page, 'Torvald');
  await grantXp(page, 'Mira');

  // Two heroes ready: two per-hero buttons plus one "all" button in Orders.
  await expect(page.locator('[data-auto-level]')).toHaveCount(3);
  await expect(page.locator('tr', { hasText: 'Torvald' })).toContainText('level up!');

  await page.locator('tr', { hasText: 'Torvald' }).locator('[data-auto-level]').click();
  expect(await levelOf(page, 'Torvald')).toBe(2);
  expect(await levelOf(page, 'Mira')).toBe(1);

  // Only Mira is left: the "all" button still shows and clears her.
  await page.locator('[data-auto-level="all"]').click();
  expect(await levelOf(page, 'Mira')).toBe(2);
  await expect(page.locator('[data-auto-level]')).toHaveCount(0);
  await expect(page.locator('text=level up!')).toHaveCount(0);
});

test('the Town button names the accepted quest', async ({ page }) => {
  await page.goto('/');
  await newCampaign(page, 'Mission Name');
  await acceptEasiest(page);
  await page.locator('button:has-text("◂ Town")').click();
  await page.locator('h1:has-text("Town Hub")').waitFor();
  const dispatchBtn = page.locator('button:has-text("Dispatch:")');
  await expect(dispatchBtn).toBeVisible();
  expect(await dispatchBtn.textContent()).not.toMatch(/#\d/);
});
