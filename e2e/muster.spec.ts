import { test, expect } from '@playwright/test';

/**
 * Brief #10 acceptance, on the built artifact:
 *  - a new campaign CANNOT start without a founding party
 *  - the player's ancestry/gender choices reach the roster and persist
 *  - the sketch-pending silhouette is a normal path (8 of 12 subjects lack art)
 *  - the muster is fully usable in flat mode — it is a required flow, not ornament
 */

test('the founding muster gates a new campaign and writes the player choices through', async ({ page }) => {
  await page.goto('/');
  await page.fill('input', 'E2E Muster');
  await page.locator('button:has-text("New campaign here")').first().click();

  // Gate: "New campaign here" no longer starts a campaign — it opens the muster.
  await page.locator('h1:has-text("The founding muster")').waitFor();
  await expect(page.locator('h1:has-text("Town Hub")')).toHaveCount(0);

  // Backing out leaves the slot untouched — nothing was committed.
  await page.locator('button:has-text("◂ Back to the charter")').click();
  await page.locator('h1:has-text("GUILD VIGIL")').waitFor();
  await expect(page.locator('tbody tr').first()).toContainText('empty');

  await page.fill('input', 'E2E Muster');
  await page.locator('button:has-text("New campaign here")').first().click();
  await page.locator('h1:has-text("The founding muster")').waitFor();

  // Author recruit 1: name, gender, then an ancestry WITH art (Half-Orc).
  await page.fill('.gv-sheet input.gv-input', 'Grusha');
  await page.locator('.gv-choice:has-text("Gender") button:has-text("woman")').click();
  await page.locator('.gv-mtile:has-text("Half-Orc")').click();
  await expect(page.locator('.gv-mtile:has-text("Half-Orc")')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.gv-roll .gv-rollmember').first()).toContainText('Grusha');
  await expect(page.locator('.gv-roll .gv-rollmember').first()).toContainText('Half-Orc woman');

  // Recruit 2 takes an ancestry with NO art — deliberately choosable.
  await page.locator('.gv-roll .gv-rollmember').nth(1).click();
  await page.locator('.gv-mtile:has-text("Gnome")').click();
  await expect(page.locator('.gv-mtile:has-text("Gnome") [data-sketch]')).toBeVisible();
  await expect(page.locator('.gv-mtile:has-text("Gnome")')).toContainText('awaiting field sketch');

  await page.locator('button:has-text("Sign the charter")').click();
  await page.locator('h1:has-text("Town Hub")').waitFor();

  // The choices reached the roster: the authored name, the right paste, and a
  // silhouette for the subject with no art.
  const roster = page.locator('.gv-ledger:has-text("Roster")');
  await expect(roster).toContainText('Grusha');
  await expect(roster.locator('[data-portrait="hero-halforc-f"]')).toBeVisible();
  await expect(roster.locator('[data-portrait="hero-gnome-m"][data-sketch]')).toBeVisible();
  // ...and art that DOES exist renders as a real image, not the fallback.
  await expect(roster.locator('[data-portrait="hero-halforc-f"] img.gv-art')).toBeVisible();

  // Survives the save/reload round trip (the backfill must not overwrite a
  // hero who already has an identity).
  await page.locator('button:has-text("Save")').first().click();
  await page.locator('button:has-text("Quit to title")').click();
  await page.locator('h1:has-text("GUILD VIGIL")').waitFor();
  await page.reload();
  await page.locator('button:has-text("Load")').click();
  await page.locator('h1:has-text("Town Hub")').waitFor();
  await expect(page.locator('.gv-ledger:has-text("Roster")')).toContainText('Grusha');
  await expect(
    page.locator('.gv-ledger:has-text("Roster") [data-portrait="hero-halforc-f"]'),
  ).toBeVisible();
});

test('the muster and its pastes are fully usable in flat mode (bible §5)', async ({ page }) => {
  // Turn flat mode on first — the muster must be right from its FIRST build,
  // not retrofitted after someone plays it flat.
  await page.goto('/');
  await page.fill('input', 'E2E Flat');
  await page.locator('button:has-text("New campaign here")').first().click();
  await page.locator('h1:has-text("The founding muster")').waitFor();
  await page.locator('button:has-text("Sign the charter")').click();
  await page.locator('h1:has-text("Town Hub")').waitFor();
  await page.locator('button:has-text("Settings")').click();
  await page.locator('[data-flat-on]').click();
  await expect(page.locator('body')).toHaveClass(/gv-flat/);

  await page.locator('button:has-text("◂ Town")').click();
  await page.locator('h1:has-text("Town Hub")').waitFor();

  // §5: the portrait STAYS (it is data — who this is); the ornament goes.
  const paste = page.locator('.gv-ledger:has-text("Roster") .gv-paste').first();
  await expect(paste).toBeVisible();
  await expect(paste.locator('img.gv-art, .gv-sil')).toBeVisible();
  expect(await paste.evaluate((el) => getComputedStyle(el).transform)).toBe('none');
  expect(await paste.locator('.gv-grain').evaluate((el) => getComputedStyle(el).display)).toBe('none');
  expect(await paste.locator('.gv-vig').evaluate((el) => getComputedStyle(el).display)).toBe('none');

  // The muster itself: every control is a real, labeled, operable button flat.
  await page.locator('button:has-text("Quit to title")').click();
  await page.locator('h1:has-text("GUILD VIGIL")').waitFor();
  await page.fill('input', 'E2E Flat Two');
  await page.locator('button:has-text("New campaign here")').last().click();
  await page.locator('h1:has-text("The founding muster")').waitFor();
  await expect(page.locator('body')).toHaveClass(/gv-flat/);

  await page.locator('.gv-mtile:has-text("Dwarf")').click();
  await expect(page.locator('.gv-mtile:has-text("Dwarf")')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('.gv-choice:has-text("Class") button:has-text("Wizard")').click();
  await expect(page.locator('.gv-roll .gv-rollmember').first()).toContainText('Dwarf');
  await page.locator('button:has-text("Sign the charter")').click();
  await page.locator('h1:has-text("Town Hub")').waitFor();
  await expect(page.locator('.gv-ledger:has-text("Roster")')).toContainText('Dwarf');
});
