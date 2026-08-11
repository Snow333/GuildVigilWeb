import { test, expect } from '@playwright/test';
import { newCampaign } from './newCampaign';

/**
 * Brief #8 rollout step 5 — the chart's acceptance criteria on the built
 * artifact, pinned where unit tests can't reach (the rendered DOM):
 *  - "?" secrecy: unsurveyed markers carry no quest name in text or tooltip
 *  - wash pairing: a pressure wash NEVER renders without its red-ink label
 *  - nav contract: board "Map" buttons land here with the posting selected
 * The campaign is deterministic ("E2E Test" seeds the world).
 */

test('the chart: "?" secrecy, wash label-pairing, board→map selection', async ({ page }) => {
  test.setTimeout(120_000);

  await page.goto('/');
  await newCampaign(page, 'E2E Test');

  // Fresh campaign: the guild has surveyed nothing — every marker is "?" and
  // leaks no name through text content or a <title> tooltip.
  await page.locator('button:has-text("World map")').click();
  await page.locator('h1:has-text("The chart")').waitFor();
  const pois = page.locator('[data-map-poi]');
  const poiCount = await pois.count();
  expect(poiCount, 'week 1 posts at least one quest').toBeGreaterThan(0);
  for (let i = 0; i < poiCount; i++) {
    const poi = pois.nth(i);
    await expect(poi).toHaveAttribute('data-discovered', 'false');
    expect((await poi.locator('text').textContent())?.trim()).toBe('?');
    expect(await poi.locator('title').count(), 'no tooltip on an unsurveyed marker').toBe(0);
  }

  // Nav contract: the board's "Map" button lands here with that posting
  // selected and its route traced in red ink.
  await page.locator('button:has-text("◂ Town")').click();
  await page.locator('h1:has-text("Town Hub")').waitFor();
  await page.locator('button:has-text("Quest board")').click();
  await page.locator('h1:has-text("Quest board")').waitFor();
  const first = page.locator('[data-posting]').first();
  const questId = await first.getAttribute('data-quest-id');
  await first.locator('button:has-text("Map")').click();
  await page.locator('h1:has-text("The chart")').waitFor();
  await expect(page.locator(`[data-map-poi][data-quest-id="${questId}"][data-selected]`)).toBeVisible();
  await expect(page.locator('[data-route]')).toBeVisible();
  await expect(page.locator('[data-route] text')).toContainText('min each way');

  // Wash pairing: let unaccepted postings expire until pressure rises somewhere
  // (expiry feeds escalation), then check every wash carries its annotation.
  await page.locator('button:has-text("◂ Town")').click();
  await page.locator('h1:has-text("Town Hub")').waitFor();
  let washCount = 0;
  for (let round = 0; round < 4 && washCount === 0; round++) {
    for (let w = 0; w < 4; w++) {
      await page.locator('button:has-text("Advance Week")').click();
    }
    await page.locator('button:has-text("World map")').click();
    await page.locator('h1:has-text("The chart")').waitFor();
    washCount = await page.locator('[data-wash]').count();
    if (washCount === 0) {
      await page.locator('button:has-text("◂ Town")').click();
      await page.locator('h1:has-text("Town Hub")').waitFor();
    }
  }
  expect(washCount, 'expiries raised pressure somewhere within 16 weeks').toBeGreaterThan(0);
  const washes = page.locator('[data-wash]');
  for (let i = 0; i < washCount; i++) {
    const wash = washes.nth(i);
    const tier = Number(await wash.getAttribute('data-tier'));
    expect(tier).toBeGreaterThanOrEqual(1);
    expect(tier).toBeLessThanOrEqual(3);
    const label = (await wash.locator('[data-wash-label]').textContent())?.trim() ?? '';
    expect(label, 'a wash never renders without its red-ink annotation').toContain('pressure');
    expect(label.length).toBeGreaterThan(8);
  }
});
