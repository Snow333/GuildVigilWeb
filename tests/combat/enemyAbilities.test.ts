/**
 * ENEMY ABILITIES — the exposure suite (brief #26, M1 + M2).
 *
 * ⚠ THESE TESTS ARE THE DELIVERABLE, NOT A FORMALITY. `enemies.abilities` was
 * the fifth block of content in this repo authored against a contract with no
 * consumer, and the reason all five survived so long is that inert content
 * breaks no test. Every prior "free feature" here looked identical to a broken
 * one on the curve.
 *
 * ── WHAT THESE TESTS MUST NOT DO ──────────────────────────────────────────
 *
 * ⚠ NO TEST HERE MAY ASSERT THROUGH `resolveEnemyAbilities`. Checking that
 * "an enemy naming poison has a poison rider" by asking the function that
 * builds the rider is a TAUTOLOGY — the same defect brief #22 shipped and a
 * sabotage run caught. Every assertion below reaches a REAL CONSUMER: the
 * event stream of an actual fight, or a field the strike path reads.
 *
 * ⚠ AND NO TEST HERE MAY ASSERT AGAINST ITS OWN INPUT. `tests/heroes/
 * equipment.test.ts` was green for the entire period every Cloak of
 * Resistance did nothing, because it asserted the raw authored keys it had
 * just fed in. Assert the CONSUMER CONTRACT.
 */

import { describe, it, expect } from 'vitest';
import { runEncounter } from '@sim/combat/encounter';
import { buildEnemy } from '@sim/combat/build';
import { assembleHero } from '@sim/campaign/assembly';
import { musterParty } from '@sim/campaign/muster';
import { ancestryIds } from '@sim/registry';
import { isKnownAbility, parseAbilities } from '@sim/combat/enemyAbilities';
import { enemies } from '@content/generated/enemies';
import type { ItemInstance } from '@sim/core/events/types';

/** Registry ids, pinned so a renumber is a loud failure rather than a silent miss. */
const GIANT_SPIDER = 8;   // L3 beast   — poison, web
const TROLL = 17;         // L6 giant   — regeneration_10, fire_weakness
const SKELETON = 2;       // L1 undead  — undead_immunities
const BUGBEAR = 13;       // L4 humanoid — sneak_attack_1d6, stealth
const MINOTAUR = 14;      // L5 beast   — charge, gore
const GOBLIN = 1;         // L1 humanoid — no abilities (the control)
const BONE_CONSCRIPT = 106; // L3 undead — authors NO abilities string at all
const LONGSWORD = '3';

const hero = () => {
  const kit = musterParty([
    { classId: 1, name: 'Proband', ancestry: ancestryIds[0]!, gender: 'm' as const },
  ])[0]!;
  return assembleHero(kit).c;
};

/** Damage totals by TYPE, from a real fight's event stream. */
function damageByKind(enemyId: number, seed: string, enemyHp = 400): Map<string, number> {
  const h = hero();
  h.hp = 400;
  h.maxHp = 400;
  const e = buildEnemy(enemyId, 'e1');
  e.hp = enemyHp;
  e.maxHp = enemyHp;
  const r = runEncounter('c_ability', 'r_ability', [h], [e], seed);
  const kinds = new Map<string, number>();
  for (const ev of r.stream.all()) {
    if (ev.type === 'combat.damage_applied') {
      const d = ev.data as { amount: number; kind: string };
      kinds.set(d.kind, (kinds.get(d.kind) ?? 0) + d.amount);
    }
  }
  return kinds;
}

/** Condition ids applied to anyone during a real fight. */
function conditionsApplied(enemyId: number, seed: string): Set<string> {
  const h = hero();
  h.hp = 400;
  h.maxHp = 400;
  const e = buildEnemy(enemyId, 'e1');
  e.hp = 400;
  e.maxHp = 400;
  const r = runEncounter('c_cond', 'r_cond', [h], [e], seed);
  const out = new Set<string>();
  for (const ev of r.stream.all()) {
    if (ev.type === 'combat.condition_applied') out.add((ev.data as { conditionId: string }).conditionId);
  }
  return out;
}

