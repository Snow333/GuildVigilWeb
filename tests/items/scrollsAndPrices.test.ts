/**
 * TRACK I2 — the Raise Dead scroll, and weapon prices.
 *
 * ⚠ The scroll test parses the item and spell tables and checks EVERY scroll;
 * it does not name the one row that was wrong. The fight test drives the real
 * encounter loop and asserts the dying hero WAKES — it never reads back the
 * table the seed populated. Both were negative-controlled (see the track
 * report): break the data, watch them go red, restore.
 */

import { describe, it, expect } from 'vitest';
import { items } from '@content/generated/items';
import { spells } from '@content/generated/spells';
import { runEncounter } from '@sim/combat/encounter';
import { buildEnemy } from '@sim/combat/build';
import { knockOut } from '@sim/combat/dying';
import { assembleHero } from '@sim/campaign/assembly';
import { musterParty } from '@sim/campaign/muster';
import { ancestryIds } from '@sim/registry';
import { canReadScroll } from '@sim/heroes/scrolls';
import { normalizeQuickSlots, toCombatQuickSlots } from '@sim/heroes/quickSlots';
import {
  MASTERWORK_FEE, POTENCY_RUNE_PRICE, STRIKING_RUNE_PRICE, WEAPON_PROPERTY_RUNE_PRICE,
  deriveItem, weaponPrice,
} from '@sim/heroes/equipment';
import type { ItemInstance } from '@sim/core/events/types';

type ItemRow = (typeof items)[number];

const inst = (baseId: string | number, tier: ItemInstance['tier'] = 'mundane', propertyIds: string[] = []): ItemInstance =>
  ({ baseId: String(baseId), tier, propertyIds, seed: 'test' });

// ─────────────────────────────────────────────────────────────────────────────
// 1. EVERY SCROLL CASTS THE SPELL IT IS NAMED FOR
// ─────────────────────────────────────────────────────────────────────────────

