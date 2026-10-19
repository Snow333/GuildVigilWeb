/**
 * THE TOUCH-CASTING WIZARD (M2) — the roadmap's fourth flagship.
 *
 * The Wizard held 24 feats and ZERO live actives; exactly one (#97 Spell
 * Penetration) reached any consumer. Its one `combat_action` carried the verb
 * `create_ward_ac_bonus`, which `abilities.ts` cannot execute, so the class's
 * only active did nothing. Three rows were rewritten onto contracts that have
 * consumers; the other 21 still need per-feat engine work.
 *
 * ⚠ THESE TESTS DRIVE THE REAL CAST PATH. Asserting
 * `featStat['spell_attack'] === 1` would only prove `resolveStatMods` sums a
 * number — the bug being fixed was a payload nothing read, so the witness has
 * to be the spell's own attack roll and damage coming out of `resolveCast`.
 */
import { describe, expect, it } from 'vitest';
import { resolveCast } from '@sim/combat/spells';
import { abilityDef } from '@sim/combat/abilities';
import { reachesConsumer } from '@sim/heroes/featEffects';
import { spells } from '@content/generated/spells';
import { Rng } from '@sim/core/rng';
import { combatant } from './conditions.test';
import type { Combatant } from '@sim/combat/types';

const PROTECTIVE_WARD = 104;
const TOUCH_HIT_SPEC = 219;
const TOUCH_DAMAGE_SPEC = 220;

/** A damaging spell that resolves with an ATTACK ROLL at touch range. */
const touchAttackSpell = spells.find(
  (s) => s.range_type === 'touch' && s.effect_type === 'damage'
    && s.save_type === null && s.damage_dice,
);

/** The same, at ranged — the control for "touch only". */
const rangedAttackSpell = spells.find(
  (s) => s.range_type === 'ranged' && s.effect_type === 'damage'
    && s.save_type === null && s.damage_dice,
);

function caster(touchDice: string | undefined, attackBonus: number): Combatant {
  return combatant({
    id: 'wiz', name: 'Ilyen', side: 'heroes', isHero: true, pos: { x: 0, y: 0 },
    maxHp: 40, hp: 40, isCaster: true, level: 6,
    casting: {
      attackBonus, dc: 20, casterLevel: 6, kind: 'slots',
      slots: [0, 9, 9, 9, 9], pactEnergy: 0,
      ...(touchDice ? { touchDamageDice: touchDice } : {}),
    },
  });
}

const target = (): Combatant => combatant({
  id: 'foe', name: 'Dummy', side: 'enemies', isHero: false, pos: { x: 1, y: 0 },
  maxHp: 100_000, hp: 100_000, ac: 10, saves: { fort: 0, ref: 0, will: 0 }, level: 1,
});

/** Total damage a spell deals over many casts (AC 10 so nearly all hit). */
function damageOver(spellId: number, c: Combatant, seeds: number): number {
  let total = 0;
  for (let i = 0; i < seeds; i++) {
    const foe = target();
    const r = resolveCast(c, spellId, foe, [c, foe], 0, new Rng(`touch-${i}`));
    for (const t of r.targets) total += t.damage ?? 0;
  }
  return total;
}

describe('the Wizard has working content at all (M2)', () => {
  it('Protective Ward is a LIVE active now, not an unimplemented verb', () => {
    expect(reachesConsumer(PROTECTIVE_WARD)).toBe(true);
    const def = abilityDef(PROTECTIVE_WARD);
    expect(def).not.toBeNull();
    expect(def!.effect).toBe('grant_ally_ac');
  });

  it('both touch specializations reach a consumer', () => {
    expect(reachesConsumer(TOUCH_HIT_SPEC)).toBe(true);
    expect(reachesConsumer(TOUCH_DAMAGE_SPEC)).toBe(true);
  });

  it('the fixtures exist — there IS a touch attack spell to specialise in', () => {
    // If the content ever loses its touch attack spells this whole feature is
    // decoration, so fail loudly here rather than silently testing nothing.
    expect(touchAttackSpell, 'a touch-range damage spell with an attack roll').toBeDefined();
    expect(rangedAttackSpell, 'a ranged-range damage spell with an attack roll').toBeDefined();
  });
});

describe('EXPOSURE — touch specialization changes the spell, through resolveCast', () => {
  it('TOUCH HIT raises the spell ATTACK ROLL modifier', () => {
    const foe = target();
    const plain = resolveCast(caster(undefined, 6), touchAttackSpell!.id as number, foe, [], 0, new Rng('hit'));
    const spec = resolveCast(caster(undefined, 7), touchAttackSpell!.id as number, foe, [], 0, new Rng('hit'));
    // `casting.attackBonus` is what `resolveCast` puts in the roll, and
    // assembly.ts feeds it `featStat['spell_attack']` — the +1 from #219.
    expect(plain.targets[0]!.attack!.modifier).toBe(6);
    expect(spec.targets[0]!.attack!.modifier).toBe(7);
  });

  it('TOUCH DAMAGE adds dice to a TOUCH spell', () => {
    const SEEDS = 300;
    const without = damageOver(touchAttackSpell!.id as number, caster(undefined, 12), SEEDS);
    const withSpec = damageOver(touchAttackSpell!.id as number, caster('1d4', 12), SEEDS);
    expect(withSpec).toBeGreaterThan(without);
  });

  it('...and NOTHING to a ranged spell — the feat is about touching things', () => {
    // ⚠ THE CONTROL THAT MAKES THE CLAIM MEAN SOMETHING. Without it, "touch
    // specialization" could be a flat damage buff on every spell and the test
    // above would still pass.
    const SEEDS = 300;
    const without = damageOver(rangedAttackSpell!.id as number, caster(undefined, 12), SEEDS);
    const withSpec = damageOver(rangedAttackSpell!.id as number, caster('1d4', 12), SEEDS);
    expect(withSpec).toBe(without);
  });
});
