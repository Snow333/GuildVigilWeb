/**
 * CONSUMABLES IN A REAL ENCOUNTER (brief #23 M3) — exposure tests.
 *
 * ⚠ THE UNIT TESTS IN quickSlots.test.ts PROVE THE PLUMBING, NOT THE FEATURE.
 * They call reconcileQuickSlots directly, so they would stay green if the
 * `consume` verb never fired a single time in combat. These tests drive the
 * real encounter loop and assert a potion was actually drunk, healed someone,
 * and vanished — the three things a player would notice.
 */

import { describe, it, expect } from 'vitest';
import { runEncounter } from '@sim/combat/encounter';
import { buildEnemy } from '@sim/combat/build';
import { assembleHero } from '@sim/campaign/assembly';
import { musterParty } from '@sim/campaign/muster';
import { ancestryIds } from '@sim/registry';
import { normalizeQuickSlots, toCombatQuickSlots, trackedMask, reconcileQuickSlots, isConsumableUsable } from '@sim/heroes/quickSlots';
import { items } from '@content/generated/items';
import { spellsById } from '@sim/registry';
import type { ItemInstance } from '@sim/core/events/types';
import type { LoadoutEntry } from '@sim/combat/loadout';

const inst = (baseId: string): ItemInstance =>
  ({ baseId, potency: 0, tier: 0, propertyIds: [], seed: 'test' }) as unknown as ItemInstance;

/** A healing consumable from real content — the clearest thing to observe. */
const healingPotion = (): string => {
  const row = items.find((i) => {
    if (i.item_type !== 'consumable') return false;
    const spell = spellsById.get(i.spell_id as number);
    return spell?.effect_type === 'healing';
  });
  if (!row) throw new Error('no healing consumable in content');
  return String(row.id);
};

const FIGHTER = 1;

function woundedFighterWithPotion(potionBase: string, loadout: LoadoutEntry[]) {
  const kit = musterParty([
    { classId: FIGHTER, name: 'Drinker', ancestry: ancestryIds[0]!, gender: 'm' as const },
  ])[0]!;
  kit.quickSlots = normalizeQuickSlots([inst(potionBase)]);
  kit.loadout = loadout;
  const assembled = assembleHero(kit);
  const c = assembled.c;
  c.quickSlots = toCombatQuickSlots(normalizeQuickSlots(kit.quickSlots));
  return { kit, c };
}

