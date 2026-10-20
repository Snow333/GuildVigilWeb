import { expect, test, type Page } from '@playwright/test';
import { newCampaign } from './newCampaign';

/**
 * M4 — fog of war on the built artifact.
 *  - a fresh campaign's chart is mostly dark, Haven is lit, terrain art is not
 *    drawn in the dark
 *  - postings in the dark are plain "?" rumours: no red cross, no name
 *  - after a mission the guild has walked a road, and more of the chart is lit
 *  - the dev panel's "Reveal map" lifts the fog (and brings it back)
 *  - building a Watchtower (through the real Town screen) widens sight and
 *    lights MORE of the same chart without the guild walking anywhere
 */

interface FogReading {
  revealed: number;
  total: number;
  sight: number;
  lifted: string | null;
}

async function openChart(page: Page): Promise<void> {
  await page.locator('button:has-text("World map")').click();
  await page.locator('h1:has-text("The chart")').waitFor();
}

async function readFog(page: Page): Promise<FogReading> {
  const svg = page.locator('svg[data-fog-total]');
  return {
    revealed: Number(await svg.getAttribute('data-fog-revealed')),
    total: Number(await svg.getAttribute('data-fog-total')),
    sight: Number(await svg.getAttribute('data-fog-sight')),
    lifted: await svg.getAttribute('data-fog-lifted'),
  };
}

/** Terrain glyph groups currently drawn (forest masses + mountain peaks). */
const glyphCount = async (page: Page): Promise<number> =>
  (await page.locator('svg g.gv-chart-forest').count())
  + (await page.locator('svg path[d^="M-10 6"]').count());

test('the chart starts dark, opens up after a mission, and the dev panel lifts it', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/');
  await newCampaign(page, 'Fog Test');

  // ── fresh guild: mostly dark ──
  await openChart(page);
  const fresh = await readFog(page);
  expect(fresh.total).toBe(80 * 60);
  expect(fresh.lifted).toBe('false');
  expect(fresh.sight, 'no Watchtower: base sight').toBe(3);
  expect(fresh.revealed, 'Haven and a small halo are lit').toBeGreaterThan(10);
  expect(fresh.revealed / fresh.total, 'a fresh map is mostly dark').toBeLessThan(0.05);
  await expect(page.locator('[data-fog-cover]')).toHaveCount(1);
  const freshGlyphs = await glyphCount(page);

  // Every posting is in the dark: a rumour, never a red cross or a name.
  const pois = page.locator('[data-map-poi]');
  const poiCount = await pois.count();
  expect(poiCount).toBeGreaterThan(0);
  let dark = 0;
  for (let i = 0; i < poiCount; i++) {
    const poi = pois.nth(i);
    if ((await poi.getAttribute('data-in-fog')) !== 'true') continue;
    dark++;
    expect((await poi.locator('text').textContent())?.trim()).toBe('?');
    expect(await poi.locator('path.gv-chart-red').count(), 'no red cross in the dark').toBe(0);
    expect(await poi.locator('title').count()).toBe(0);
  }
  expect(dark, 'week-one postings lie beyond the starting halo').toBeGreaterThan(0);

  // ── lift the fog with the dev panel, then put it back ──
  await page.keyboard.press('`');
  const panel = page.locator('[data-gv-dev]');
  await expect(panel).toContainText('Dev panel');
  await panel.locator('button', { hasText: 'Reveal map' }).click();
  await page.keyboard.press('`');
  await expect(panel).not.toContainText('Dev panel');
  expect((await readFog(page)).lifted).toBe('true');
  await expect(page.locator('[data-fog-cover]')).toHaveCount(0);
  expect(await glyphCount(page), 'lifting the fog draws the terrain art').toBeGreaterThan(freshGlyphs);
  await page.keyboard.press('`');
  await panel.locator('button', { hasText: 'Hide map' }).click();
  await page.keyboard.press('`');
  await expect(panel).not.toContainText('Dev panel');
  expect((await readFog(page)).lifted).toBe('false');

  // ── send the guild on a mission ──
  await page.locator('button:has-text("◂ Town")').click();
  await page.locator('h1:has-text("Town Hub")').waitFor();
  await page.locator('button:has-text("Quest board")').click();
  await page.locator('h1:has-text("Quest board")').waitFor();
  await page.locator('[data-posting]').first().locator('button:has-text("Accept")').click();
  await page.locator('h1:has-text("Dispatch setup")').waitFor();
  await page.locator('button:has-text("Launch dispatch")').click();
  await page.locator('button:has-text("After-action ▸")').click();
  await page.locator('h1:has-text("After-action")').waitFor();
  await page.locator('button:has-text("Return to town")').click();
  await page.locator('h1:has-text("Town Hub")').waitFor();

  // ── after the mission: the road is lit ──
  await openChart(page);
  const after = await readFog(page);
  expect(after.revealed, 'walking the road opened new ground').toBeGreaterThan(fresh.revealed * 2);
  expect(after.revealed).toBeLessThan(after.total);
  expect(after.revealed / after.total, 'one mission does not light the whole map').toBeLessThan(0.5);
});

