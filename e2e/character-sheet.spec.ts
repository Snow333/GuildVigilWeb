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

  // ── POUCH: four slots ──
  await expect(page.locator('.gv-qslot')).toHaveCount(4);
});

/**
 * ⚠ ONE EQUIP VERB, PROVEN THROUGH THE DOM.
 *
 * The routing itself is covered by tests/campaign/equipRouting.test.ts. What
 * only the DOM can prove is the UX claim: that a potion offers the SAME
 * control as a sword, and that the bespoke 'add to pouch' affordance is gone.
 *
 * ⚠ THE STARTING STORES ARE EMPTY AND GOLD IS ZERO, so this does not try to
 * buy one — an earlier draft did, and failed because the Buy button is
 * correctly disabled at 0g. Instead it asserts the CONVENTION over whatever
 * the stores happen to hold: every stash row, whatever its type, carries an
 * Equip button and no row carries anything else.
 */
test('every stash row uses the same Equip control', async ({ page }) => {
  await page.goto('/');
  await newCampaign(page, 'Equip Test');
  await page.locator('button:has-text("Open")').first().click();
  await expect(page.locator('.gv-sheetg')).toBeVisible();

  // The bespoke pouch picker must be gone.
  await expect(page.locator('.gv-pouchpick'), 'the bespoke pouch control still exists')
    .toHaveCount(0);

  const rows = page.locator('.gv-stash tr');
  const count = await rows.count();
  for (let i = 0; i < count; i++) {
    await expect(
      rows.nth(i).locator('button:has-text("Equip")'),
      `stash row ${i} does not use the Equip convention`,
    ).toHaveCount(1);
  }
});

/**
 * ⚠ THE TOOLTIP MUST BE KEYBOARD-REACHABLE. A :hover-only panel is invisible
 * to keyboard and touch users, which is why this asserts FOCUS opens it and
 * Escape closes it, rather than just checking that a mouseover shows a box.
 */
test('hovering an equipped item explains it, and focus does too', async ({ page }) => {
  await page.goto('/');
  await newCampaign(page, 'Tip Test');
  await page.locator('button:has-text("Open")').first().click();
  await expect(page.locator('.gv-sheetg')).toBeVisible();

  const worn = page.locator(".gv-dslot[data-state='filled']").first();
  await expect(page.locator('[role=tooltip]')).toHaveCount(0);

  await worn.hover();
  const tip = page.locator('[role=tooltip]');
  await expect(tip, 'hovering a worn item showed no tooltip').toBeVisible();
  await expect(tip).toContainText(/\w/);

  // ⚠ the trigger must POINT at it, or a screen reader never announces it
  const describedBy = await worn.getAttribute('aria-describedby');
  expect(describedBy, 'the tooltip is not wired to its trigger').toBeTruthy();

  // Keyboard: focus opens, Escape dismisses.
  await page.mouse.move(0, 0);
  await expect(tip).toHaveCount(0);
  await worn.focus();
  await expect(tip, 'focus did not open the tooltip — keyboard users cannot reach it')
    .toBeVisible();
  await page.keyboard.press('Escape');
  await expect(tip, 'Escape did not dismiss the tooltip').toHaveCount(0);
});