describe('brief #26 M1 — the rider abilities reach the event stream', () => {
  /**
   * ⚠ THE HEADLINE EXPOSURE TEST. If `buildEnemy` stops reading
   * `enemies.abilities`, this is the assertion that fails. Sabotage verified:
   * reverting `weaponRiders: abilities.riders` to `[]` fails this test.
   */
  it('a Giant Spider deals POISON damage in a real fight — a type no weapon produces', () => {
    // Several seeds: a single fight can end before the spider lands a hit.
    const seen = ['s1', 's2', 's3', 's4', 's5'].map((s) => damageByKind(GIANT_SPIDER, s));
    const poisonTotal = seen.reduce((sum, m) => sum + (m.get('poison') ?? 0), 0);
    expect(poisonTotal).toBeGreaterThan(0);
  });

  it('a Minotaur deals PIERCING damage from gore, distinct from its weapon damage', () => {
    const seen = ['m1', 'm2', 'm3', 'm4', 'm5'].map((s) => damageByKind(MINOTAUR, s));
    const piercing = seen.reduce((sum, m) => sum + (m.get('piercing') ?? 0), 0);
    const weapon = seen.reduce((sum, m) => sum + (m.get('weapon') ?? 0), 0);
    expect(piercing).toBeGreaterThan(0);
    expect(weapon).toBeGreaterThan(0);
  });

  it('a Giant Rat applies FATIGUED through its authored disease', () => {
    const seen = ['d1', 'd2', 'd3', 'd4', 'd5', 'd6'].flatMap((s) => [...conditionsApplied(4, s)]);
    expect(seen).toContain('fatigued');
  });

  /**
   * THE NEGATIVE CONTROL. A Goblin authors `[]`, so it must produce ONLY
   * weapon damage. Without this, every assertion above would still pass if
   * riders were applied to every enemy indiscriminately.
   */
  it('a Goblin, which authors no abilities, produces weapon damage and nothing else', () => {
    const kinds = ['g1', 'g2', 'g3'].map((s) => damageByKind(GOBLIN, s));
    for (const m of kinds) {
      for (const kind of m.keys()) expect(kind).toBe('weapon');
    }
  });

  it('a Bugbear carries sneak dice; a Goblin does not', () => {
    // Reaches the FIELD strike.ts reads, not the resolver that sets it.
    expect(buildEnemy(BUGBEAR, 'b').sneakAttackDice).toBe('1d6');
    expect(buildEnemy(GOBLIN, 'g').sneakAttackDice).toBe('');
  });

  it("a Bugbear's authored stealth raises its conceal total above the level-derived baseline", () => {
    const bugbear = buildEnemy(BUGBEAR, 'b');
    // A same-level enemy without the ability is the baseline. Ghoul is L4 too.
    const ghoul = buildEnemy(12, 'gh');
    expect(bugbear.level).toBe(ghoul.level);
    expect(bugbear.stealth).toBeGreaterThan(ghoul.stealth);
  });
});

