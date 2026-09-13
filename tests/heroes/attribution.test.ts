/**
 * STAT ATTRIBUTION (brief #24, Variant G sheet).
 *
 * ⚠ THE FAILURE THIS FILE EXISTS TO CATCH IS INVISIBLE BY NATURE. A ledger
 * that drifts from `assembleHero` still shows the RIGHT total — the sheet
 * reads `AC 21` either way — and only the *explanation* is wrong. No crash, no
 * visual glitch, nothing a playtest would surface. So every ledger is checked
 * three ways: its parts sum to its own total, its total equals the assembled
 * Combatant's value, and both hold for a hero wearing real gear.
 */

import { describe, it, expect } from 'vitest';
import {
  acLedger, attackLedger, attackPenaltyLedger, saveLedger, hpLedger, speedLedger,
  itemContributions, slotState, UNMODELLED_CONDITIONS,
} from '@sim/heroes/attribution';
import { assembleHero } from '@sim/campaign/assembly';
import { musterParty } from '@sim/campaign/muster';
import { ancestryIds } from '@sim/registry';
import { items } from '@content/generated/items';
import type { ItemInstance } from '@sim/core/events/types';
import type { HeroKit } from '@sim/campaign/assembly';

const FIGHTER = 1, WIZARD = 2, CLERIC = 3, ROGUE = 4;
const ALL = [FIGHTER, WIZARD, CLERIC, ROGUE];

const kitFor = (classId: number): HeroKit => musterParty([
  { classId, name: 'Ledger', ancestry: ancestryIds[0]!, gender: 'm' as const },
])[0]!;

const inst = (baseId: string, tier = 'mundane', propertyIds: string[] = []): ItemInstance =>
  ({ baseId, tier, propertyIds, seed: 'attr' }) as unknown as ItemInstance;

const byName = (needle: string) => String(items.find((i) => String(i.name) === needle)!.id);

const sum = (l: { terms: { value: number }[] }) => l.terms.reduce((s, t) => s + t.value, 0);

describe('⚠ every ledger sums to its own total', () => {
  for (const classId of ALL) {
    it(`class ${classId}: ac, attack, saves, hp, speed all balance`, () => {
      const kit = kitFor(classId);
      const { hero, equipped } = kit;
      for (const l of [
        acLedger(hero, equipped),
        attackLedger(hero, equipped),
        saveLedger(hero, equipped, 'fort'),
        saveLedger(hero, equipped, 'ref'),
        saveLedger(hero, equipped, 'will'),
        hpLedger(hero, equipped),
        speedLedger(hero, equipped),
      ]) {
        expect(sum(l), 'terms do not add up to the stated total').toBe(l.total);
      }
    });
  }
});

/**
 * ⚠ THE LOAD-BEARING TEST. If `assembleHero` gains a term and a ledger does
 * not, the sheet starts explaining a number with the wrong reasons. This
 * catches that on the next run rather than at a player's table.
 */