describe('every scroll resolves to the spell it is named for', () => {
  const scrolls = items.filter((i) => i.item_type === 'scroll');
  const spellNames = new Map<number, string>(spells.map((s) => [s.id as number, s.name as string]));

  it('there are scrolls to check (the loop is not vacuous)', () => {
    expect(scrolls.length).toBe(52);
  });

  it('⚠ "Scroll of X" -> a spell actually named X, for ALL scrolls, with no allow-list', () => {
    const wrong = scrolls
      .filter((s) => (spellNames.get(s.spell_id as number) ?? '').toLowerCase() !== s.name.replace(/^Scroll of /, '').toLowerCase())
      .map((s) => `#${s.id} "${s.name}" -> ${s.spell_id} "${spellNames.get(s.spell_id as number)}"`);
    expect(wrong, wrong.join('\n')).toEqual([]);
  });

  it('no scroll is still called Raise Dead while casting something else', () => {
    // The row that started this. Whatever it is called now, it must not be
    // possible for the NAME to say Raise Dead while the spell is not.
    for (const s of scrolls.filter((x) => /raise dead/i.test(x.name))) {
      expect(spellNames.get(s.spell_id as number)).toBe('Raise Dead');
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. THE SCROLL ITEM #53 DOES SOMETHING IN A REAL FIGHT
// ─────────────────────────────────────────────────────────────────────────────

describe('⚠ EXPOSURE — item #53 really brings a dying hero back, through the real encounter loop', () => {
  const HEALER_CLASS = 3; // Cleric
  const FIGHTER_CLASS = 1;
  const SCROLL = '53';

  /** A Cleric with the scroll in the pouch, a downed Fighter, and an enemy too far away to matter. */
  function setup(overrideSpellId?: number) {
    const [healerKit, downedKit] = musterParty([
      { classId: HEALER_CLASS, name: 'Healer', ancestry: ancestryIds[0]!, gender: 'm' as const },
      { classId: FIGHTER_CLASS, name: 'Downed', ancestry: ancestryIds[0]!, gender: 'm' as const },
    ]) as [ReturnType<typeof musterParty>[0], ReturnType<typeof musterParty>[0]];
    healerKit.quickSlots = normalizeQuickSlots([inst(SCROLL)]);
    // `always` + `lowestAlly`: the loadout editor's way of saying "read it at whoever is worst off".
    healerKit.loadout = [{ action: 'consume', slotIndex: 0, condition: { kind: 'always' }, target: 'lowestAlly' }];
    const healer = assembleHero(healerKit).c;
    const downed = assembleHero(downedKit).c;
    // The production mirror — built by the real code from the real item row.
    healer.quickSlots = toCombatQuickSlots(normalizeQuickSlots(healerKit.quickSlots));
    // CONTROL ONLY: aim the same pouch slot at a different spell.
    if (overrideSpellId !== undefined) {
      healer.quickSlots = healer.quickSlots.map((q) => (q ? { ...q, spellId: overrideSpellId } : q));
    }
    knockOut(downed);
    const enemy = buildEnemy(1, 'far');
    enemy.hp = 5000;
    enemy.pos = { x: healer.pos.x + 80, y: healer.pos.y };
    const stream = runEncounter('c_i2', 'r_i2', [healer, downed], [enemy], 'seed-5').stream;
    return { healer, downed, events: stream.all() };
  }

  const healsOn = (events: ReturnType<typeof setup>['events'], id: string) =>
    events.filter((e) => e.type === 'combat.healing_applied' && (e.data as { targetId: string }).targetId === id);

  it('the scroll is read, the dying hero is healed above 0 hp by the scroll spell', () => {
    const { healer, downed, events } = setup();
    expect(healer.quickSlots[0], 'the scroll should be spent').toBeNull();
    const heals = healsOn(events, downed.id);
    expect(heals.length, 'nobody was healed').toBeGreaterThan(0);
    // hpAfter > 0 on a hero who was at 0 and dying: the heal woke them. (They
    // might also have woken on their own dying-recovery roll later; that cannot
    // produce a healing_applied event, which is what this asserts on.)
    expect((heals[0]!.data as { hpAfter: number }).hpAfter).toBeGreaterThan(0);
    const cast = events.find((e) => e.type === 'combat.spell_cast' && (e.data as { casterId: string }).casterId === healer.id);
    expect((cast!.data as { spellId: string }).spellId, 'the first thing the Cleric cast should be the scroll').toBe('110');
  });

  it('⚠ CONTROL: the same read, aimed at the real Raise Dead (spell 106), revives nobody — which is why #53 does not point there', () => {
    const raiseDead = spells.find((s) => s.name === 'Raise Dead')!;
    const { downed, events } = setup(raiseDead.id as number);
    // The scroll is spent and the cast is logged…
    expect(events.some((e) => e.type === 'combat.spell_cast' && (e.data as { spellId: string }).spellId === String(raiseDead.id))).toBe(true);
    // …and nothing happens. If this starts failing, Raise Dead has been made to
    // work: repoint #53 at it (and delete this control).
    expect(healsOn(events, downed.id)).toHaveLength(0);
  });

  it('a Cleric with enough Religion may read it (the literacy gate agrees it is a live scroll)', () => {
    const kit = musterParty([{ classId: HEALER_CLASS, name: 'C', ancestry: ancestryIds[0]!, gender: 'm' as const }])[0]!;
    kit.hero.skills = { ...kit.hero.skills, religion: 6 }; // native divine, level-5 spell: 5 + 1
    expect(canReadScroll(kit.hero, HEALER_CLASS, SCROLL)).toMatchObject({ usable: true });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. WEAPON PRICES: THE RUNE CARRIES THE VALUE
// ─────────────────────────────────────────────────────────────────────────────

const weapons = items.filter((i) => i.item_type === 'weapon');
const plainOf = (row: ItemRow): ItemRow => {
  const p = weapons.find((w) => w.item_subtype === row.item_subtype && w.quality_tier === 'mundane');
  if (!p) throw new Error(`no plain ${String(row.item_subtype)}`);
  return p;
};
const masterworkRows = weapons.filter((w) => w.quality_tier === 'masterwork');
const magicalRows = weapons.filter((w) => w.quality_tier === 'magical');

/** 'plain' | 'masterwork' | '+1' … — the rung of the ladder an authored generic row sits on. */
const rung = (w: ItemRow): number =>
  w.quality_tier === 'mundane' ? 0 : w.quality_tier === 'masterwork' ? 1 : 1 + (w.potency_bonus as number);

describe('weapon prices — one rule, monotone, the rune carries the value', () => {
  it('no weapon is free (the Staff used to be 0g)', () => {
    for (const w of weapons) expect(w.price, w.name).toBeGreaterThan(0);
  });

  it('⚠ the authored rows are exactly the rule applied to their plain weapon (seed and code cannot drift)', () => {
    for (const w of [...masterworkRows, ...magicalRows]) {
      const expected = weaponPrice(plainOf(w).price as number, {
        masterwork: w.quality_tier === 'masterwork',
        potency: w.potency_bonus as number,
        striking: w.striking_tier as number,
        properties: 0,
      });
      expect(w.price, w.name).toBe(expected);
    }
  });

  it('⚠ same weapon: plain < masterwork < +1 < +2 < +3, and striking costs more than the same bonus without it', () => {
    const bySubtype = new Map<string, ItemRow[]>();
    for (const w of weapons) {
      if (!['mundane', 'masterwork', 'magical'].includes(w.quality_tier as string)) continue;
      const list = bySubtype.get(w.item_subtype as string) ?? [];
      bySubtype.set(w.item_subtype as string, list);
      list.push(w);
    }
    let comparisons = 0;
    for (const [subtype, rows] of bySubtype) {
      for (const a of rows) {
        for (const b of rows) {
          if (rung(a) < rung(b) || (rung(a) === rung(b) && (a.striking_tier as number) < (b.striking_tier as number))) {
            expect(a.price, `${subtype}: ${a.name} (${a.price}g) should cost less than ${b.name} (${b.price}g)`).toBeLessThan(b.price as number);
            comparisons++;
          }
        }
      }
    }
    expect(comparisons, 'the ordering loop compared nothing').toBeGreaterThan(40);
  });

  it('⚠ across weapons too: the dearest of a rung is cheaper than the cheapest of the next (a +2 spear is not a bargain)', () => {
    const rows = [...weapons.filter((w) => w.quality_tier === 'masterwork' || (w.quality_tier === 'magical' && (w.striking_tier as number) === 0))];
    const byRung = new Map<number, number[]>();
    for (const w of rows) byRung.set(rung(w), [...(byRung.get(rung(w)) ?? []), w.price as number]);
    const rungs = [...byRung.keys()].sort((a, b) => a - b);
    expect(rungs.length).toBeGreaterThanOrEqual(3);
    for (let i = 1; i < rungs.length; i++) {
      const lower = Math.max(...byRung.get(rungs[i - 1]!)!);
      const upper = Math.min(...byRung.get(rungs[i]!)!);
      expect(lower, `rung ${rungs[i - 1]} tops out at ${lower}g but rung ${rungs[i]} starts at ${upper}g`).toBeLessThan(upper);
    }
  });

  it('a rune is worth the same on any weapon', () => {
    const premium = new Map<string, Set<number>>();
    for (const w of magicalRows) {
      const key = `+${w.potency_bonus} s${w.striking_tier}`;
      const set = premium.get(key) ?? new Set<number>();
      premium.set(key, set);
      set.add((w.price as number) - (plainOf(w).price as number));
    }
    expect(premium.size).toBeGreaterThanOrEqual(4);
    for (const [key, set] of premium) expect([...set], `${key} costs a different amount on different weapons`).toHaveLength(1);
    // And the reported numbers are the rune table's.
    expect([...premium.get('+2 s0')!][0]).toBe(POTENCY_RUNE_PRICE[2]);
    expect([...premium.get('+2 s1')!][0]).toBe(POTENCY_RUNE_PRICE[2]! + STRIKING_RUNE_PRICE[1]!);
  });

  it('the cases from the bug report are fixed: +2 dagger vs +2 longsword differ by the stick only', () => {
    const dagger = deriveItem(inst(132)).price;
    const longsword = deriveItem(inst(133)).price;
    expect(longsword - dagger).toBe((plainOf(items.find((i) => i.id === 133)!).price as number) - (plainOf(items.find((i) => i.id === 132)!).price as number));
    expect(dagger).toBeGreaterThan(deriveItem(inst(111)).price * 3); // a +2 dagger is far above a masterwork longsword
    expect(deriveItem(inst(16)).price).toBeGreaterThan(0);          // Staff
  });

  it('named enchanted and legendary weapons stay above the generic price of their own potency and striking', () => {
    const named = weapons.filter((w) => w.quality_tier === 'enchanted' || w.quality_tier === 'legendary');
    expect(named.length).toBeGreaterThan(10);
    for (const w of named) {
      const floor = weaponPrice(plainOf(w).price as number, {
        masterwork: false, potency: w.potency_bonus as number, striking: w.striking_tier as number, properties: 0,
      });
      expect(w.price, w.name).toBeGreaterThanOrEqual(floor);
    }
  });

  describe('ROLLED loot is priced by the same rule', () => {
    it('a rolled magical Longsword costs what the authored Longsword +1 costs', () => {
      expect(deriveItem(inst(3, 'magical')).price).toBe(deriveItem(inst(17)).price);
    });

    it('a rolled masterwork weapon costs plain + the fee', () => {
      for (const w of weapons.filter((x) => x.quality_tier === 'mundane')) {
        expect(deriveItem(inst(w.id, 'masterwork')).price, w.name).toBe((w.price as number) + MASTERWORK_FEE);
      }
    });

    it('⚠ the magic costs the same on a dagger as on a longsword (the old rule gave 32g vs 240g)', () => {
      for (const tier of ['magical', 'enchanted'] as const) {
        const premiums = new Set(
          weapons.filter((w) => w.quality_tier === 'mundane').map((w) => deriveItem(inst(w.id, tier)).price - (w.price as number)),
        );
        expect([...premiums], `${tier} premium differs between weapons`).toHaveLength(1);
      }
    });

    it('each property rune adds a flat amount', () => {
      const none = deriveItem(inst(3, 'enchanted')).price;
      const one = deriveItem(inst(3, 'enchanted', ['flaming'])).price;
      expect(one - none).toBe(WEAPON_PROPERTY_RUNE_PRICE);
    });

    it('rolled tiers stay strictly increasing on every weapon, the Staff included', () => {
      for (const w of weapons.filter((x) => x.quality_tier === 'mundane')) {
        const p = (['mundane', 'masterwork', 'magical', 'enchanted'] as const).map((t) => deriveItem(inst(w.id, t)).price);
        for (let i = 1; i < p.length; i++) expect(p[i], `${w.name} tier ${i}`).toBeGreaterThan(p[i - 1]!);
      }
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. THE SHOP STAYS AFFORDABLE ON THE REAL GOLD CURVE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * UNSPENT GOLD A PARTY HOLDS WHEN ITS WEAKEST HERO FIRST REACHES LEVEL L —
 * the WORST of 12 seeded careers (`runCampaign`, the career harness's party and
 * seeds, `world_0..11`, a median weakest-hero level of L at that horizon).
 * Measured by a throwaway probe, weeks 2..64 in steps of 2. The autopilot never
 * shops, so this is the ceiling a player could have banked, not what they
 * keep; it still ignores armour and scroll spend, which is why the bar below
 * is a modest 10%.
 *
 *   level: first even week -> min gold across the 12 seeds
 *   L2 wk6 650 · L3 wk14 1650 · L4 wk20 4116 · L5 wk26 7953 · L6 wk32 11636
 *   L7 wk40 16461 · L8 wk46 18383 · L9 wk50 21993 · L10 wk58 23791
 */
const WORST_BANKED_GOLD_AT_LEVEL: Readonly<Record<number, number>> = {
  1: 220, 2: 650, 3: 1650, 4: 4116, 5: 7953, 6: 11636, 7: 16461, 8: 18383, 9: 21993, 10: 23791, 11: 25413, 12: 32884,
};

describe('affordability on the gold curve', () => {
  it('⚠ no repriced weapon costs more than 10% of what the worst party has banked at its item_level', () => {
    const repriced = [...masterworkRows, ...magicalRows];
    let worst = 0;
    for (const w of repriced) {
      const banked = WORST_BANKED_GOLD_AT_LEVEL[w.item_level as number];
      expect(banked, `${w.name}: no gold-curve entry for item_level ${w.item_level}`).toBeDefined();
      const share = (w.price as number) / banked!;
      worst = Math.max(worst, share);
      expect(share, `${w.name} (${w.price}g at L${w.item_level}) is ${(share * 100).toFixed(1)}% of ${banked}g`).toBeLessThanOrEqual(0.1);
    }
    expect(worst).toBeGreaterThan(0.03); // not vacuous: the dearest item really is a visible slice
  });

  it('…and the magic is not trivially cheap either: a +2 costs at least a masterwork of the same weapon plus 200g', () => {
    for (const w of magicalRows.filter((x) => x.potency_bonus === 2 && x.striking_tier === 0)) {
      const mw = masterworkRows.find((m) => m.item_subtype === w.item_subtype);
      if (mw) expect((w.price as number) - (mw.price as number)).toBeGreaterThanOrEqual(200);
    }
  });
});
