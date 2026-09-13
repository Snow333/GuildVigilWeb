/**
 * THE CHARACTER SHEET, ON THE BUILT ARTIFACT (brief #24, Variant G).
 *
 * ⚠ THIS SPEC EXISTS BECAUSE THE UNIT TESTS CANNOT SEE THE SCREEN. The
 * attribution ledgers are proven correct in tests/heroes/attribution.test.ts,
 * but "the numbers are right" and "the sheet renders" are different claims —
 * a crashed component, an unstyled paperdoll or a slot box positioned off the
 * page would all leave those unit tests perfectly green.
 */
import { test, expect } from '@playwright/test';
import { newCampaign } from './newCampaign';

test('the sheet shows ledgers, a paperdoll, and a working pouch', async ({ page }) => {
  await page.goto('/');
  await newCampaign(page, 'Sheet Test');

  // Into the first hero's sheet (Torvald, the starter fighter).
  await page.locator('button:has-text("Open")').first().click();

  // The sheet tab is the default landing tab.
  await expect(page.locator('.gv-sheetg')).toBeVisible();

  // ── LEDGERS: a total AND its sources, not just a number ──
  const ac = page.locator('.gv-led', { hasText: 'Armour class' }).first();
  await expect(ac).toBeVisible();
  const acTotal = await ac.locator('.gv-led-total').first().innerText();
  expect(Number(acTotal), 'AC should be a real number').toBeGreaterThan(0);
  // ⚠ The point of the whole brief: the number must be EXPLAINED.
  await expect(ac.locator('.gv-led-row'), 'AC must list its sources').not.toHaveCount(0);
  await expect(ac.locator(".gv-led-row:has-text('Base')")).toBeVisible();

  // ── PAPERDOLL: every slot rendered, with a state ──
  const slots = page.locator('.gv-dslot');
  await expect(slots).toHaveCount(7);
  for (const state of ['filled', 'empty']) {
    await expect(
      page.locator(`.gv-dslot[data-state='${state}']`).first(),
      `no slot in the '${state}' state`,
    ).toBeVisible();
  }

  // ⚠ The figure art must actually load — a broken data URI renders nothing
  // and the doll silently becomes a box of floating labels.
  const figure = page.locator('.gv-doll-figure');
  await expect(figure).toBeVisible();
  const naturalWidth = await figure.evaluate((el) => (el as HTMLImageElement).naturalWidth ?? 0);
  expect(naturalWidth, 'the paperdoll figure image failed to decode').toBeGreaterThan(100);

  // ── INSPECTOR: clicking a slot explains that item ──
  await page.locator(".gv-dslot[data-state='filled']").first().click();
  await expect(page.locator('.gv-insp-name')).toBeVisible();
  await expect(page.locator('.gv-effect').first(), 'a worn item should list effects').toBeVisible();

  // ── POUCH: four slots, and stocking one actually works ──
  await expect(page.locator('.gv-qslot')).toHaveCount(4);
  const pouchOption = page.locator('[data-pouch-option]').first();
  if (await pouchOption.count() > 0) {
    const filledBefore = await page.locator(".gv-qslot[data-filled='yes']").count();
    await pouchOption.click();
    await expect(
      page.locator(".gv-qslot[data-filled='yes']"),
      'stocking the pouch did not fill a slot',
    ).toHaveCount(filledBefore + 1);
  }
});
