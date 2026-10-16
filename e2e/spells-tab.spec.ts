import { expect, test } from '@playwright/test';
import { newCampaign } from './newCampaign';

/** M2 — the caster's spell page on the built artifact. Default party hero 3 is Mira, a Cleric. */

async function openSpells(page: import('@playwright/test').Page, hero: string): Promise<void> {
  await page.locator('tr', { hasText: hero }).locator('button:has-text("Open")').click();
  await page.locator(`h1:has-text("${hero}")`).waitFor();
  await page.locator('button:text-is("spells")').click();
}

test('a cleric prepares from the whole list, within its slots', async ({ page }) => {
  await page.goto('/');
  await newCampaign(page, 'Spell Page');
  await openSpells(page, 'Mira');

  const level1 = page.locator('[data-spell-level="1"]');
  await expect(level1).toContainText('of 2 slots prepared');
  // Prepare until the level is full; the remaining buttons lock.
  for (let i = 0; i < 4; i++) {
    const free = level1.locator('button[data-spell-toggle][aria-pressed="false"]:enabled');
    if ((await free.count()) === 0) break;
    await free.first().click();
  }
  await expect(level1).toContainText('2 of 2 slots prepared');
  await expect(level1.locator('button[data-spell-toggle][aria-pressed="false"]').first()).toBeDisabled();

  // Every prepared spell is in the casting order.
  const prepared = await page.locator('button[data-spell-toggle][aria-pressed="true"]').count();
  await expect(page.locator('[data-spell-order] li')).toHaveCount(prepared);
});

test('casting order: move a spell up and change when it is cast', async ({ page }) => {
  await page.goto('/');
  await newCampaign(page, 'Spell Order');
  await openSpells(page, 'Mira');
  const level0 = page.locator('[data-spell-level="0"]');
  await level0.locator('button[data-spell-toggle][aria-pressed="false"]').first().click();
  const rules = page.locator('[data-spell-order] li');
  const second = await rules.nth(1).locator('b').innerText();
  await rules.nth(1).getByRole('button', { name: /up$/ }).click();
  await expect(rules.nth(0).locator('b')).toHaveText(second);

  const when = rules.nth(0).locator('select[data-spell-when]');
  await when.selectOption('selfHurt');
  await expect(when).toHaveValue('selfHurt');
  // Persisted in the plan: reopen the tab and it is still set.
  await page.locator('button:text-is("sheet")').click();
  await page.locator('button:text-is("spells")').click();
  await expect(page.locator('[data-spell-order] li').nth(0).locator('select[data-spell-when]')).toHaveValue('selfHurt');
});

test('a fighter has no spell page', async ({ page }) => {
  await page.goto('/');
  await newCampaign(page, 'No Spells');
  await page.locator('tr', { hasText: 'Torvald' }).locator('button:has-text("Open")').click();
  await expect(page.locator('button:text-is("spells")')).toHaveCount(0);
});
