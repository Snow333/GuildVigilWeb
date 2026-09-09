/**
 * COMBAT ABILITIES — the `combat_action` verb (brief #22 M2).
 *
 * ⚠ WHY AN EXPOSURE TEST EXISTS HERE (brief #20's lesson, applied):
 * "A FREE FEATURE AND A BROKEN FEATURE LOOK IDENTICAL ON THE CURVE." When M2's
 * code first landed, all 529 existing tests stayed green — because no hero had
 * an ability in their loadout, so not one line of it ever executed. Every
 * harness would have kept passing forever with the whole feature dead.
 *
 * So the first assertions in this file are not about balance. They assert the
 * feature is REACHED AT ALL, and each has a stated negative control.
 */

import { describe, expect, it } from 'vitest';
import {
  abilityDef, abilityInterval, abilityReady, applySelfAbility, applyStrikeRider, consumeAbility,
} from '@sim/combat/abilities';
import { applyCondition } from '@sim/combat/conditions';
import { runEncounter } from '@sim/combat/encounter';
import { pickAction } from '@sim/combat/loadout';
import { ACTIVE_WIRED } from '@sim/heroes/featEffects';
import { Rng } from '@sim/core/rng';
import { ARENA, ENCOUNTER } from '@content/combat';
import { combatant } from './conditions.test';
import type { Combatant } from '@sim/combat/types';

const POWER_ATTACK = 1;
const INTIMIDATING_STRIKE = 4;
const KNOCKDOWN = 5;
const IMPROVED_KNOCKDOWN = 7;
const DETERMINATION = 8;
const BRUTISH_SHOVE = 9;
const POISON_WEAPON = 71;
const DEFENSIVE_WARD = 138;

describe('ability definitions parse from content', () => {
  it('every wired active resolves to a definition', () => {
    for (const featId of ACTIVE_WIRED) {
      const def = abilityDef(featId);
      expect(def, `feat #${featId} must parse`).not.toBeNull();
      expect(def!.actions).toBeGreaterThanOrEqual(1);
    }
  });

  it('reads the action cost the content authored, not an invented number', () => {
    // Power Attack is 2 actions; Brutish Shove is 1. If these ever disagree
    // with the db, the content changed and the balance did too.
    expect(abilityDef(POWER_ATTACK)!.actions).toBe(2);
    expect(abilityDef(BRUTISH_SHOVE)!.actions).toBe(1);
    expect(abilityDef(KNOCKDOWN)!.actions).toBe(2);
  });

  it('only Determination is once-per-combat, and it is flagged from content', () => {
    expect(abilityDef(DETERMINATION)!.oncePerCombat).toBe(true);
    expect(abilityDef(POWER_ATTACK)!.oncePerCombat).toBe(false);
  });

  it('an unwired combat_action feat does NOT become an ability', () => {
    // #10 Double Slice carries implemented:false. The readiness gate must stop
    // it even though its effect_type is combat_action.
    expect(abilityDef(10)).toBeNull();
    // #16 Parry likewise — flagged unimplemented, and NOT in ACTIVE_WIRED.
    expect(abilityDef(16)).toBeNull();
  });
});

