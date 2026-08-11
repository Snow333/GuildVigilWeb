import type { Page } from '@playwright/test';

/**
 * Start a campaign from the title screen, through the FOUNDING MUSTER (brief
 * #10). Signing with the muster's defaults reproduces the historical starter
 * party exactly — Torvald / Shade / Mira / Elandra, same stats, same gear — so
 * every deterministic e2e trace that predates the muster still holds.
 */
export async function newCampaign(page: Page, name: string): Promise<void> {
  await page.fill('input', name);
  await page.locator('button:has-text("New campaign here")').first().click();
  await page.locator('h1:has-text("The founding muster")').waitFor();
  await page.locator('button:has-text("Sign the charter")').click();
  await page.locator('h1:has-text("Town Hub")').waitFor();
}
