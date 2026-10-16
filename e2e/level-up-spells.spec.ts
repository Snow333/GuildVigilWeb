import { expect, test } from '@playwright/test';
import { newCampaign } from './newCampaign';

/**
 * M1 — the level-up screen on the built artifact: a caster picks spells, the
 * picker hides what does not work, and "Auto level up" does the whole thing.
 * The default party's 4th hero is Elandra, a Wizard.
 */

async function openWizardLevelUp(page: import('@playwright/test').Page): Promise<void> {
  await page.keyboard.press('`');
  const dev = page.locator('[data-gv-dev]');
  await dev.locator('div', { hasText: /^Elandra L1/ }).getByRole('button', { name: '+XP to level' }).click();
  await page.keyboard.press('`');
  await page.locator('tr', { hasText: 'Elandra' }).locator('button:has-text("level up!")').click();
  await page.locator('h1:has-text("Elandra")').waitFor();
  await page.locator('button:has-text("Level up ●")').click();
}

test('a wizard levels by hand: picks a spell, and dead content is hidden', async ({ page }) => {
  await page.goto('/');
  await newCampaign(page, 'Spell Pick');
  await openWizardLevelUp(page);

  await page.locator('button:has-text("Wizard → 2")').click();
  // Feat slots (if any) first; the picker never shows "Not yet available" rows any more.
  await expect(page.locator('text=Not yet available')).toHaveCount(0);
  for (let guard = 0; guard < 12; guard++) {
    const offer = page.locator('button[data-feat-offer]:enabled').first();
    if ((await page.locator('[data-spell-picker]').count()) > 0) break;
    if ((await offer.count()) === 0) break;
    await offer.click();
  }

  const picker = page.locator('[data-spell-picker]');
  await expect(picker).toContainText('New spells: 0/1');
  await picker.locator('button[data-feat-offer]:enabled').first().click();
  await expect(picker).toContainText('New spells: 1/1');

  while (await page.locator('button:has-text("Commit level-up")').isDisabled()) {
    await page.locator('button:text-is("+"):enabled').first().click();
  }
  await page.locator('button:has-text("Commit level-up")').click();
  await expect(page.locator('h1')).toContainText('level 2');
});

test('Auto level up does the whole level in one click', async ({ page }) => {
  await page.goto('/');
  await newCampaign(page, 'Auto Level');
  await openWizardLevelUp(page);
  await page.locator('[data-auto-level]').first().click();
  await expect(page.locator('h1')).toContainText('level 2');
  // The new spell reached the fight plan (the loadout tab lists it).
  await page.locator('button:text-is("loadout")').click();
  await expect(page.locator('.gv-ledger tbody tr')).not.toHaveCount(0);
});
