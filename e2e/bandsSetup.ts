import { expect, type Page } from '@playwright/test';
import { newCampaign } from './newCampaign';

/**
 * Build a guild with 1, 2 or 3 bands through the PRODUCTION screens, with the
 * dev panel standing in only for what play would take weeks to earn (gold,
 * materials, reputation). Used by bands.spec.ts and by the screenshot pass.
 */

async function devPanel(page: Page, fn: (panel: ReturnType<Page['locator']>) => Promise<void>): Promise<void> {
  await page.keyboard.press('`');
  const panel = page.locator('[data-gv-dev]');
  await expect(panel).toContainText('Dev panel');
  await fn(panel);
  await page.keyboard.press('`');
  await expect(panel).not.toContainText('Dev panel');
}

const level = async (page: Page, id: number): Promise<number> =>
  Number(await page.locator(`[data-tn-ledger] tr[data-b="${id}"] [data-level-value]`).textContent());

async function upgrade(page: Page, id: number, times: number): Promise<void> {
  for (let i = 0; i < times; i++) {
    const before = await level(page, id);
    await page.locator(`[data-tn-ledger] tr[data-b="${id}"] [data-upgrade]`).click();
    await expect.poll(() => level(page, id)).toBe(before + 1);
  }
}

/**
 * `bands` 1 with no extra hires is the bare founding guild (4 heroes, 1 band).
 * Otherwise the Barracks is raised to `bands` levels and filled to its beds.
 */
export async function buildGuild(page: Page, name: string, bands: 1 | 2 | 3, extraHires = 0): Promise<void> {
  await page.goto('/');
  await newCampaign(page, name);
  if (bands === 1 && extraHires === 0) return;

  await devPanel(page, async (panel) => {
    for (let i = 0; i < 6; i++) await panel.locator('[data-dev-stores]').click();
    for (let i = 0; i < 3; i++) await panel.locator('[data-dev-rep]').click();
    for (let i = 0; i < 5; i++) await panel.getByRole('button', { name: '+5000', exact: true }).click();
  });
  await page.locator('[data-nav-town-upgrades]').click();
  await page.locator('h1:has-text("Town & Upgrades")').waitFor();
  const fold = page.locator('details[data-fold="all"]');
  if ((await fold.getAttribute('open')) === null) await fold.locator('summary').click();

  await upgrade(page, 6, 1); // Tavern: recruits
  await upgrade(page, 2, bands); // Barracks: 6 / 10 / 15 beds
  const beds = bands === 1 ? 6 : bands === 2 ? 10 : 15;
  const hires = bands === 1 ? Math.min(extraHires, beds - 4) : beds - 4;
  const tavern = page.locator('[data-section="tavern"]');
  for (let i = 0; i < hires; i++) {
    await tavern.locator('[data-hire]:not([disabled])').first().click();
    await expect(page.locator('[data-tn-roster]')).toHaveText(`${4 + i + 1} of ${beds}`);
  }
}

/** Back to the hub from the Town & Upgrades screen, where `buildGuild` leaves the player. */
export async function toHub(page: Page): Promise<void> {
  if (await page.locator('h1:has-text("Town & Upgrades")').isVisible()) {
    await page.getByRole('button', { name: '◂ Town Hub' }).click();
    await page.locator('h1:has-text("Town Hub")').waitFor();
  }
}

/**
 * After a Send: the march lands on playback (a delve) or the surface field (a
 * camp). Either way, take the report and go home, exactly as core-loop does.
 */
export async function finishMarch(page: Page): Promise<void> {
  const playback = page.locator('h1:has-text("Dispatch playback")');
  const surface = page.locator('h1:has-text("Dispatch — quest")');
  await expect(playback.or(surface)).toBeVisible();
  await page.locator('button:has-text("After-action ▸")').click();
  await page.locator('h1:has-text("After-action")').waitFor();
  await page.locator('button:has-text("Return to town")').click();
  await page.locator('h1:has-text("Town Hub")').waitFor();
}

export async function openBands(page: Page): Promise<void> {
  await toHub(page);
  await page.locator('[data-nav-bands]').click();
  await page.locator('h1:has-text("Bands & jobs")').waitFor();
}

/** Level the first `heroes` rows of the dev panel's roster by `times` (production level-up path). */
export async function levelFirst(page: Page, heroes: number, times: number): Promise<void> {
  await devPanel(page, async (panel) => {
    const buttons = panel.getByRole('button', { name: '+1 level (auto)' });
    for (let h = 0; h < heroes; h++) {
      for (let t = 0; t < times; t++) await buttons.nth(h).click();
    }
  });
}

/** Advance weeks from the dev panel so the board is redrawn for the new levels. */
export async function advanceWeeks(page: Page, n: number): Promise<void> {
  await devPanel(page, async (panel) => {
    for (let i = 0; i < n; i++) await panel.getByRole('button', { name: 'Next week' }).click();
  });
}