describe('the three limiters are distinct systems (brief #22 D2)', () => {
  it('LIMITER 2 — once per combat: available, then spent for the fight', () => {
    const u = combatant();
    expect(abilityReady(u, DETERMINATION, 0)).toBe(true);
    consumeAbility(u, DETERMINATION, 0);
    expect(abilityReady(u, DETERMINATION, 0)).toBe(false);
    // ⚠ Still unavailable much later — a use limit is NOT a long cooldown.
    // If this ever passes at a later tick, the two tiers have been collapsed.
    expect(abilityReady(u, DETERMINATION, 100_000)).toBe(false);
  });

  it('LIMITER 1 — cooldown in ticks: unavailable, then available again', () => {
    const u = combatant();
    const def = abilityDef(POISON_WEAPON)!;
    expect(def.cooldownTicks).toBeGreaterThan(0);
    consumeAbility(u, POISON_WEAPON, 100);
    expect(abilityReady(u, POISON_WEAPON, 100)).toBe(false);
    expect(abilityReady(u, POISON_WEAPON, 100 + def.cooldownTicks - 1)).toBe(false);
    // ⚠ And it DOES come back — the difference from once-per-combat.
    expect(abilityReady(u, POISON_WEAPON, 100 + def.cooldownTicks)).toBe(true);
  });

  it('an ability with neither limiter is always ready', () => {
    const u = combatant();
    consumeAbility(u, POWER_ATTACK, 0);
    expect(abilityReady(u, POWER_ATTACK, 0)).toBe(true);
  });

  it('ACTION COST is a time cost, orthogonal to both limiters', () => {
    const base = ENCOUNTER.attackIntervalTicks;
    expect(abilityInterval(base, abilityDef(POWER_ATTACK)!)).toBe(base * 2);
    expect(abilityInterval(base, abilityDef(BRUTISH_SHOVE)!)).toBe(base * 1);
  });
});

describe('the loadout walk reaches abilities', () => {
  const enemy = (): Combatant => combatant({ id: 'e1', side: 'enemies', isHero: false, pos: { x: 1, y: 0 } });

  it('picks an ability entry when it is ready', () => {
    const u = combatant({
      loadout: [{ action: 'ability', featId: POWER_ATTACK, condition: { kind: 'always' }, target: 'scoredEnemy' }],
    });
    const foe = enemy();
    const picked = pickAction(u, [u, foe], 0);
    expect(picked.entry.action).toBe('ability');
  });

  it('FALLS THROUGH to a strike when the ability is on cooldown — never stands idle', () => {
    const u = combatant({
      loadout: [{ action: 'ability', featId: POISON_WEAPON, condition: { kind: 'always' }, target: 'self' }],
    });
    const foe = enemy();
    consumeAbility(u, POISON_WEAPON, 0);
    const picked = pickAction(u, [u, foe], 1);
    expect(picked.entry.action).toBe('strike');
  });

  it('SKIPS a no-op ability: Determination with nothing to remove', () => {
    const u = combatant({
      loadout: [{ action: 'ability', featId: DETERMINATION, condition: { kind: 'always' }, target: 'self' }],
    });
    const foe = enemy();
    // Nothing debilitating applied -> the ability would waste its one use.
    expect(pickAction(u, [u, foe], 0).entry.action).toBe('strike');
    // ...but the moment there IS something to clear, it fires.
    applyCondition(u, 'frightened', 2);
    expect(pickAction(u, [u, foe], 0).entry.action).toBe('ability');
  });
});