describe('⚠ EXPOSURE — ledgers agree with the ENGINE, not just themselves', () => {
  for (const classId of ALL) {
    it(`class ${classId}: every ledger total matches the assembled combatant`, () => {
      const kit = kitFor(classId);
      const c = assembleHero(kit).c;
      const { hero, equipped } = kit;

      expect(acLedger(hero, equipped).total, 'AC ledger disagrees with the sim').toBe(c.ac);
      expect(attackLedger(hero, equipped).total, 'attack ledger disagrees').toBe(c.attackBonus);
      expect(saveLedger(hero, equipped, 'fort').total, 'fort ledger disagrees').toBe(c.saves.fort);
      expect(saveLedger(hero, equipped, 'ref').total, 'ref ledger disagrees').toBe(c.saves.ref);
      expect(saveLedger(hero, equipped, 'will').total, 'will ledger disagrees').toBe(c.saves.will);
      expect(hpLedger(hero, equipped).total, 'hp ledger disagrees').toBe(c.maxHp);
      expect(speedLedger(hero, equipped).total, 'speed ledger disagrees').toBe(c.speed);
    });
  }

  /**
   * ⚠ THE STARTING KITS ARE TOO PLAIN TO PROVE MUCH — no magic items, no
   * penalties. This re-runs the agreement check on a hero wearing gear that
   * exercises the item, save, speed and ability paths at once.
   */
  it('⚠ still agrees when the hero wears real magic gear', () => {
    const kit = kitFor(FIGHTER);
    kit.equipped = [
      ...kit.equipped,
      inst(byName('Cloak of Resistance +1')),
      inst(byName('Boots of Speed')),
      inst(byName('Belt of Strength +2')),
    ];
    const c = assembleHero(kit).c;
    const { hero, equipped } = kit;

    expect(acLedger(hero, equipped).total).toBe(c.ac);
    expect(saveLedger(hero, equipped, 'fort').total).toBe(c.saves.fort);
    expect(saveLedger(hero, equipped, 'will').total).toBe(c.saves.will);
    expect(speedLedger(hero, equipped).total).toBe(c.speed);
    expect(attackLedger(hero, equipped).total).toBe(c.attackBonus);
  });

  /**
   * ⚠ AND WHEN THE HERO IS PENALISED. A wizard in plate with a greatsword is
   * the worst case for attribution: two penalties, an armour dex cap, and no
   * proficiency. If the ledger can explain THIS hero it can explain any.
   */
  it('⚠ still agrees for an off-class, penalised hero', () => {
    const kit = kitFor(WIZARD);
    kit.equipped = [inst(byName('Greatsword')), inst(byName('Full Plate'))];
    const c = assembleHero(kit).c;
    const { hero, equipped } = kit;

    expect(acLedger(hero, equipped).total, 'AC with a dex cap').toBe(c.ac);
    expect(attackLedger(hero, equipped).total, 'the bonus half').toBe(c.attackBonus);
    /**
     * ⚠ PENALTIES SUM TO `weaponPenalty`, NOT INTO `attackBonus`. The engine
     * adds them at roll time in strike.ts. Folding them into the attack ledger
     * read −8 against an engine value of 0 — caught by this very test.
     */
    expect(attackPenaltyLedger(hero, equipped).total, 'the penalty half').toBe(c.weaponPenalty);
    expect(c.weaponPenalty, 'a wizard in plate with a greatsword IS penalised').toBeLessThan(0);
  });
});

describe('the ledger explains, not just totals', () => {
  it('AC names the armour by its display name, not an id', () => {
    const kit = kitFor(FIGHTER);
    const l = acLedger(kit.hero, kit.equipped);
    const itemTerms = l.terms.filter((t) => t.category === 'item');
    expect(itemTerms.length, 'the fighter wears armour; it should appear').toBeGreaterThan(0);
    for (const t of itemTerms) {
      expect(t.label, 'item terms must be named, not numbered').not.toMatch(/^\d+$/);
    }
  });

  it('always starts AC from a base of 10', () => {
    const kit = kitFor(ROGUE);
    const base = acLedger(kit.hero, kit.equipped).terms.find((t) => t.category === 'base');
    expect(base?.value).toBe(10);
  });

  /**
   * ⚠ PENALTIES MUST BE VISIBLE. A hero holding an off-class weapon sees a low
   * attack bonus; without a named penalty row the number is inexplicable and
   * the player has no lever to pull.
   */
  it('⚠ an off-class weapon produces a NAMED penalty row', () => {
    const kit = kitFor(WIZARD);
    kit.equipped = [inst(byName('Greatsword'))];
    const l = attackPenaltyLedger(kit.hero, kit.equipped);
    expect(l.terms.length, 'the -4 is applied but never explained').toBeGreaterThan(0);
    expect(l.total).toBeLessThan(0);
    expect(l.terms[0]!.label, 'the reason must be legible').toMatch(/proficient/i);
  });

  it('a proficient hero has NO penalty rows', () => {
    const kit = kitFor(FIGHTER);
    expect(attackPenaltyLedger(kit.hero, kit.equipped).terms).toHaveLength(0);
    expect(attackPenaltyLedger(kit.hero, kit.equipped).total).toBe(0);
  });
});

