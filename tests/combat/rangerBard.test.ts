/**
 * RANGER AND BARD (M2) — the two classes that shipped with NO feats at all.
 *
 * `feats` held zero rows for class_id 5 and 8, and none of their
 * class_progression feature keys matched a feat, so levelling either class
 * granted nothing and both had five empty class-feat slots by level 10.
 *
 * ⚠ THESE TESTS ASSERT THE DICE, NOT THE TABLE. The repo's recurring failure
 * is a test that reads back the structure the code under test just populated
 * (the immunity table, the readiness gate, the aggregator). A party buff is
 * especially easy to fake: asserting `ally.conditions.has('emboldened')` would
 * pass with `attackMod` gutted, because the condition map is written by the
 * same line being tested. So the witness here is `attack_resolved.roll.modifier`
 * — the number that actually decides whether a swing lands.
 *
 * ⚠ AND IT IS A WITNESS WITH NO FIGHT-LENGTH TERM. Brief #25's lesson: a buff
 * measured on a pooled total (damage dealt, hp lost) is confounded by the
 * action the buff cost, and the buffed party can measure WORSE. The roll
 * modifier cannot be confounded that way.
 */
import { describe, expect, it } from 'vitest';
import { runEncounter } from '@sim/combat/encounter';
import { abilityDef } from '@sim/combat/abilities';
import { reachesConsumer } from '@sim/heroes/featEffects';
import { autoGrantsForLevel } from '@sim/heroes/feats';
import { feats } from '@content/generated/feats';
import { ENCOUNTER } from '@content/combat';
import { combatant } from './conditions.test';
import type { Combatant } from '@sim/combat/types';
import type { LoadoutEntry } from '@sim/combat/loadout';

const INSPIRE_COURAGE = 330;
const DIRGE_OF_DOOM = 333;
const HOBBLING_SHOT = 311;
const RANGER = 5;
const BARD = 8;

const entry = (featId: number, target: LoadoutEntry extends never ? never : 'self' | 'scoredEnemy'): LoadoutEntry =>
  ({ action: 'ability', featId, condition: { kind: 'always' }, target }) as LoadoutEntry;

/** A bard who sings, plus two plain allies whose rolls we read. */
function party(bardLoadout: LoadoutEntry[]): Combatant[] {
  return [
    combatant({
      id: 'bard', name: 'Lirien', side: 'heroes', isHero: true, pos: { x: 3, y: 10 },
      maxHp: 100_000, hp: 100_000, ac: 20, attackBonus: 6, damageDice: '1d6', level: 5,
      loadout: bardLoadout,
    }),
    combatant({
      id: 'ally_1', name: 'Torvald', side: 'heroes', isHero: true, pos: { x: 4, y: 10 },
      maxHp: 100_000, hp: 100_000, ac: 20, attackBonus: 10, damageDice: '1d8', level: 5,
    }),
    combatant({
      id: 'ally_2', name: 'Mirra', side: 'heroes', isHero: true, pos: { x: 4, y: 11 },
      maxHp: 100_000, hp: 100_000, ac: 20, attackBonus: 10, damageDice: '1d8', level: 5,
    }),
  ];
}

const foes = (): Combatant[] => [
  combatant({
    id: 'foe_1', name: 'Ogre', side: 'enemies', isHero: false, pos: { x: 8, y: 10 },
    maxHp: 5000, hp: 5000, ac: 18, attackBonus: 8, damageDice: '1d8',
    saves: { fort: 2, ref: 2, will: 2 }, level: 5,
  }),
];

/** Mean `roll.modifier` across every attack by these units. */
function meanAttackMod(
  r: ReturnType<typeof runEncounter>, ids: ReadonlySet<string>,
): { mean: number; n: number } {
  let sum = 0; let n = 0;
  for (const e of r.stream.all()) {
    if (e.type !== 'combat.attack_resolved') continue;
    const d = e.data as { attackerId: string; roll: { modifier: number } };
    if (!ids.has(d.attackerId)) continue;
    sum += d.roll.modifier; n += 1;
  }
  return { mean: n === 0 ? 0 : sum / n, n };
}

describe('the Ranger and the Bard have a kit at all (M2)', () => {
  it('both classes now hold feats, and every one reaches a consumer', () => {
    for (const classId of [RANGER, BARD]) {
      const mine = feats.filter((f) => (f.class_id as number | null) === classId);
      expect(mine.length, `class ${classId} feat count`).toBeGreaterThanOrEqual(8);
      const inert = mine.filter((f) => !reachesConsumer(f.id as number)).map((f) => f.name);
      // ⚠ Never ship a feat that does nothing — the house rule, enforced.
      expect(inert, `class ${classId} feats reaching no consumer`).toEqual([]);
    }
  });

  it('a class feat slot can actually be filled at every level that grants one', () => {
    // Both classes get a class feat slot at L2, 4, 6, 8, 10. A slot with no
    // offerable feat is the bug this milestone exists to fix.
    for (const classId of [RANGER, BARD]) {
      for (const level of [2, 4, 6, 8, 10]) {
        const offerable = feats.filter(
          (f) => (f.class_id as number | null) === classId
            && (f.level_req as number) <= level
            && reachesConsumer(f.id as number)
            && abilityDef(f.id as number) !== null,
        );
        expect(offerable.length, `class ${classId} L${level} offerable actives`).toBeGreaterThan(0);
      }
    }
  });

  it('the signature features auto-grant: Inspire Courage at 1, Dirge at 8', () => {
    expect(autoGrantsForLevel(BARD, 1)).toContain(INSPIRE_COURAGE);
    expect(autoGrantsForLevel(BARD, 8)).toContain(DIRGE_OF_DOOM);
    // Ranger's two level-1 features both resolve to real rows now.
    expect(autoGrantsForLevel(RANGER, 1).length).toBeGreaterThanOrEqual(2);
  });
});