describe('brief #26 M2 — resistance, weakness and immunity', () => {
  /**
   * ⚠ ASSERTS THE CONSUMER, NOT THE TABLE. This drives damage through
   * `applyDamage` — the one function all damage flows through — rather than
   * inspecting `damageModifiers`, which would be asserting the input.
   */
  /**
   * ⚠ MEASURED THROUGH A REAL FIGHT, NOT THROUGH ARITHMETIC IN THE TEST.
   * A first draft of this test computed `10 * 1.5 > 10` and asserted that —
   * which proves the multiplier constant is bigger than one and NOTHING about
   * whether the engine applies it. Decoration, by this repo's own rule.
   *
   * This version gives the hero a FLAMING weapon (brief #24's rider channel,
   * the only fire source in the game) and compares total fire damage landed on
   * a Troll against the same fight with the weakness stripped. The difference
   * can only come from `applyDamage` consulting `damageModifiers`.
   */
  it('a Troll takes MORE fire damage than an identical Troll without the weakness', () => {
    const fireInto = (stripWeakness: boolean): number => {
      const kit = musterParty([
        { classId: 1, name: 'Firebrand', ancestry: ancestryIds[0]!, gender: 'm' as const },
      ])[0]!;
      kit.equipped = kit.equipped.filter((e) => String(e.baseId) !== LONGSWORD);
      kit.equipped.push({
        baseId: LONGSWORD, tier: 'magical', propertyIds: ['flaming'], seed: 'fire',
      } as unknown as ItemInstance);
      const h = assembleHero(kit).c;
      h.hp = 400;
      h.maxHp = 400;

      const troll = buildEnemy(TROLL, 't1');
      troll.hp = 4000;
      troll.maxHp = 4000;
      if (stripWeakness) troll.damageModifiers.weak.delete('fire');

      const r = runEncounter('c_fire', 'r_fire', [h], [troll], 'fire-seed');
      let fire = 0;
      for (const ev of r.stream.all()) {
        if (ev.type === 'combat.damage_applied') {
          const d = ev.data as { amount: number; kind: string };
          if (d.kind === 'fire') fire += d.amount;
        }
      }
      return fire;
    };

    const withWeakness = fireInto(false);
    const without = fireInto(true);

    // Both fights must actually land fire, or the comparison is vacuous —
    // the trap `tests/ui/figures.test.ts` fell into three separate ways.
    expect(without).toBeGreaterThan(0);
    expect(withWeakness).toBeGreaterThan(without);
  });

  /**
   * ⚠ ASSERTS THE CONSUMER, BECAUSE THE FIRST DRAFT DID NOT AND A SABOTAGE RUN
   * CAUGHT IT. That draft checked `skeleton.damageModifiers.immune.has('poison')`
   * — and with `applyDamage` stripped of its modifier lookup it STILL PASSED,
   * because it read the TABLE rather than the effect. Same family as brief #22's
   * tautological gate. A poisoned weapon driven into a Skeleton is the contract.
   */
  it('a Skeleton takes ZERO poison damage from a venomous weapon, while a Spider bleeds', () => {
    const poisonInto = (enemyId: number): { poison: number; events: number } => {
      const kit = musterParty([
        { classId: 1, name: 'Venomous', ancestry: ancestryIds[0]!, gender: 'm' as const },
      ])[0]!;
      kit.equipped = kit.equipped.filter((e) => String(e.baseId) !== LONGSWORD);
      kit.equipped.push({
        baseId: LONGSWORD, tier: 'magical', propertyIds: ['venom'], seed: 'venom',
      } as unknown as ItemInstance);
      const h = assembleHero(kit).c;
      h.hp = 400;
      h.maxHp = 400;
      const e = buildEnemy(enemyId, 'e1');
      e.hp = 4000;
      e.maxHp = 4000;
      const r = runEncounter('c_ven', 'r_ven', [h], [e], 'venom-seed');
      let poison = 0;
      let events = 0;
      for (const ev of r.stream.all()) {
        if (ev.type === 'combat.damage_applied') {
          const d = ev.data as { amount: number; kind: string };
          if (d.kind === 'poison') {
            poison += d.amount;
            events += 1;
          }
        }
      }
      return { poison, events };
    };

    const spider = poisonInto(GIANT_SPIDER);
    const skeleton = poisonInto(SKELETON);

    // The spider proves the weapon actually fires — without it, the skeleton's
    // zero could mean "immune" OR "no poison source in the fight at all".
    expect(spider.poison).toBeGreaterThan(0);
    expect(skeleton.poison).toBe(0);
    // ⚠ AND THE EVENT IS STILL EMITTED. "0 poison" is a fact the record can
    // show; silence is indistinguishable from a rider that never fired.
    expect(skeleton.events).toBeGreaterThan(0);
  });

  /**
   * ⚠ THE DERIVATION TEST, AND IT IS THE POINT OF Q3. Bone Conscript authors
   * NO abilities string at all, yet is `enemy_type: 'undead'`. Deriving from
   * the type rather than the string is what makes it immune — if this ever
   * fails, someone has switched immunity back to reading the ability string.
   */
  it('an undead that names NO abilities is still immune, because immunity derives from enemy_type', () => {
    const row = enemies.find((e) => e.id === BONE_CONSCRIPT)!;
    expect(parseAbilities(row.abilities)).toEqual([]);
    expect(row.enemy_type).toBe('undead');
    expect(buildEnemy(BONE_CONSCRIPT, 'bc').damageModifiers.immune.has('poison')).toBe(true);
  });

  it('heroes carry no damage modifiers — the channel is enemy-side only today', () => {
    const h = hero();
    expect(h.damageModifiers.immune.size).toBe(0);
    expect(h.damageModifiers.weak.size).toBe(0);
    expect(h.damageModifiers.resist.size).toBe(0);
  });
});

describe('brief #26 — the content vocabulary is fully accounted for', () => {
  /**
   * ⚠ THIS IS THE TEST THAT WOULD HAVE CAUGHT THE ORIGINAL DEFECT. Every
   * ability string in the registry must be either IMPLEMENTED or EXPLICITLY
   * DEFERRED. An unknown string means a typo in the content or a vocabulary
   * word nobody implemented — and under the old code, both were silent.
   *
   * ⚠ Do not "fix" a failure here by adding the string to DEFERRED_ABILITIES
   * without reading it. That converts a real signal into a rubber stamp.
   */
  it('every authored ability across all 45 enemy rows is known to the engine', () => {
    const unknown: string[] = [];
    for (const row of enemies) {
      for (const ability of parseAbilities(row.abilities)) {
        if (!isKnownAbility(ability)) unknown.push(`${row.name}: ${ability}`);
      }
    }
    expect(unknown).toEqual([]);
  });

  it('the registry still carries the abilities this brief was written against', () => {
    // Guards against the content being emptied and every test above passing
    // vacuously — the failure mode `tests/ui/figures.test.ts` hit three ways.
    const withAbilities = enemies.filter((e) => parseAbilities(e.abilities).length > 0);
    expect(withAbilities.length).toBeGreaterThanOrEqual(20);
  });
});