describe('⚠ EXPOSURE — a potion is really drunk in a real fight', () => {
  const potion = healingPotion();

  it('the consume verb fires and emits a spell_cast for the potion', () => {
    const { c } = woundedFighterWithPotion(potion, [
      { action: 'consume', slotIndex: 0, condition: { kind: 'selfHpBelow', pct: 95 }, target: 'self' },
      { action: 'strike', condition: { kind: 'always' }, target: 'nearestEnemy' },
    ]);
    c.hp = 3; // badly hurt, so the condition fires immediately

    const enemy = buildEnemy(1, 'e1');
    const stream = runEncounter('c_consume', 'r_consume', [c], [enemy], 'seed-7').stream;

    const potionSpellId = String(spellsById.get(
      items.find((i) => String(i.id) === potion)!.spell_id as number,
    )!.id);
    const casts = stream.all().filter(
      (e) => e.type === 'combat.spell_cast'
        && (e.data as { casterId: string; spellId: string }).casterId === c.id
        && (e.data as { spellId: string }).spellId === potionSpellId,
    );
    expect(casts.length, 'the fighter never drank the potion').toBeGreaterThan(0);
  });

  it('⚠ the potion HEALS — the effect reaches hp, not just the log', () => {
    const { c } = woundedFighterWithPotion(potion, [
      { action: 'consume', slotIndex: 0, condition: { kind: 'selfHpBelow', pct: 95 }, target: 'self' },
      { action: 'strike', condition: { kind: 'always' }, target: 'nearestEnemy' },
    ]);
    c.hp = 3;

    const enemy = buildEnemy(1, 'e1');
    enemy.hp = 1000; // keep the fight alive long enough to observe
    const stream = runEncounter('c_consume', 'r_consume', [c], [enemy], 'seed-11').stream;

    const heals = stream.all().filter(
      (e) => e.type === 'combat.healing_applied'
        && (e.data as { targetId: string }).targetId === c.id,
    );
    expect(heals.length, 'no healing landed on the drinker').toBeGreaterThan(0);
  });

  it('⚠ THE SLOT IS EMPTY AFTERWARDS — a drunk potion is gone', () => {
    const { c } = woundedFighterWithPotion(potion, [
      { action: 'consume', slotIndex: 0, condition: { kind: 'selfHpBelow', pct: 95 }, target: 'self' },
      { action: 'strike', condition: { kind: 'always' }, target: 'nearestEnemy' },
    ]);
    c.hp = 3;
    expect(c.quickSlots[0], 'precondition: the potion is in the pouch').not.toBeNull();

    const enemy = buildEnemy(1, 'e1');
    runEncounter('c_consume', 'r_consume', [c], [enemy], 'seed-13');

    expect(c.quickSlots[0], 'the slot should be spent').toBeNull();
  });

  /**
   * ⚠ THE INFINITE-POTION TEST.
   *
   * One potion, a fight long enough for many actions. If the slot were not
   * nulled before resolution, the fighter would drink the same potion every
   * time their HP condition was true — an unlimited heal that would look
   * entirely normal in the log.
   */
  it('⚠ ONE potion is drunk ONCE, however long the fight runs', () => {
    const { c } = woundedFighterWithPotion(potion, [
      { action: 'consume', slotIndex: 0, condition: { kind: 'selfHpBelow', pct: 99 }, target: 'self' },
      { action: 'strike', condition: { kind: 'always' }, target: 'nearestEnemy' },
    ]);
    c.hp = 2;
    c.maxHp = 500; // stays "below 99%" all fight, so the condition never stops firing

    const enemy = buildEnemy(1, 'e1');
    enemy.hp = 5000;
    const stream = runEncounter('c_consume', 'r_consume', [c], [enemy], 'seed-17').stream;

    const potionSpellId = String(spellsById.get(
      items.find((i) => String(i.id) === potion)!.spell_id as number,
    )!.id);
    const casts = stream.all().filter(
      (e) => e.type === 'combat.spell_cast'
        && (e.data as { casterId: string }).casterId === c.id
        && (e.data as { spellId: string }).spellId === potionSpellId,
    );
    expect(casts.length, `drank the same potion ${casts.length} times`).toBe(1);
  });

  /**
   * ⚠ A CONSUMABLE MUST NOT DRAIN SPELL SLOTS. The potion routes through
   * resolveCast, which normally spends a slot — these rows are level 0 so
   * spendCost returns 'atWill', but a future edit to either side could
   * quietly start charging the drinker for their own potion.
   */
  it('⚠ drinking does not cost a spell slot', () => {
    const { c } = woundedFighterWithPotion(potion, [
      { action: 'consume', slotIndex: 0, condition: { kind: 'selfHpBelow', pct: 95 }, target: 'self' },
      { action: 'strike', condition: { kind: 'always' }, target: 'nearestEnemy' },
    ]);
    c.hp = 3;

    const enemy = buildEnemy(1, 'e1');
    const stream = runEncounter('c_consume', 'r_consume', [c], [enemy], 'seed-19').stream;

    const potionCasts = stream.all().filter(
      (e) => e.type === 'combat.spell_cast'
        && (e.data as { casterId: string }).casterId === c.id,
    );
    for (const ev of potionCasts) {
      expect((ev.data as { resource: string }).resource).toBe('atWill');
      expect((ev.data as { cost: number }).cost).toBe(0);
    }
  });

  /**
   * ⚠ REACH: a healing potion is `touch`/self. Without the consume-specific
   * reach branch the wounded hero would be forced to walk into WEAPON range of
   * an enemy before drinking their own potion.
   */
  it('⚠ a hero drinks from range — no walking into melee to heal', () => {
    const { c } = woundedFighterWithPotion(potion, [
      { action: 'consume', slotIndex: 0, condition: { kind: 'selfHpBelow', pct: 95 }, target: 'self' },
    ]);
    c.hp = 3;

    const enemy = buildEnemy(1, 'e1');
    enemy.hp = 2000;
    // Park the enemy far away: if reach were weapon-based, the hero would have
    // to close the gap first and the potion would be delayed or never drunk.
    enemy.pos = { x: c.pos.x + 60, y: c.pos.y };

    runEncounter('c_consume', 'r_consume', [c], [enemy], 'seed-23');

    expect(c.quickSlots[0], 'should have drunk without closing the distance').toBeNull();
  });
});

describe('⚠ EXPOSURE — the spend survives back to the kit', () => {
  it('reconciliation after a real encounter empties the KIT slot, not just the mirror', () => {
    const potion = healingPotion();
    const { kit, c } = woundedFighterWithPotion(potion, [
      { action: 'consume', slotIndex: 0, condition: { kind: 'selfHpBelow', pct: 95 }, target: 'self' },
      { action: 'strike', condition: { kind: 'always' }, target: 'nearestEnemy' },
    ]);
    c.hp = 3;
    const mask = trackedMask(normalizeQuickSlots(kit.quickSlots));

    const enemy = buildEnemy(1, 'e1');
    runEncounter('c_consume', 'r_consume', [c], [enemy], 'seed-29');

    const slots = normalizeQuickSlots(kit.quickSlots);
    const spent = reconcileQuickSlots(slots, c.quickSlots, mask);
    kit.quickSlots = slots;

    expect(spent, 'the spend was not reported').toHaveLength(1);
    expect(kit.quickSlots[0], 'the KIT still holds a potion the hero drank').toBeNull();
  });
});

describe('an unusable item in the pouch', () => {
  it('is never drunk, and is still there afterwards', () => {
    const buff = items.find(
      (i) => i.item_type === 'consumable' && !isConsumableUsable(String(i.id)),
    );
    const { kit, c } = woundedFighterWithPotion(String(buff!.id), [
      { action: 'consume', slotIndex: 0, condition: { kind: 'always' }, target: 'self' },
      { action: 'strike', condition: { kind: 'always' }, target: 'nearestEnemy' },
    ]);
    const mask = trackedMask(normalizeQuickSlots(kit.quickSlots));

    const enemy = buildEnemy(1, 'e1');
    runEncounter('c_consume', 'r_consume', [c], [enemy], 'seed-31');

    const slots = normalizeQuickSlots(kit.quickSlots);
    reconcileQuickSlots(slots, c.quickSlots, mask);
    expect(slots[0]?.baseId, 'the inert potion vanished').toBe(String(buff!.id));
  });
});
