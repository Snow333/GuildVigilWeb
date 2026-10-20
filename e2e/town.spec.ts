import { test, expect, type Page } from '@playwright/test';
import { newCampaign } from './newCampaign';

/**
 * M3 track T — the Town & Upgrades screen on the built artifact.
 *
 * The stores start empty (resources only arrive from secured sites), so the dev
 * panel's "+20 each" / "+500" buttons stand in for a few weeks of play. They
 * are real session commands (`grantResources`, `devAddGold`), so everything the
 * screen does afterwards is the production path.
 */

async function stock(page: Page, kind: string): Promise<number> {
  return Number(await page.locator(`[data-res="${kind}"] [data-have]`).textContent());
}

async function gold(page: Page): Promise<number> {
  return Number(await page.locator('[data-tn-gold]').textContent());
}

async function devPanel(page: Page, fn: (panel: ReturnType<Page['locator']>) => Promise<void>): Promise<void> {
  await page.keyboard.press('`');
  const panel = page.locator('[data-gv-dev]');
  await expect(panel).toContainText('Dev panel');
  await fn(panel);
  await page.keyboard.press('`');
  await expect(panel).not.toContainText('Dev panel');
}

async function openTown(page: Page): Promise<void> {
  await page.locator('[data-nav-town-upgrades]').click();
  await page.locator('h1:has-text("Town & Upgrades")').waitFor();
}

/** The ledger fold is closed when there are picks; open it so rows are visible. */
async function openLedger(page: Page): Promise<void> {
  const fold = page.locator('details[data-fold="all"]');
  if ((await fold.getAttribute('open')) === null) await fold.locator('summary').click();
  await expect(page.locator('[data-tn-ledger] tbody tr')).toHaveCount(18);
}

const level = async (page: Page, id: number): Promise<number> =>
  Number(await page.locator(`[data-tn-ledger] tr[data-b="${id}"] [data-level-value]`).textContent());

test('buying the first pick spends the stock and raises the building level', async ({ page }) => {
  await page.goto('/');
  await newCampaign(page, 'Town Buy');
  await devPanel(page, async (panel) => {
    await panel.locator('[data-dev-stores]').click();
  });
  await openTown(page);

  // Pick 1 on this guild is the Guild Hall: it costs no gold, only timber + stone.
  const pick = page.locator('[data-rank="1"]');
  await expect(pick).toHaveAttribute('data-pick', '1');
  await expect(pick).toContainText('Guild Hall');
  await expect(pick).toContainText('Send 5 heroes on a mission');

  await openLedger(page);
  const timberBefore = await stock(page, 'timber');
  const stoneBefore = await stock(page, 'stone');
  const levelBefore = await level(page, 1);
  expect(timberBefore).toBe(20);
  expect(levelBefore).toBe(1);
  await expect(page.locator('[data-tn-roster]')).toHaveText('4 of 4');

  await pick.locator('[data-upgrade]').click();

  // Stock fell by the bill (20 timber, 12 stone), level rose by one, the party grew.
  await expect.poll(() => stock(page, 'timber')).toBe(timberBefore - 20);
  expect(await stock(page, 'stone')).toBe(stoneBefore - 12);
  expect(await level(page, 1)).toBe(levelBefore + 1);
  // No Barracks in this test, so the books still hold only the founding four.
  await expect(page.locator('[data-tn-roster]')).toHaveText('4 of 4');
  await expect(page.locator('[data-ghlevel="2"]')).toHaveAttribute('data-state', 'built');
  await expect(page.locator('[data-tn-error]')).toHaveCount(0);

  // The bought offer is gone from the picks (level 2 → 3 needs iron the guild lacks).
  await expect(page.locator('[data-pick="1"]')).toHaveCount(0);
});