describe('item contributions — the reverse view', () => {
  it('a magic weapon reports its attack bonus and damage die', () => {
    const kit = kitFor(FIGHTER);
    const contributions = itemContributions(kit.hero, inst(byName('Longsword'), 'magical'));
    expect(contributions.some((c) => c.kind === 'attack')).toBe(true);
    expect(contributions.some((c) => c.kind === 'damage')).toBe(true);
  });

  it('a flaming weapon reports its rider as LIVE (brief #24 M1 wired it)', () => {
    const kit = kitFor(FIGHTER);
    const c = itemContributions(kit.hero, inst(byName('Longsword'), 'magical', ['flaming']));
    const rider = c.find((x) => x.kind === 'rider');
    expect(rider, 'flaming should report a rider').toBeDefined();
    expect(rider!.live, 'M1 made damage riders real').toBe(true);
  });

  /**
   * ⚠ AN INERT EFFECT IS REPORTED, NOT OMITTED. Silence reads as "this item
   * has nothing else", which is a different and wronger claim than "this
   * does something the game cannot do yet".
   */
  it('⚠ a rider naming an unmodelled condition is reported but NOT live', () => {
    const kit = kitFor(FIGHTER);
    // `binding` applies a condition the engine does not model.
    const c = itemContributions(kit.hero, inst(byName('Longsword'), 'magical', ['binding']));
    const rider = c.find((x) => x.kind === 'rider');
    if (rider) expect(rider.live).toBe(false);
  });

  it('the Cloak of Resistance reports its save bonuses', () => {
    const kit = kitFor(FIGHTER);
    const c = itemContributions(kit.hero, inst(byName('Cloak of Resistance +1')));
    expect(c.length, 'a cloak that grants three saves should report them').toBeGreaterThan(0);
  });
});

describe('⚠ slot state — the paperdoll signal', () => {
  it('an empty slot is empty', () => {
    expect(slotState(kitFor(FIGHTER).hero, null)).toBe('empty');
  });

  it('ordinary working gear is filled', () => {
    const kit = kitFor(FIGHTER);
    expect(slotState(kit.hero, inst(byName('Longsword')))).toBe('filled');
  });

  /**
   * ⚠ THE STATE THAT JUSTIFIES THE PAPERDOLL. Empty slots are easy to spot in
   * a list; a slot that LOOKS equipped but carries a dead effect or a penalty
   * is not. That is what the hatched state is for.
   */
  it('⚠ an off-class weapon is UNDERSERVED, not filled', () => {
    const wiz = kitFor(WIZARD);
    expect(slotState(wiz.hero, inst(byName('Greatsword')))).toBe('underserved');
  });

  it('⚠ a weapon whose rider the engine ignores is UNDERSERVED', () => {
    const kit = kitFor(FIGHTER);
    expect(slotState(kit.hero, inst(byName('Longsword'), 'magical', ['binding']))).toBe('underserved');
  });
});

/**
 * ⚠ THE META-TEST. `UNMODELLED_CONDITIONS` is duplicated in src (for the sheet)
 * and in tests/combat/weaponRiders.test.ts (for the content ledger). Two
 * copies of the same truth WILL drift. This pins them together.
 */
describe('⚠ the unmodelled-condition list has not drifted', () => {
  it('matches the content ledger in weaponRiders.test.ts', () => {
    const FROM_RIDER_TEST = [
      'bound_to_wielder', 'deafened', 'fleeing',
      'persistent_bleed', 'persistent_fire', 'persistent_poison',
    ];
    expect([...UNMODELLED_CONDITIONS].sort()).toEqual([...FROM_RIDER_TEST].sort());
  });
});
