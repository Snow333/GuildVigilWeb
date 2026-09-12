/**
 * CONSUMABLES & QUICK-SLOTS (brief #23 M3).
 *
 * ⚠ THE CENTRAL RISK HERE IS NOT "DOES THE POTION HEAL" — it is whether the
 * potion is GONE AFTERWARDS. Consumables are the first thing in the game that
 * must be spent permanently, across a boundary (Combatant → HeroKit) that
 * every prior feature was able to ignore. A heal that works but never
 * decrements is infinite healing, and it would look perfectly fine in a fight
 * log. So the spend path gets more tests than the effect path, and the
 * reconciliation step is sabotage-verified on its own.
 */

import { describe, it, expect } from 'vitest';
import {
  QUICK_SLOT_COUNT, emptyQuickSlots, normalizeQuickSlots, isQuickSlottable,
  isConsumableUsable, spellIdForItem, toCombatQuickSlots, reconcileQuickSlots, trackedMask,
} from '@sim/heroes/quickSlots';
import { backfillQuickSlots } from '@sim/save/backfills';
import { itemBasesById } from '@sim/heroes/equipment';
import { items } from '@content/generated/items';
import { spellsById } from '@sim/registry';
import type { ItemInstance } from '@sim/core/events/types';
import { musterParty } from '@sim/campaign/muster';
import { ancestryIds } from '@sim/registry';
import { CampaignSession } from '@sim/campaign/session';

const inst = (baseId: string): ItemInstance =>
  ({ baseId, potency: 0, tier: 0, propertyIds: [], seed: 'test' }) as unknown as ItemInstance;

/** A consumable the engine can actually execute, found from real content. */
const usableBaseId = (): string => {
  const row = items.find(
    (i) => i.item_type === 'consumable' && isConsumableUsable(String(i.id)),
  );
  if (!row) throw new Error('no usable consumable in content — M3 has nothing to test');
  return String(row.id);
};