test('a Watchtower widens sight and lights more of the chart without any new walking', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/');
  await newCampaign(page, 'Fog Tower');
  await openChart(page);
  const before = await readFog(page);
  expect(before.sight).toBe(3);

  await page.locator('button:has-text("◂ Town")').click();
  await page.locator('h1:has-text("Town Hub")').waitFor();

  // The stores start empty: the dev panel stands in for weeks of play.
  await page.keyboard.press('`');
  const panel = page.locator('[data-gv-dev]');
  await expect(panel).toContainText('Dev panel');
  for (let i = 0; i < 4; i++) await panel.locator('[data-dev-stores]').click();
  for (let i = 0; i < 2; i++) await panel.locator('[data-dev-rep]').click();
  await panel.locator('button', { hasText: '+5000' }).click();
  await page.keyboard.press('`');
  await expect(panel).not.toContainText('Dev panel');

  await page.locator('[data-nav-town-upgrades]').click();
  await page.locator('h1:has-text("Town & Upgrades")').waitFor();
  const fold = page.locator('details[data-fold="all"]');
  if ((await fold.getAttribute('open')) === null) await fold.locator('summary').click();
  // The Watchtower needs the Barracks first, then rises two levels.
  const levelOf = async (id: number): Promise<number> =>
    Number(await page.locator(`[data-tn-ledger] tr[data-b="${id}"] [data-level-value]`).textContent());
  await page.locator('[data-tn-ledger] tr[data-b="2"] [data-upgrade]').click();
  await expect.poll(() => levelOf(2)).toBe(1);
  // Honest copy: the Watchtower row is no longer marked "not working yet".
  await expect(page.locator('[data-tn-ledger] tr[data-b="11"] [data-not-working]')).toHaveCount(0);

  const sightAfter = async (towerLevel: number): Promise<FogReading> => {
    await page.locator('[data-tn-ledger] tr[data-b="11"] [data-upgrade]').click();
    await expect.poll(() => levelOf(11)).toBe(towerLevel);
    await page.locator('button:has-text("◂ Town Hub")').click();
    await page.locator('h1:has-text("Town Hub")').waitFor();
    await openChart(page);
    const reading = await readFog(page);
    await page.locator('button:has-text("◂ Town")').click();
    await page.locator('h1:has-text("Town Hub")').waitFor();
    await page.locator('[data-nav-town-upgrades]').click();
    await page.locator('h1:has-text("Town & Upgrades")').waitFor();
    if ((await fold.getAttribute('open')) === null) await fold.locator('summary').click();
    return reading;
  };
  const small = await sightAfter(1);
  expect(small.sight).toBe(6);
  expect(small.revealed, 'a wider halo around Haven, no walking').toBeGreaterThan(before.revealed * 2);
  const large = await sightAfter(2);
  expect(large.sight).toBe(9);
  expect(large.revealed).toBeGreaterThan(small.revealed);
});