describe('strike riders do what the content says', () => {
  const ctx = (rng: Rng, critical = false) => ({ rng, tick: 0, room: ARENA, critical });

  it('Power Attack adds an extra weapon die', () => {
    const attacker = combatant({ damageDice: '1d8' });
    const target = combatant({ id: 't', side: 'enemies' });
    const out = applyStrikeRider(abilityDef(POWER_ATTACK)!, attacker, target, ctx(new Rng('pa')));
    expect(out.bonusDamage).toBeGreaterThanOrEqual(1);
    expect(out.bonusDamage).toBeLessThanOrEqual(8);
  });

  it('Intimidating Strike frightens 1 on a hit and 2 on a crit', () => {
    const attacker = combatant();
    const t1 = combatant({ id: 't1', side: 'enemies' });
    applyStrikeRider(abilityDef(INTIMIDATING_STRIKE)!, attacker, t1, ctx(new Rng('is')));
    expect(t1.conditions.get('frightened')?.value).toBe(1);

    const t2 = combatant({ id: 't2', side: 'enemies' });
    applyStrikeRider(abilityDef(INTIMIDATING_STRIKE)!, attacker, t2, ctx(new Rng('is'), true));
    expect(t2.conditions.get('frightened')?.value).toBe(2);
  });

  it('Brutish Shove pushes the target away and keeps it INSIDE the room', () => {
    const attacker = combatant({ pos: { x: 5, y: 5 } });
    const target = combatant({ id: 't', side: 'enemies', pos: { x: 6, y: 5 } });
    applyStrikeRider(abilityDef(BRUTISH_SHOVE)!, attacker, target, ctx(new Rng('bs')));
    expect(target.pos.x).toBeGreaterThan(6);

    // ⚠ Brief #19's walls apply to FORCED movement too — a shove must not be
    // able to push a body out of the arena.
    const pinned = combatant({ id: 'p', side: 'enemies', pos: { x: ARENA.width - 0.2, y: 5 } });
    const shover = combatant({ pos: { x: ARENA.width - 2, y: 5 } });
    applyStrikeRider(abilityDef(BRUTISH_SHOVE)!, shover, pinned, ctx(new Rng('bs2')));
    expect(pinned.pos.x).toBeLessThanOrEqual(ARENA.width);
  });

  it('Improved Knockdown auto-trips on a critical strike; Knockdown must roll', () => {
    const attacker = combatant({ athletics: 10 });
    const target = combatant({ id: 't', side: 'enemies', saves: { fort: 0, ref: 0, will: 0 } });
    applyStrikeRider(abilityDef(IMPROVED_KNOCKDOWN)!, attacker, target, ctx(new Rng('ik'), true));
    expect(target.conditions.has('prone')).toBe(true);
  });

  it('a trip against an overwhelming defender can FAIL — it is a check, not a guarantee', () => {
    const weak = combatant({ athletics: -5 });
    const titan = combatant({ id: 't', side: 'enemies', saves: { fort: 60, ref: 0, will: 0 } });
    const out = applyStrikeRider(abilityDef(KNOCKDOWN)!, weak, titan, ctx(new Rng('trip')));
    expect(out.conditions).toHaveLength(0);
    expect(titan.conditions.has('prone')).toBe(false);
  });
});

describe('non-strike abilities', () => {
  it('Determination clears a listed condition and reports it', () => {
    const u = combatant();
    applyCondition(u, 'frightened', 2);
    applyCondition(u, 'sickened', 1);
    const out = applySelfAbility(abilityDef(DETERMINATION)!, u, [u], 0);
    expect(out.applied).toBe(true);
    expect(u.conditions.has('frightened')).toBe(false);
    expect(u.conditions.has('sickened')).toBe(false);
  });

  it('Determination IGNORES conditions this engine does not model, without throwing', () => {
    // Its content lists 'enfeebled' and 'clumsy', neither of which exists in
    // CONDITION_IDS. Authored content awaiting an implementation is not
    // corrupt data — it must be skipped, not fatal.
    const u = combatant();
    applyCondition(u, 'stunned', 1);
    expect(() => applySelfAbility(abilityDef(DETERMINATION)!, u, [u], 0)).not.toThrow();
    expect(u.conditions.has('stunned')).toBe(false);
  });

  it('Defensive Ward buffs the WORST-OFF ally, not the first in the list', () => {
    const cleric = combatant({ id: 'c' });
    const healthy = combatant({ id: 'a1', hp: 30, maxHp: 30 });
    const hurt = combatant({ id: 'a2', hp: 4, maxHp: 30 });
    const out = applySelfAbility(abilityDef(DEFENSIVE_WARD)!, cleric, [cleric, healthy, hurt], 0);
    expect(out.buffedAllyId).toBe('a2');
    expect(hurt.conditions.has('defending')).toBe(true);
  });

  it('Poison Weapon arms the next strike and scales with level', () => {
    const low = combatant({ level: 3 });
    applySelfAbility(abilityDef(POISON_WEAPON)!, low, [low], 0);
    expect(low.pendingPoisonDice).toBe('1d4');

    const high = combatant({ level: 12 });
    applySelfAbility(abilityDef(POISON_WEAPON)!, high, [high], 0);
    expect(high.pendingPoisonDice).toBe('3d4');
  });
});

