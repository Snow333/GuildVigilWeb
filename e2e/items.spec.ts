/**
 * ITEM CARDS ON THE BUILT ARTIFACT (M2 itemization pass).
 *
 * ⚠ WHAT STEVEN SAW on the Worn panel: "Magical Cloak of Resistance +1 — +1
 * to every strike". The unit tests in tests/items/itemCards.test.ts prove each
 * card number reaches the combatant; this proves the SCREEN shows those words.
 *
 * The magic gear is put in the save itself (the same JSON the game writes),
 * then loaded through the real Load button. The shop rotates weekly and the
 * founding party owns nothing magic, so this is the only deterministic way to
 * hold a loot cloak — and it is exactly the shape a chest produces: an
 * authored cloak stamped with instance tier `magical`.
 */
import { test, expect, type Page } from '@playwright/test';
import { newCampaign } from './newCampaign';

const SHOTS = process.env['GV_SHOTS'] ?? '';

async function loadWithMagicGear(page: Page): Promise<void> {
  await page.goto('/');
  await newCampaign(page, 'Item Cards');
  await page.locator('button:has-text("Save")').first().click();

  await page.evaluate(() => {
    const key = Object.keys(localStorage).find((k) => k.startsWith('gv_save_'))!;
    const env = JSON.parse(localStorage.getItem(key)!) as {
      state: { party: { equipped: unknown[] }[]; stash: unknown[] };
    };
    const hero = env.state.party[0]!;
    hero.equipped = [
      { baseId: '2', tier: 'enchanted', propertyIds: ['keen', 'unholy'], seed: 'e2e_blade' }, // Shortsword
      { baseId: '22', tier: 'mundane', propertyIds: [], seed: 'e2e_leather' },               // Leather Armor
      { baseId: '54', tier: 'magical', propertyIds: [], seed: 'e2e_cloak' },                 // Cloak of Resistance +1
    ];
    env.state.stash = [
      { baseId: '59', tier: 'magical', propertyIds: [], seed: 'e2e_ring' },                  // Ring of Protection +1
      { baseId: '35', tier: 'mundane', propertyIds: [], seed: 'e2e_potion' },                // Healing Potion (Minor)
      { baseId: '132', tier: 'magical', propertyIds: [], seed: 'e2e_dagger2' },              // Dagger +2
      { baseId: '133', tier: 'magical', propertyIds: [], seed: 'e2e_sword2' },               // Longsword +2
      { baseId: '16', tier: 'mundane', propertyIds: [], seed: 'e2e_staff' },                 // Staff
    ];
    localStorage.setItem(key, JSON.stringify(env));
  });

  await page.locator('button:has-text("Quit to title")').click();
  await page.locator('h1:has-text("GUILD VIGIL")').waitFor();
  await page.reload();
  await page.locator('button:has-text("Load")').click();
  await page.locator('h1:has-text("Town Hub")').waitFor();
}

test('worn magic items say what they really do', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await loadWithMagicGear(page);
  await page.locator('button:has-text("Open")').first().click();
  await expect(page.locator('.gv-sheetg')).toBeVisible();

  const box = (slot: string) => page.locator(`.gv-dslot[data-slot='${slot}']`);
  await expect(box('accessory').locator('.gv-dnm')).toHaveText('Cloak of Resistance +1');
  await expect(box('accessory').locator('.gv-dco')).toHaveText('+1 to all saves');
  await expect(box('main_hand').locator('.gv-dnm')).toHaveText('Keen Unholy Shortsword +2');
  await expect(box('main_hand').locator('.gv-dco')).toHaveText('+2 to hit · 1d6 piercing');
  await expect(box('armor').locator('.gv-dco')).toHaveText('AC +2 (Dex max +4)');

  // ⚠ The lie must be gone from the whole sheet, not just these boxes.
  await expect(page.locator('.gv-sheetg')).not.toContainText('every strike');

  // The inspector names each rider in plain words and greys the ones the
  // engine cannot do yet.
  await box('main_hand').click();
  const keen = page.locator('.gv-effect', { hasText: 'Keen' });
  await expect(keen).toContainText('crits on 19–20');
  await expect(keen).toHaveAttribute('data-live', 'no');
  await expect(keen).toContainText('not working yet');

  // The cloak's saves really land on the sheet's save ledger.
  await expect(
    page.locator('.gv-led', { hasText: 'Fortitude' }).locator('.gv-led-row', { hasText: 'Worn items' }),
  ).toContainText('+1');

  // The stash reads with the same describer.
  await expect(page.locator('.gv-stash tr', { hasText: 'Ring of Protection +1' }).locator('[data-item-summary]'))
    .toHaveText('AC +1');
  await expect(page.locator('.gv-stash tr', { hasText: 'Healing Potion' }).locator('[data-item-summary]'))
    .toHaveText('Heals 1d8+4 once');

  if (SHOTS) await page.screenshot({ path: `${SHOTS}/sheet-items.png`, fullPage: true });
});

test('the shop describes wares with the same card text', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await loadWithMagicGear(page);
  await page.locator('button:has-text("Shop")').click();
  await expect(page.locator('h1')).toContainText('Market row');

  const summaries = page.locator('[data-item-summary]');
  expect(await summaries.count(), 'no ware shows what it does').toBeGreaterThan(5);
  await expect(page.locator('.gv-shop')).not.toContainText('every strike');

  // The sell list uses the describer too.
  const ring = page.locator('tr[data-sell-row]', { hasText: 'Ring of Protection +1' });
  await expect(ring.locator('[data-item-summary]')).toHaveText('AC +1');

  // Track I2: the rune carries the value. A +2 dagger (was 16g) is worth within
  // 15g of a +2 longsword (was 120g), and the Staff is no longer worth 0g.
  const worth = async (name: string): Promise<number> => {
    const text = await page.locator('tr[data-sell-row]', { hasText: name }).locator('td', { hasText: 'worth' }).innerText();
    return Number(/worth (\d+)g/.exec(text)![1]);
  };
  const dagger2 = await worth('Dagger +2');
  const sword2 = await worth('Longsword +2');
  expect(dagger2).toBe(252);
  expect(sword2).toBe(265);
  expect(await worth('Staff')).toBe(2);

  if (SHOTS) await page.screenshot({ path: `${SHOTS}/shop-items.png`, fullPage: true });
});
