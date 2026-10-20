import { test, expect, type Page } from '@playwright/test';
import { buildGuild, finishMarch, levelFirst, openBands, toHub } from './bandsSetup';

/**
 * M4 — the band screen (variant B, the job-by-band grid) on the built artifact.
 * Built through the production screens; the dev panel only supplies the gold,
 * materials and reputation that weeks of play would.
 */

const headCount = (page: Page): Promise<number> => page.locator('[data-bandhead]').count();
const levelOf = async (page: Page, band: number): Promise<number> =>
  Number(await page.locator(`[data-bandhead="${band}"] [data-level-value]`).textContent());

test('one band: one column, a locked teaser, and a Send only for the band that exists', async ({ page }) => {
  await buildGuild(page, 'Bands One', 1);
  await openBands(page);

  expect(await headCount(page)).toBe(1);
  await expect(page.locator('[data-locked-band="1"]')).toContainText('Band 2');
  await expect(page.locator('[data-bd-plates]')).toContainText('BANDS 1 of 3');
  await expect(page.locator('[data-hall-hero]')).toHaveCount(0);
  await expect(page.locator('[data-hall-empty]')).toBeVisible();
  const sends = page.locator('[data-send]');
  expect(await sends.count()).toBeGreaterThan(0);
  expect(await page.locator('[data-send^="1:"]').count()).toBe(0);
  // the board's own words are on the page, one per posting, with the sim's reason
  expect(await page.locator('[data-cell][data-kind="send"] [data-reason]').count()).toBe(await sends.count());
});

test("two bands: both send in one week, and the second no longer sees the first one's job", async ({ page }) => {
  await buildGuild(page, 'Bands Two', 2);
  await openBands(page);

  expect(await headCount(page)).toBe(2);
  await expect(page.locator('[data-locked-band="2"]')).toBeVisible();
  await expect(page.locator('[data-bd-plates]')).toContainText('HEROES 10 of 10');
  // 4 march in band 1, 4 in band 2 (Guild Hall caps a band), 2 wait at the hall (Barracks houses 10)
  await expect(page.locator('[data-hall-hero]')).toHaveCount(2);
  await expect(page.locator('[data-roster-summary]')).toContainText('Band 1: 4 · Band 2: 4 · Hall: 2');

  const posted = await page.locator('tbody tr[data-q]').count();
  const best1 = page.locator('[data-cell][data-band="0"][data-best]');
  await expect(best1).toHaveCount(1);
  const job = await best1.getAttribute('data-cell');

  // Send Band 1 on its best fit: it marches at once and lands on playback
  await best1.locator('[data-send]').click();
  await finishMarch(page);
  await openBands(page);

  // that job left the board for BOTH bands
  await expect(page.locator(`tr[data-q="${job}"]`)).toHaveCount(0);
  expect(await page.locator('tbody tr[data-q]').count()).toBe(posted - 1);

  // Band 2 can now be sent too, and never shares Band 1's star
  const best2 = page.locator('[data-cell][data-band="1"][data-best]');
  if ((await best2.count()) === 0) {
    // nothing short of "Beyond us" for Band 2: the screen says so by NOT starring one
    await page.locator('[data-send^="1:"]').first().click();
  } else {
    await expect(best2).toHaveCount(1);
    expect(await best2.getAttribute('data-cell')).not.toBe(job);
    await best2.locator('[data-send]').click();
  }
  await finishMarch(page);
});

test("the hall hint is what the band's level really becomes", async ({ page }) => {
  await buildGuild(page, 'Bands Hints', 2);
  await levelFirst(page, 4, 3); // Band 1 climbs; Band 2 and the hall stay level 1
  await openBands(page);

  // free a seat in Band 2 so a hall hero can walk in
  await page.locator('[data-roster-toggle]').click();
  const band2Hero = page.locator('[data-roster-col="1"] [data-roster-hero]').first();
  await band2Hero.locator('[data-move$=":hall"]').click();
  await expect(page.locator('[data-hall-hero]')).toHaveCount(3);

  // every live hall move: read the hint, click it, check the plate says that, put the hero back
  const heroId = (await page.locator('[data-hall-hero]').first().getAttribute('data-hall-hero'))!;
  let checked = 0;
  for (const band of [0, 1]) {
    const move = page.locator(`[data-hall-hero="${heroId}"] [data-move="${heroId}:${band}"]`);
    if (await move.isDisabled()) continue; // Band 1 is full: the screen withheld it
    const hint = (await move.locator('[data-hint]').textContent())!;
    const m = hint.match(/level (?:stays (\d+)|(\d+) → (\d+))/)!;
    const expected = Number(m[1] ?? m[3]);
    await move.click();
    await expect.poll(() => levelOf(page, band)).toBe(expected);
    checked++;
    await page.locator(`[data-roster-col="${band}"] [data-roster-hero="${heroId}"] [data-move$=":hall"]`).click();
    await expect(page.locator(`[data-hall-hero="${heroId}"]`)).toBeVisible();
  }
  expect(checked).toBeGreaterThan(0);
});

test('a band that is out is greyed and locked: no Send, no moves, and Call back gives the job back', async ({ page }) => {
  await buildGuild(page, 'Bands Out', 2);
  await toHub(page);
  // Band 1 takes a job on the Quest board and is left out on it (accepted, not launched)
  await page.locator('button:has-text("Quest board")').click();
  await page.locator('[data-posting]').first().locator('button:has-text("Accept")').click();
  await page.locator('h1:has-text("Dispatch setup")').waitFor();
  await page.locator('button:has-text("◂ Town")').click();
  await openBands(page);

  const head = page.locator('[data-bandhead="0"]');
  await expect(head).toContainText('OUT ON A JOB');
  await expect(page.locator('[data-bandhead="0"][data-out]')).toHaveCount(1);
  expect(await page.locator('[data-cell][data-band="0"] [data-send]').count()).toBe(0);
  // Band 2 is untouched
  expect(await page.locator('[data-cell][data-band="1"] [data-send]').count()).toBeGreaterThan(0);
  // a hall hero cannot be moved into the out band
  const hallMove = page.locator('[data-hall-hero] [data-move$=":0"]').first();
  await expect(hallMove).toBeDisabled();
  await expect(hallMove).toHaveAttribute('title', 'Band 1 is out on a job');
  // ...nor out of it
  await page.locator('[data-roster-toggle]').click();
  await expect(page.locator('[data-roster-col="0"] [data-locked]')).toHaveCount(4);
  await expect(page.locator('[data-roster-col="0"] [data-move]')).toHaveCount(0);

  const posted = await page.locator('tbody tr[data-q]:not(.is-taken)').count();
  await head.locator('[data-call-back]').click();
  await expect(page.locator('[data-bandhead="0"][data-out]')).toHaveCount(0);
  expect(await page.locator('tbody tr[data-q]:not(.is-taken)').count()).toBe(posted + 1);
  expect(await page.locator('[data-cell][data-band="0"] [data-send]').count()).toBeGreaterThan(0);
});

test('three bands: no locked teaser, three even columns, nothing wider than the screen', async ({ page }) => {
  await buildGuild(page, 'Bands Three', 3);
  await openBands(page);
  expect(await headCount(page)).toBe(3);
  await expect(page.locator('[data-locked-band]')).toHaveCount(0);
  await expect(page.locator('[data-bd-plates]')).toContainText('BANDS 3 of 3');
  await expect(page.locator('[data-bd-plates]')).toContainText('HEROES 15 of 15');
  const widths = await page.locator('[data-bandhead]').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().width)));
  expect(Math.max(...widths) - Math.min(...widths)).toBeLessThanOrEqual(2);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
