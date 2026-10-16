import { test, expect } from '@playwright/test';
import { newCampaign } from './newCampaign';

/**
 * Playtest tooling (output/working-agreement.md §7) on the built artifact:
 * the dev panel opens and its commands reach the game, and the Note button
 * downloads a note carrying the screen and the save state.
 */

test('dev panel opens with the backtick key and its buttons change the game', async ({ page }) => {
  await page.goto('/');
  await newCampaign(page, 'Dev Tools');

  await page.keyboard.press('`');
  const panel = page.locator('[data-gv-dev]');
  await expect(panel).toContainText('Dev panel');

  const goldText = async (): Promise<number> =>
    Number(((await panel.locator('span', { hasText: /^Gold / }).first().textContent()) ?? '').replace(/\D/g, ''));
  const before = await goldText();
  await panel.getByRole('button', { name: '+500', exact: true }).click();
  expect(await goldText()).toBe(before + 500);

  // Level a hero through the real auto level-up path.
  await panel.locator('button', { hasText: '+1 level (auto)' }).first().click();
  await expect(panel).toContainText(' L2');

  await page.keyboard.press('`');
  await expect(panel).not.toContainText('Dev panel');
});

test('Note button downloads a playtest note with screen and save state', async ({ page }) => {
  await page.goto('/');
  await newCampaign(page, 'Note Test');

  await page.locator('[data-gv-note-open]').click();
  await page.locator('[data-gv-note-text]').fill('The town screen feels empty.');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('[data-gv-note-save]').click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^gv-note-\d{8}-\d{6}\.json$/);
  const path = await download.path();
  const { readFileSync } = await import('node:fs');
  const note = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
  expect(note.kind).toBe('guild-vigil-playtest-note');
  expect(note.note).toBe('The town screen feels empty.');
  expect((note.screen as { kind: string }).kind).toBe('town');
  expect(note.saveState).not.toBeNull();
  expect(String(note.screenText)).toContain('Town Hub');
});
