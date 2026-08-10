import { expect, test } from '@playwright/test';
import { buildFixtureDispatch } from '@sim/fixtures/dispatchFixture';
import { interpretStream } from '../src/ui/beats/interpret';

/**
 * THE PHASE 2 EXIT CRITERION, DOM half (brief #5 §4): the artifact's
 * #beat-fixture route must show EXACTLY the lines the Vitest snapshot pinned —
 * same interpreter, same frozen fixture, now through the real bundle and DOM.
 */

test('the DOM shows exactly the pinned contract-fixture lines', async ({ page }) => {
  const expected = interpretStream(buildFixtureDispatch()).lines.map(
    (l) => `${l.tick} [${l.tone}] ${l.text}`,
  );
  expect(expected.length).toBeGreaterThan(20); // the fixture is a real story

  await page.goto('/#beat-fixture');
  await expect(page.locator('h1')).toHaveText('Beat-feed contract fixture');
  await expect(page.locator('[data-beat]')).toHaveCount(expected.length);
  expect(await page.locator('[data-beat]').allTextContents()).toEqual(expected);
});
