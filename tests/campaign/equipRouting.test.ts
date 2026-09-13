/**
 * ONE EQUIP VERB (Steven's UX call, 2026-09-12).
 *
 * ⚠ THE BUG THIS PREVENTS IS A SILENT ROUTE CHANGE. `equip` now dispatches on
 * item type — consumables to the pouch, gear to its slot — and a dispatcher
 * that sends everything down ONE branch still looks correct for whichever
 * half you happen to test. Both branches are asserted here, along with the
 * invariant that makes the whole thing safe: routing a potion to the pouch
 * must NOT put it in a gear slot, and vice versa.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { CampaignSession } from '@sim/campaign/session';
import { starterParty } from '@sim/campaign/starterParty';
import { itemBasesById } from '@sim/heroes/equipment';

/** The base id of the first item with the given predicate. */
function baseIdWhere(pred: (b: Record<string, unknown>) => boolean): string {
  for (const [id, base] of itemBasesById) {
    if (pred(base as Record<string, unknown>)) return id;
  }
  throw new Error('no matching item base');
}

/** A main-hand weapon, for the gear branch. */
const WEAPON_ID = baseIdWhere((b) => b['slot'] === 'main_hand');

/** The base id of the first consumable in the content DB. */
const POTION_ID = (() => {
  for (const [id, base] of itemBasesById) {
    if ((base as Record<string, unknown>)['item_type'] === 'consumable') return id;
  }
  throw new Error('the content DB has no consumable');
})();

/**
 * A session whose stash holds `count` potions.
 *
 * ⚠ SEEDED THROUGH SERIALIZE/DESERIALIZE, not by reaching into private state.
 * There is no grant API, and a test that pokes `session['stash']` would keep
 * passing if the save format stopped carrying the stash at all.
 */
function sessionWithPotions(count: number): CampaignSession {
  const base = CampaignSession.create({
    campaignId: 'equip', seed: 'world_equip', party: starterParty(),
  });
  const state = JSON.parse(JSON.stringify(base.serialize()));
  for (let i = 0; i < count; i++) {
    state.stash.push({ baseId: POTION_ID, tier: 'mundane', propertyIds: [], seed: `potion_${i}` });
  }
  // ⚠ and one weapon, so the GEAR branch has something to route.
  state.stash.push({ baseId: WEAPON_ID, tier: 'mundane', propertyIds: [], seed: 'weapon_0' });
  return CampaignSession.deserialize(state);
}

const potionIndex = (s: CampaignSession) =>
  s.stashView().findIndex((r) => r.instance.baseId === POTION_ID);

describe('equip routes by item type', () => {
  let session: CampaignSession;
  let heroId: string;

  beforeEach(() => {
    session = sessionWithPotions(6);
    heroId = session.roster()[0]!.id;
  });

  it('⚠ a CONSUMABLE equips into the pouch, not a gear slot', () => {
    expect(session.heroAttribution(heroId).quickSlots.filter((q) => q.name)).toHaveLength(0);

    session.equip(heroId, potionIndex(session));

    const after = session.heroAttribution(heroId);
    expect(after.quickSlots.filter((q) => q.name), 'the potion did not reach the pouch')
      .toHaveLength(1);
    // ⚠ and it must NOT have landed in a worn slot
    expect(after.slots.filter((s) => /potion/i.test(s.name ?? '')), 'a potion was worn as gear')
      .toHaveLength(0);
  });

  it('⚠ GEAR still equips into its slot, not the pouch', () => {
    const idx = session.stashView().findIndex((r) => r.derived.slot === 'main_hand');
    expect(idx, 'no weapon in the starting stash').toBeGreaterThanOrEqual(0);
    const name = session.stashView()[idx]!.derived.displayName;

    session.equip(heroId, idx);

    const after = session.heroAttribution(heroId);
    expect(after.slots.find((s) => s.slot === 'main_hand')?.name).toBe(name);
    expect(after.quickSlots.filter((q) => q.name), 'a weapon landed in the pouch')
      .toHaveLength(0);
  });

  describe('equipTarget tells the UI where a row would go', () => {
    it('names the pouch for a consumable and the slot for gear', () => {
      expect(session.equipTarget(heroId, potionIndex(session)))
        .toEqual({ kind: 'pouch', reason: 'into the pouch' });

      const gearIdx = session.stashView().findIndex((r) => r.derived.slot === 'main_hand');
      const t = session.equipTarget(heroId, gearIdx);
      expect(t.kind).toBe('gear');
      expect(t.reason).toMatch(/main hand/);
    });

    /**
     * ⚠ A FULL POUCH MUST SAY SO RATHER THAN THROWING. The button is disabled
     * from this value, so 'none' here is what stops equip() being called at
     * all — the two have to agree or the UI throws on click.
     */
    it('reports a full pouch instead of letting equip throw', () => {
      for (let i = 0; i < 4; i++) session.equip(heroId, potionIndex(session));

      const idx = potionIndex(session);
      const target = session.equipTarget(heroId, idx);
      expect(target.kind, 'a full pouch should not advertise room').toBe('none');
      expect(target.reason).toMatch(/full/i);
      expect(() => session.equip(heroId, idx)).toThrow(/full/i);
    });
  });

  it('⚠ the pouch survives a save round-trip', () => {
    session.equip(heroId, potionIndex(session));
    const restored = CampaignSession.deserialize(JSON.parse(JSON.stringify(session.serialize())));
    expect(restored.heroAttribution(heroId).quickSlots.filter((q) => q.name)).toHaveLength(1);
  });
});
