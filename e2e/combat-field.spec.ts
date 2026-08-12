import { expect, test, type Page } from '@playwright/test';
import { newCampaign } from './newCampaign';

/**
 * Brief #12 §4/§7 — the field, in the built artifact.
 *
 * What this proves that the unit tests cannot: the field MOUNTS on a real
 * record, its units are labelled by NAME (the bug this brief exists to kill was
 * every enemy printing `disp_1:camp_e0`), skim genuinely holds the field, and
 * flat mode strips the furniture while keeping every number.
 */

const MAX_WEEKS = 16;

/** Play forward, taking the first posting each week, until a field mounts. */
async function reachAFight(page: Page): Promise<void> {
  for (let week = 0; week < MAX_WEEKS; week++) {
    await page.locator('button:has-text("Advance week")').first().click();
    await page.locator('button:has-text("Quest board")').click();
    await page.locator('h1:has-text("Quest board")').waitFor();

    const postings = page.locator('[data-posting]');
    if (await postings.count() === 0) {
      await page.locator('button:has-text("◂ Town")').click();
      await page.locator('h1:has-text("Town Hub")').waitFor();
      continue;
    }

    await postings.first().locator('button:has-text("Accept")').click();
    await page.locator('h1:has-text("Dispatch setup")').waitFor();
    await page.locator('button:has-text("Launch dispatch")').click();

    const playback = page.locator('h1:has-text("Dispatch playback")');
    const surface = page.locator('h1:has-text("Dispatch — quest")');
    await expect(playback.or(surface)).toBeVisible();

    if (await page.locator('.gv-field').count() > 0) return;

    // A mission with no fight at all — take the report and keep going.
    if (await playback.isVisible()) {
      await page.locator('button:has-text("Skip ▸▸")').click();
      await page.locator('button:has-text("After-action ▸")').click();
    } else {
      await page.locator('button:has-text("After-action report")').click();
    }
    await page.locator('h1:has-text("After-action")').waitFor();
    await page.locator('button:has-text("Return to town")').click();
    await page.locator('h1:has-text("Town Hub")').waitFor();
  }
  throw new Error(`no fight reached in ${MAX_WEEKS} weeks`);
}

test('the field mounts on a real fight, names its units, and skims and flattens honestly', async ({ page }) => {
  await page.goto('/');
  await newCampaign(page, 'Field E2E');
  await reachAFight(page);

  const field = page.locator('.gv-field').first();
  await expect(field).toBeVisible();

  // ── every unit is drawn, labelled, and mirrored in the roster ──
  const units = page.locator('.gv-field-unit');
  const unitCount = await units.count();
  expect(unitCount).toBeGreaterThan(1);
  await expect(page.locator('.gv-roster li')).toHaveCount(unitCount);

  // THE BUG THIS KILLS: labels are names, never raw instance ids.
  const labels = await page.locator('.gv-field-name').allTextContents();
  expect(labels).toHaveLength(unitCount);
  for (const label of labels) {
    expect(label.trim().length, 'a unit label is never empty').toBeGreaterThan(0);
    expect(label, `"${label}" is a raw instance id`).not.toMatch(/disp_|:/);
  }

  // The scale and the key are part of the data, not decoration.
  await expect(field.locator('text=1 SQUARE = 5 FT')).toBeVisible();
  await expect(field.locator('text=25 FT')).toBeVisible();

  // Both gauges render, and silence is measured against the real 300-tick window.
  await expect(page.locator('.gv-gauge-bar')).toHaveCount(2);
  await expect(page.locator('.gv-gauge-label').filter({ hasText: 'silence' })).toContainText('/ 300 ticks');

  // ── selection rings the engagement radius ──
  await page.locator('.gv-roster li').first().click();
  await expect(field.locator('.gv-field-ring--engage')).toBeVisible();
  await expect(field.locator('text=ENGAGE 7.5 FT')).toBeVisible();

  // ── skim (D2): 16× holds the field and says so; watch resumes it ──
  // Scoped to the FIGHT's transport: a dungeon playback also shows the run's
  // 1×/4×/16× ladder, and the two share labels.
  const transport = page.locator('[data-transport="combat"]');
  await expect(field.locator('.gv-field-held')).toHaveCount(0);
  await transport.locator('button:has-text("16×")').click();
  await expect(field.locator('.gv-field-held')).toBeVisible();
  await expect(field.locator('text=SKIM — FIELD HELD')).toBeVisible();
  await transport.locator('button:has-text("½×")').click();
  await expect(field.locator('.gv-field-held')).toHaveCount(0);

  // ── the record is the same feed, and it names its enemies too ──
  const beats = page.locator('.gv-feed .gv-beat').first();
  await transport.locator('button:has-text("beat ▸")').click();
  await expect(beats).toBeVisible();
  for (const line of await page.locator('.gv-feed .gv-beat').allTextContents()) {
    expect(line, `"${line}" leaks a raw instance id`).not.toMatch(/disp_\d+:/);
  }

  // ── flat mode strips the furniture and keeps every fact (brief #8) ──
  // Counts, not visibility, for the SVG primitives: a grid rule is a
  // zero-width line, which Playwright's heuristic calls hidden.
  const before = {
    hp: await page.locator('.gv-field-hp').allTextContents(),
    names: await page.locator('.gv-field-name').allTextContents(),
    rules: await page.locator('.gv-field-rule').count(),
    bars: await page.locator('[class*="gv-field-bar-fill--s"]').count(),
    targeting: await page.locator('.gv-field-target').count(),
  };
  expect(before.bars, 'HP bars are drawn').toBeGreaterThan(0);

  await page.evaluate(() => document.body.classList.add('gv-flat'));
  await expect(page.locator('body.gv-flat')).toHaveCount(1);
  await expect(field).toBeVisible();

  expect(await page.locator('.gv-field-hp').allTextContents(), 'HP numbers survive flat mode').toEqual(before.hp);
  expect(await page.locator('.gv-field-name').allTextContents(), 'names survive flat mode').toEqual(before.names);
  expect(await page.locator('.gv-field-rule').count(), 'the grid survives flat mode').toBe(before.rules);
  expect(await page.locator('[class*="gv-field-bar-fill--s"]').count(), 'the HP bars survive flat mode').toBe(before.bars);
  expect(await page.locator('.gv-field-target').count(), 'targeting survives flat mode').toBe(before.targeting);
  await expect(field.locator('text=1 SQUARE = 5 FT')).toBeVisible();
  await expect(page.locator('.gv-roster li')).toHaveCount(unitCount);
  await expect(page.locator('.gv-gauge-bar')).toHaveCount(2);
});