describe('EXPOSURE — the bard changes the numbers on other heroes dice', () => {
  const allyIds = new Set(['ally_1', 'ally_2']);

  it('INSPIRE COURAGE raises every ally attack roll modifier by exactly 1', () => {
    const sung = runEncounter('c_bard', 'r_bard', party([entry(INSPIRE_COURAGE, 'self')]), foes(), 'inspire');
    const silent = runEncounter('c_bard', 'r_bard', party([]), foes(), 'inspire');

    const a = meanAttackMod(sung, allyIds);
    const b = meanAttackMod(silent, allyIds);
    expect(a.n).toBeGreaterThan(10);
    expect(b.n).toBeGreaterThan(10);

    // `emboldened` is value-carrying and adds straight into attackMod, so once
    // the song is up every ally swing is +1.
    //
    // ⚠ THE FIXTURE IS DELIBERATELY UNKILLABLE ON BOTH SIDES. The first draft
    // gave everyone 200 hp, the bard died around tick 2410 of a 3603-tick
    // fight, and the mean uplift read 0.77 — the test was measuring the
    // bard's life expectancy, not the song. A buff test must not be able to
    // fail because the buffer died.
    // Measured 1.002. Not pinned to exactly 1: the two runs are different
    // fights once the first roll differs, so a stray flank or frighten moves
    // the mean a hair. A band around +1 is the honest claim; anything near 0
    // (the buff never reached the dice) or near 2 (it is stacking) fails.
    expect(a.mean - b.mean).toBeGreaterThan(0.9);
    expect(a.mean - b.mean).toBeLessThan(1.1);
  });

  it('it reaches the WHOLE party, not just one ally', () => {
    const sung = runEncounter('c_bard', 'r_bard', party([entry(INSPIRE_COURAGE, 'self')]), foes(), 'whole');
    const buffed = new Set<string>();
    for (const e of sung.stream.all()) {
      if (e.type !== 'combat.condition_applied') continue;
      const d = e.data as { targetId: string; conditionId: string };
      if (d.conditionId === 'emboldened') buffed.add(d.targetId);
    }
    // Both allies AND the bard — a performer is in their own party.
    expect([...buffed].sort()).toEqual(['ally_1', 'ally_2', 'bard']);
  });

  it('DIRGE OF DOOM points the same verb at the enemy and lowers THEIR rolls', () => {
    const dirge = runEncounter('c_bard', 'r_bard', party([entry(DIRGE_OF_DOOM, 'self')]), foes(), 'dirge');
    const silent = runEncounter('c_bard', 'r_bard', party([]), foes(), 'dirge');

    const a = meanAttackMod(dirge, new Set(['foe_1']));
    const b = meanAttackMod(silent, new Set(['foe_1']));
    expect(a.n).toBeGreaterThan(10);
    expect(a.mean).toBeLessThan(b.mean);
  });

  it('the performance is NOT restarted every action — it has a cadence', () => {
    const sung = runEncounter('c_bard', 'r_bard', party([entry(INSPIRE_COURAGE, 'self')]), foes(), 'cadence');
    const singTicks = new Set<number>();
    for (const e of sung.stream.all()) {
      if (e.type !== 'combat.condition_applied') continue;
      const d = e.data as { targetId: string; conditionId: string };
      if (d.conditionId === 'emboldened' && d.targetId === 'bard') singTicks.add(e.tick);
    }
    const ticks = [...singTicks].sort((x, y) => x - y);
    expect(ticks.length).toBeGreaterThan(1); // it does refresh
    for (let i = 1; i < ticks.length; i++) {
      // Never twice in a row: a re-sing while the party is still emboldened
      // would be a wasted action, which `abilityWorthUsing` must prevent.
      expect(ticks[i]! - ticks[i - 1]!).toBeGreaterThan(ENCOUNTER.attackIntervalTicks);
    }
  });
});

describe('EXPOSURE — the ranger controls the field from range', () => {
  it('HOBBLING SHOT lands `slowed` on the target in a real fight', () => {
    const ranger = combatant({
      id: 'ranger', name: 'Aenwyn', side: 'heroes', isHero: true, pos: { x: 3, y: 10 },
      maxHp: 100_000, hp: 100_000, ac: 20, attackBonus: 12, damageDice: '1d8', level: 5,
      weaponRange: 6, loadout: [entry(HOBBLING_SHOT, 'scoredEnemy')],
    });
    const r = runEncounter('c_rng', 'r_rng', [ranger], foes(), 'hobble');
    const slowed = r.stream.all().some(
      (e) => e.type === 'combat.condition_applied'
        && (e.data as { conditionId: string }).conditionId === 'slowed',
    );
    expect(slowed).toBe(true);
  });
});
