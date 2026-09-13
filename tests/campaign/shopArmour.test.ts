/**
 * THE SHOP SELLS ARMOUR (2026-09-13).
 *
 * ⚠ FOR MONTHS IT SOLD NONE AT ALL. All eight armour rows in `shop_stock` were
 * authored at `required_building_level` 2 or 3, and `session.shopStock()` skips
 * every row above level 1 because BUILDING LEVELS DO NOT EXIST — there is no
 * building-level state in the save, the session or the campaign. The filter was
 * honest about an unbuilt system; the authored levels were a progression gate
 * written against a system that never arrived.
 *
 * In player terms: you could not buy armour, in a game whose central pleasure is
 * kitting out each hero by hand.
 *
 * `data/seeds/seed_shop_sells_armour.sql` moved all eight to level 1 and records
 * the original values, because the gate is DEFERRED, not deleted.
 *
 * ⚠ THIS TEST ASSERTS THE CONSUMER, NOT THE CONTENT. Checking that the rows say
 * `required_building_level: 1` would assert the seed against itself — the exact
 * tautology that let `stat_bonus` stay green through a total outage, and that a
 * sabotage run caught in brief #26. The contract is that armour REACHES A PLAYER
 * THROUGH `shopStock()`, so that is what is measured here, across enough weeks
 * for the 6-slot rotation to be sampled.
 */

import { describe, expect, it } from 'vitest';
import { CampaignSession } from '@sim/campaign/session';
import { starterParty } from '../fixtures/party-fixture';
import { shop_stock } from '@content/generated/shop_stock';

const newSession = (id: string): CampaignSession =>
  CampaignSession.create({ campaignId: id, seed: `world_${id}`, party: starterParty() });

/** Armour names offered across N weeks of rotation — one session, advancing time. */
function armourOfferedOver(weeks: number, id: string): Set<string> {
  const s = newSession(id);
  const seen = new Set<string>();
  for (let w = 0; w < weeks; w++) {
    s.advanceWeek();
    for (const offer of s.shopStock()) {
      // ⚠ Reads the DERIVED item the player is actually shown, not the raw
      // registry row — `derived.itemType` is the same field the shop UI reads.
      if (offer.derived.itemType === 'armor') seen.add(offer.derived.displayName);
    }
  }
  return seen;
}

describe('the shop sells armour', () => {
  it('offers armour to a player within a reasonable number of weeks', () => {
    // 20 weeks against a 6-of-22 rotation: if armour is purchasable at all, it
    // appears many times over. If the level filter ever excludes it again, this
    // set is empty and the test fails loudly.
    const seen = armourOfferedOver(20, 'armour_shop_1');
    // ⚠ Assert on the NAMES, not just the set size. A first draft checked only
    // `seen.size > 0` and passed VACUOUSLY on a set containing one empty string
    // (the offer field was `derived.name`, which does not exist — it is
    // `displayName`). A test that passes on a bug in itself is decoration.
    const names = [...seen].filter((n) => n.length > 0);
    expect(names.length).toBeGreaterThan(0);
  });

  it('offers armour across the whole weight range, not just the cheap end', () => {
    // The heavy band matters most: it is what the Fighter and Cleric are
    // proficient in, and it was gated hardest (Half/Full Plate were level 3).
    const seen = armourOfferedOver(40, 'armour_shop_2');
    const names = [...seen].join('|');
    expect(names).toMatch(/Leather|Padded|Studded/); // light
    expect(names).toMatch(/Chain|Scale/); // medium
    expect(names).toMatch(/Plate/); // heavy — the rows that were level 3
  });

  it('a player can actually buy a piece of armour and it lands in the stash', () => {
    // The full consumer contract: offered -> affordable -> owned.
    const s = newSession('armour_shop_3');
    const stashBefore = s.serialize().stash.length;
    let bought: string | null = null;
    for (let w = 0; w < 40 && bought === null; w++) {
      s.advanceWeek();
      for (const offer of s.shopStock()) {
        if (offer.derived.itemType !== 'armor') continue;
        (s as unknown as { gold: number }).gold = offer.price + 10;
        s.buyItem(offer.offerIndex);
        bought = offer.derived.displayName;
        break;
      }
    }
    expect(bought).not.toBeNull();
    expect(s.serialize().stash.length).toBe(stashBefore + 1);
  });

  /**
   * ⚠ THE NEGATIVE CONTROL. Without this, the tests above would still pass if
   * the level filter were deleted entirely and EVERY row became purchasable —
   * which would be a different bug wearing the same green tick. Rows at level 2
   * and 3 must still be withheld.
   */
  it('still withholds the content that is genuinely gated behind building levels', () => {
    const s = newSession('armour_shop_4');
    // ⚠ `new Set<number>`, not `new Set` — generated tables are `as const`, so
    // `r.id` is a literal union and an inferred Set rejects a plain number on
    // lookup. Same widening rule as the Map lookups in CLAUDE.md.
    const gatedIds = new Set<number>(
      shop_stock.filter((r) => (r.required_building_level as number) > 1).map((r) => r.id as number),
    );
    expect(gatedIds.size).toBeGreaterThan(0); // there is still gated content to withhold
    for (let w = 0; w < 20; w++) {
      s.advanceWeek();
      for (const offer of s.shopStock()) {
        expect(gatedIds.has(offer.offerIndex)).toBe(false);
      }
    }
  });
});