/**
 * ⚠ THE EXPOSURE TESTS. Everything above proves the parts work in isolation.
 * These prove the parts are actually REACHED by a real encounter — the check
 * that would have caught M2 sitting dead behind an empty loadout.
 */
describe('EXPOSURE — abilities fire in a real encounter and change its outcome', () => {
  // ⚠ `placeFormation` repositions everyone at muster separation, so the `pos`
  // here is a starting hint only — never assert on it (brief #20's lesson:
  // reading positions after runEncounter measures where units MOVED to).
  const fighter = (loadout: Combatant['loadout']): Combatant =>
    combatant({
      id: 'hero_f', name: 'Torvald', side: 'heroes', isHero: true,
      pos: { x: 3, y: 10 }, maxHp: 60, hp: 60, ac: 18, attackBonus: 12,
      damageDice: '1d8', athletics: 8, level: 5, loadout,
    });

  const dummy = (): Combatant =>
    combatant({
      id: 'foe_1', name: 'Dummy', side: 'enemies', isHero: false,
      pos: { x: 6, y: 10 }, maxHp: 400, hp: 400, ac: 10, attackBonus: 0,
      damageDice: '1d4', saves: { fort: 0, ref: 0, will: 0 }, level: 1,
    });

  const run = (loadout: Combatant['loadout'], seed: string) =>
    runEncounter('c_ability', 'r_ability', [fighter(loadout)], [dummy()], seed);

  const POWER_ATTACK_LOADOUT: Combatant['loadout'] = [
    { action: 'ability', featId: POWER_ATTACK, condition: { kind: 'always' }, target: 'scoredEnemy' },
  ];

  it('a Power Attack loadout PRODUCES ability-driven damage the plain strike does not', () => {
    // Same seed, same combatants, only the loadout differs.
    const withAbility = run(POWER_ATTACK_LOADOUT, 'exposure-pa');
    const plain = run([], 'exposure-pa');

    const damageOf = (r: ReturnType<typeof runEncounter>): number =>
      r.stream.all()
        .filter((e) => e.type === 'combat.damage_applied')
        .reduce((sum, e) => sum + (e.data as { amount: number }).amount, 0);

    // ⚠ THE FEATURE IS REACHED: the two streams must DIFFER. If this ever
    // reads equal, the ability branch is dead and every other test here is
    // testing a function nothing calls.
    expect(withAbility.stream.hash()).not.toBe(plain.stream.hash());
    expect(damageOf(withAbility)).toBeGreaterThan(0);
  });

  it('Power Attack trades RATE for SIZE — fewer swings, bigger hits', () => {
    const withAbility = run(POWER_ATTACK_LOADOUT, 'rate-vs-size');
    const plain = run([], 'rate-vs-size');

    const swings = (r: ReturnType<typeof runEncounter>): number =>
      r.stream.all().filter((e) => e.type === 'combat.attack_resolved'
        && (e.data as { attackerId: string }).attackerId === 'hero_f').length;

    // ⚠ THIS IS THE WHOLE POINT OF THE ACTION-COST MODEL. A 2-action ability
    // that swung as often as a normal attack would be strictly better and the
    // loadout choice would be fake. Fewer swings is the cost being paid.
    expect(swings(withAbility)).toBeLessThan(swings(plain));
  });

  it('Intimidating Strike actually lands frightened on an enemy mid-fight', () => {
    const result = run(
      [{ action: 'ability', featId: INTIMIDATING_STRIKE, condition: { kind: 'always' }, target: 'scoredEnemy' }],
      'exposure-is',
    );
    const frightened = result.stream.all().some(
      (e) => e.type === 'combat.condition_applied'
        && (e.data as { conditionId: string }).conditionId === 'frightened',
    );
    expect(frightened).toBe(true);
  });

  it('determinism: the same seed and loadout replay bit-identically', () => {
    const build = () => run(
      [{ action: 'ability', featId: KNOCKDOWN, condition: { kind: 'always' }, target: 'scoredEnemy' }],
      'determinism',
    );
    expect(build().stream.hash()).toBe(build().stream.hash());
  });
});