describe('quick-slot shape', () => {
  it('D3 locked FOUR slots — the count is a design constraint, not a suggestion', () => {
    expect(QUICK_SLOT_COUNT).toBe(4);
    expect(emptyQuickSlots()).toHaveLength(4);
  });

  it('normalizes any stored shape, because saves predate the pouch', () => {
    expect(normalizeQuickSlots(undefined)).toHaveLength(4);
    expect(normalizeQuickSlots(null)).toHaveLength(4);
    expect(normalizeQuickSlots('nonsense')).toHaveLength(4);
    expect(normalizeQuickSlots([])).toHaveLength(4);
  });

  it('⚠ DROPS a fifth item rather than honouring it — five slots would break D3', () => {
    const five = [inst('a'), inst('b'), inst('c'), inst('d'), inst('e')];
    const out = normalizeQuickSlots(five);
    expect(out).toHaveLength(4);
    expect(out.map((s) => s?.baseId)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('a short array is padded, not left ragged', () => {
    const out = normalizeQuickSlots([inst('a')]);
    expect(out).toHaveLength(4);
    expect(out[0]?.baseId).toBe('a');
    expect(out.slice(1).every((s) => s === null)).toBe(true);
  });
});

describe('what may go in the pouch', () => {
  it('consumables and scrolls yes, gear no', () => {
    const consumable = items.find((i) => i.item_type === 'consumable');
    const scroll = items.find((i) => i.item_type === 'scroll');
    const weapon = items.find((i) => i.item_type === 'weapon');
    const armor = items.find((i) => i.item_type === 'armor');
    expect(isQuickSlottable(String(consumable!.id))).toBe(true);
    expect(isQuickSlottable(String(scroll!.id))).toBe(true);
    expect(isQuickSlottable(String(weapon!.id))).toBe(false);
    expect(isQuickSlottable(String(armor!.id))).toBe(false);
  });

  it('an unknown base id is not quick-slottable rather than throwing', () => {
    expect(isQuickSlottable('does-not-exist')).toBe(false);
  });
});

describe('readiness — the editor must not offer what the engine skips', () => {
  it('⚠ healing and damage consumables ARE usable today', () => {
    const usable = items.filter(
      (i) => i.item_type === 'consumable' && isConsumableUsable(String(i.id)),
    );
    // Measured: 6 of the 12 authored consumables resolve through resolveCast.
    expect(usable.length).toBeGreaterThanOrEqual(6);
  });

  it('⚠ buff consumables are authored, valid, and INERT until the buff brief', () => {
    const buffs = items.filter((i) => {
      if (i.item_type !== 'consumable') return false;
      const spellId = spellIdForItem(String(i.id));
      const spell = spellId === null ? null : spellsById.get(spellId);
      return spell?.effect_type === 'buff';
    });
    expect(buffs.length).toBeGreaterThan(0);
    for (const b of buffs) {
      expect(isConsumableUsable(String(b.id)), `${b.name} should be inert`).toBe(false);
    }
  });

  it('every consumable points at a real spell row — no dangling references', () => {
    for (const i of items.filter((x) => x.item_type === 'consumable')) {
      const spellId = spellIdForItem(String(i.id));
      expect(spellId, `${i.name} has no spell_id`).not.toBeNull();
      expect(spellsById.get(spellId!), `${i.name} -> missing spell ${spellId}`).toBeTruthy();
    }
  });
});

describe('the mirror stays index-aligned with the pouch', () => {
  it('⚠ an unusable item mirrors as null but does NOT shift the ones after it', () => {
    const buff = items.find(
      (i) => i.item_type === 'consumable' && !isConsumableUsable(String(i.id)),
    );
    const slots = normalizeQuickSlots([inst(String(buff!.id)), inst(usableBaseId())]);
    const mirror = toCombatQuickSlots(slots);
    expect(mirror[0]).toBeNull();
    // The usable item must still be at index 1 — not compacted to index 0.
    expect(mirror[1]?.index).toBe(1);
    expect(mirror[1]?.baseId).toBe(usableBaseId());
  });
});

describe('⚠ RECONCILIATION — the step that makes a potion actually GONE', () => {
  it('a spent slot is cleared from the kit and reported', () => {
    const base = usableBaseId();
    const slots = normalizeQuickSlots([inst(base)]);
    const mask = trackedMask(slots);
    const mirror = toCombatQuickSlots(slots);

    mirror[0] = null; // the sim drank it

    const spent = reconcileQuickSlots(slots, mirror, mask);
    expect(spent).toHaveLength(1);
    expect(spent[0]?.baseId).toBe(base);
    expect(slots[0]).toBeNull();
  });

  it('an UNDRUNK potion survives the trip', () => {
    const base = usableBaseId();
    const slots = normalizeQuickSlots([inst(base)]);
    const mask = trackedMask(slots);
    const mirror = toCombatQuickSlots(slots);

    const spent = reconcileQuickSlots(slots, mirror, mask);
    expect(spent).toHaveLength(0);
    expect(slots[0]?.baseId).toBe(base);
  });

  /**
   * ⚠ THE BUG THIS TEST EXISTS TO CATCH.
   *
   * An item the engine cannot execute is mirrored as `null` from the very
   * start. A naive reconciliation reading "null in the mirror means it was
   * used" would therefore DESTROY every inert potion the moment the party
   * finished its first fight — the player would watch their buff potions
   * evaporate without ever being drunk, and the fight log would show nothing.
   */
  it('⚠ an INERT potion is not silently destroyed by the first fight', () => {
    const buff = items.find(
      (i) => i.item_type === 'consumable' && !isConsumableUsable(String(i.id)),
    );
    const slots = normalizeQuickSlots([inst(String(buff!.id))]);
    const mask = trackedMask(slots);
    expect(mask[0], 'an inert item should not be tracked').toBe(false);

    const mirror = toCombatQuickSlots(slots);
    expect(mirror[0]).toBeNull();

    const spent = reconcileQuickSlots(slots, mirror, mask);
    expect(spent, 'nothing was drunk').toHaveLength(0);
    expect(slots[0]?.baseId, 'the inert potion must SURVIVE').toBe(String(buff!.id));
  });

  it('spends only the slot that emptied, leaving its neighbours alone', () => {
    const base = usableBaseId();
    const slots = normalizeQuickSlots([inst(base), inst(base), inst(base)]);
    const mask = trackedMask(slots);
    const mirror = toCombatQuickSlots(slots);

    mirror[1] = null; // only the middle one

    const spent = reconcileQuickSlots(slots, mirror, mask);
    expect(spent).toHaveLength(1);
    expect(slots[0]).not.toBeNull();
    expect(slots[1]).toBeNull();
    expect(slots[2]).not.toBeNull();
  });
});

describe('save backfill', () => {
  it('gives an old save an empty pouch and alt set, inventing nothing', () => {
    const save = { party: [{ hero: {}, equipped: [], loadout: [] }] };
    const out = backfillQuickSlots(save) as typeof save & {
      party: { quickSlots: unknown[]; altWeaponSet: unknown[] }[];
    };
    expect(out.party[0]!.quickSlots).toHaveLength(QUICK_SLOT_COUNT);
    expect(out.party[0]!.quickSlots.every((s) => s === null)).toBe(true);
    expect(out.party[0]!.altWeaponSet).toEqual([]);
  });

  it('⚠ does NOT hand veteran parties free potions', () => {
    const save = { party: [{ hero: {}, equipped: [], loadout: [] }] };
    const out = backfillQuickSlots(save) as { party: { quickSlots: unknown[] }[] };
    expect(out.party[0]!.quickSlots.filter((s) => s !== null)).toHaveLength(0);
  });

  it('repairs a malformed slot count instead of crashing a resolver later', () => {
    const save = { party: [{ quickSlots: [null, null, null, null, null, null, null] }] };
    const out = backfillQuickSlots(save) as { party: { quickSlots: unknown[] }[] };
    expect(out.party[0]!.quickSlots).toHaveLength(QUICK_SLOT_COUNT);
  });

  it('leaves an already-correct pouch untouched', () => {
    const base = usableBaseId();
    const existing = [inst(base), null, null, null];
    const save = { party: [{ quickSlots: existing, altWeaponSet: [] }] };
    const out = backfillQuickSlots(save) as { party: { quickSlots: (ItemInstance | null)[] }[] };
    expect(out.party[0]!.quickSlots[0]?.baseId).toBe(base);
  });

  it('survives a save with no party at all', () => {
    expect(() => backfillQuickSlots({})).not.toThrow();
    expect(() => backfillQuickSlots(null)).not.toThrow();
  });
});

describe('content sanity', () => {
  it('the scroll catalogue is real and quick-slottable', () => {
    const scrolls = items.filter((i) => i.item_type === 'scroll');
    expect(scrolls.length).toBeGreaterThan(20);
    for (const s of scrolls.slice(0, 10)) {
      expect(isQuickSlottable(String(s.id))).toBe(true);
    }
  });

  it('itemBasesById resolves every quick-slottable id', () => {
    for (const i of items.filter((x) => x.item_type === 'consumable')) {
      expect(itemBasesById.get(String(i.id)), `missing base ${i.id}`).toBeTruthy();
    }
  });
});

/**
 * ⚠ THE ROUND-TRIP TRAP, PINNED.
 *
 * Adding a backfilled field is a two-sided change: the backfill gives OLD
 * saves the field, and muster must give NEW campaigns the same field. Miss the
 * second half and `serialize → deserialize → serialize` stops round-tripping,
 * because load adds something save never wrote. That surfaced here as NINE
 * failures across session, storyline, saveStore and backfill suites — none of
 * which mention quick-slots, and all of which look like determinism bugs.
 *
 * This test names the real cause so the next person adding a backfilled field
 * gets a one-line diagnosis instead of a morning of bisecting.
 */
describe('⚠ muster and the backfill agree by construction', () => {
  it('a NEW campaign kit already carries every field the backfill would add', () => {
    const kit = musterParty([
      { classId: 1, name: 'Roundtrip', ancestry: ancestryIds[0]!, gender: 'm' as const },
    ])[0]!;

    expect(kit.quickSlots, 'muster must create the pouch, not leave it to load').toBeDefined();
    expect(kit.quickSlots).toHaveLength(QUICK_SLOT_COUNT);
    expect(kit.altWeaponSet, 'muster must create the alt set too').toEqual([]);

    // The backfill must find nothing to do — that identity IS the round-trip.
    const before = JSON.stringify(kit);
    backfillQuickSlots({ party: [kit] });
    expect(JSON.stringify(kit), 'backfill changed a freshly mustered kit').toBe(before);
  });
});

/**
 * WEAPON SETS — data model only (D4). Steven chose to store the second set now
 * and build the swap later.
 *
 * ⚠ THIS TEST EXISTS TO STOP IT ROTTING. `item_level` was authored, unread,
 * and quietly forgot what it was for. A half-built field with no test is how
 * that happens, so the persistence contract is pinned even though no gameplay
 * reads it yet.
 */
describe('⚠ D4 — the alt weapon set persists though nothing reads it yet', () => {
  it('survives a serialize → deserialize round trip', () => {
    const party = musterParty([
      { classId: 1, name: 'Alt', ancestry: ancestryIds[0]!, gender: 'm' as const },
    ]);
    party[0]!.altWeaponSet = [inst(usableBaseId())];
    const s = CampaignSession.create({ campaignId: 'altset', seed: 'seed-altset', party });

    const restored = CampaignSession.deserialize(s.serialize());
    const back = restored.serialize().party[0] as { altWeaponSet?: unknown[] };
    expect(back.altWeaponSet, 'the second weapon set was dropped by save/load').toHaveLength(1);
  });

  it('a quick-slotted potion also survives save/load', () => {
    const base = usableBaseId();
    const party = musterParty([
      { classId: 1, name: 'Pouch', ancestry: ancestryIds[0]!, gender: 'm' as const },
    ]);
    party[0]!.quickSlots = normalizeQuickSlots([inst(base)]);
    const s = CampaignSession.create({ campaignId: 'pouch', seed: 'seed-pouch', party });

    const restored = CampaignSession.deserialize(s.serialize());
    const back = restored.serialize().party[0] as { quickSlots?: ({ baseId: string } | null)[] };
    expect(back.quickSlots?.[0]?.baseId, 'the pouch was dropped by save/load').toBe(base);
  });
});