test('a Tavern and a BARRACKS let the player hire a fifth hero', async ({ page }) => {
  await page.goto('/');
  await newCampaign(page, 'Town Hire');
  await devPanel(page, async (panel) => {
    await panel.locator('[data-dev-stores]').click();
    await panel.getByRole('button', { name: '+500', exact: true }).click();
  });
  await openTown(page);
  await expect(page.locator('[data-section="tavern"]')).toHaveCount(0); // no Tavern yet

  await openLedger(page);
  await page.locator('[data-tn-ledger] tr[data-b="1"] [data-upgrade]').click();
  await expect.poll(() => level(page, 1)).toBe(2);
  // M4: the Guild Hall makes room in the BAND; the Barracks makes room on the
  // BOOKS, and hiring is capped by the books.
  await page.locator('[data-tn-ledger] tr[data-b="2"] [data-upgrade]').click();
  await expect.poll(() => level(page, 2)).toBe(1);

  const goldBeforeTavern = await gold(page);
  await page.locator('[data-tn-ledger] tr[data-b="6"] [data-upgrade]').click();
  await expect.poll(() => level(page, 6)).toBe(1);
  expect(await gold(page)).toBe(goldBeforeTavern - 100);

  const tavern = page.locator('[data-section="tavern"]');
  await expect(tavern).toBeVisible();
  await expect(page.locator('[data-tn-roster]')).toHaveText('4 of 6'); // 6 beds from the Barracks

  const goldBeforeHire = await gold(page);
  await tavern.locator('[data-recruit-name]').fill('Wren');
  await tavern.locator('[data-hire]').first().click();

  await expect(page.locator('[data-tn-roster]')).toHaveText('5 of 6');
  expect(await gold(page)).toBe(goldBeforeHire - 150);
  // One bed left, so hiring is still open — the band is full at 5 but the
  // books are not. That split IS the M4 change.
  await expect(tavern.locator('[data-hire]:not([disabled])').first()).toBeEnabled();

  // The new hero is on the hub roster.
  await page.getByRole('button', { name: '◂ Town Hub' }).click();
  await expect(page.locator('.gv-who', { hasText: 'Wren' })).toBeVisible();
});

test('blocked rows show the sim\'s own reason; unwired effects are greyed and tagged; no raw keys', async ({ page }) => {
  await page.goto('/');
  await newCampaign(page, 'Town Honest');
  await openTown(page);
  await openLedger(page);

  const g = await gold(page);
  // Verbatim sentence from the sim, not rebuilt by the UI.
  await expect(page.locator('tr[data-b="6"] [data-why]')).toContainText(`Needs 100 gold — the guild has ${g}.`);
  await expect(page.locator('tr[data-b="8"] [data-why]')).toContainText('Needs Library at level 1 first.');
  await expect(page.locator('tr[data-b="1"] [data-why]')).toContainText('Short 20 more timber, 12 more stone.');

  /**
   * The Chapel's next effect is authored but not implemented.
   *
   * ⚠ THIS USED TO POINT AT THE BARRACKS, WHICH M4 WIRED. Pick a subject that
   * is still inert when this test breaks, rather than deleting it — the thing
   * being guarded is that the UI never sells an effect the engine does not
   * keep, and that is only testable against a genuinely dead one.
   */
  const chapel = page.locator('tr[data-b="5"]');
  await expect(chapel.locator('[data-effect="unwired"]')).toContainText('Resting heals half your wounds');
  await expect(chapel.locator('[data-not-working]')).toContainText('Not working yet');
  // …and the Guild Hall's wired effect carries no such tag.
  // (both the level it has now and the one it is buying)
  await expect(page.locator('tr[data-b="1"] [data-effect="wired"]')).toHaveCount(2);
  await expect(page.locator('tr[data-b="1"] [data-not-working]')).toHaveCount(0);

  // Nothing affordable on day one: no pick cards, an honest line instead.
  await expect(page.locator('[data-pick]')).toHaveCount(0);
  await expect(page.locator('[data-tn-gap]')).toContainText('Nothing is ready to buy yet.');
  // A blocked row's button is off.
  await expect(page.locator('tr[data-b="6"] [data-upgrade]')).toBeDisabled();

  // Every one of the 9 stores and its weekly income is on the page.
  await expect(page.locator('[data-res]')).toHaveCount(9);
  await expect(page.locator('[data-res="timber"] [data-income]')).toHaveText('+0/wk');

  // No raw effect key (snake_case) anywhere the player can read.
  const text = await page.locator('main').innerText();
  expect(text).not.toMatch(/\b[a-z]+_[a-z0-9]+(?:_[a-z0-9]+)*\b/);
});
