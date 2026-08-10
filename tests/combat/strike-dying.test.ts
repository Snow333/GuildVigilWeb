import { describe, expect, it } from 'vitest';
import { applyCondition, conditionValue, hasCondition } from '@sim/combat/conditions';
import { damageWhileDying, healDying, knockOut, resolveDyingRecovery } from '@sim/combat/dying';
import { resolveStrike } from '@sim/combat/strike';
import { Rng } from '@sim/core/rng';
import { combatant } from './conditions.test';

const ctx = (rng: Rng, all: ReturnType<typeof combatant>[], flurry = 0) =>
  ({ rng, flurryPenalty: flurry, all });

describe('strike resolution (ported from combat_strike_resolver.gd)', () => {
  it('hero melee gets the +2 engagement bonus; enemies and ranged heroes do not', () => {
    const enemy = combatant({ id: 'e1', side: 'enemies', isHero: false, pos: { x: 1, y: 0 } });
    const heroMelee = combatant();
    const heroRanged = combatant({ id: 'h2', weaponRange: 10 });
    const enemyAttacker = combatant({ id: 'e2', side: 'enemies', isHero: false });

    expect(resolveStrike(heroMelee, enemy, ctx(new Rng('s1'), [heroMelee, enemy])).meleeBonus).toBe(2);
    expect(resolveStrike(heroRanged, enemy, ctx(new Rng('s2'), [heroRanged, enemy])).meleeBonus).toBe(0);
    expect(resolveStrike(enemyAttacker, heroMelee, ctx(new Rng('s3'), [enemyAttacker, heroMelee])).meleeBonus).toBe(0);
  });

  it('hits deal min 1 damage; crits double the whole package; misses deal 0', () => {
    const rng = new Rng('strike_dist');
    const attacker = combatant();
    const target = combatant({ id: 'e1', side: 'enemies', isHero: false, ac: 15, pos: { x: 1, y: 0 } });
    let sawHit = false;
    let sawMiss = false;
    for (let i = 0; i < 300; i++) {
      const r = resolveStrike(attacker, target, ctx(rng, [attacker, target]));
      if (r.roll.degree === 'failure' || r.roll.degree === 'critFailure') {
        expect(r.damage).toBe(0);
        sawMiss = true;
      } else {
        expect(r.damage).toBeGreaterThanOrEqual(1);
        sawHit = true;
        if (r.roll.degree === 'critSuccess') {
          expect(r.damage).toBe(Math.max((r.baseDamage + r.conditionDamageMod + r.sneakDamage) * 2, 1));
        }
      }
    }
    expect(sawHit && sawMiss).toBe(true);
  });

  it('sneak attack fires only vs flat-footed; flanking supplies it', () => {
    const rogue = combatant({ id: 'rogue', sneakAttackDice: '2d6', attackBonus: 50 }); // always hits
    const target = combatant({ id: 'e1', side: 'enemies', isHero: false, pos: { x: 1, y: 0 } });
    const noFlank = resolveStrike(rogue, target, ctx(new Rng('sn1'), [rogue, target]));
    expect(noFlank.isSneakAttack).toBe(false);

    const flanker = combatant({ id: 'h2', pos: { x: 2, y: 0 } }); // opposite side of target from rogue
    const flanked = resolveStrike(rogue, target, ctx(new Rng('sn2'), [rogue, target, flanker]));
    expect(flanked.flanked).toBe(true);
    expect(flanked.isSneakAttack).toBe(true);
    expect(flanked.sneakDamage).toBeGreaterThanOrEqual(2);
  });

  it('weapon spec only applies when proficient; non-proficiency −4 hits the roll', () => {
    const prof = combatant({ id: 'p', weaponSpecBonus: 4, attackBonus: 50 });
    const noProf = combatant({ id: 'np', weaponSpecBonus: 4, isWeaponProficient: false, weaponPenalty: -4, attackBonus: 50 });
    const target = combatant({ id: 'e1', side: 'enemies', isHero: false, pos: { x: 1, y: 0 } });
    const a = resolveStrike(prof, target, ctx(new Rng('sp1'), [prof, target]));
    const b = resolveStrike(noProf, target, ctx(new Rng('sp1'), [noProf, target]));
    expect(a.baseDamage).toBeGreaterThan(b.baseDamage); // same seed, same dice; spec gated off
    expect(b.roll.modifier).toBe(a.roll.modifier - 4);
  });

  it('flurry penalty flows into the roll modifier', () => {
    const attacker = combatant();
    const target = combatant({ id: 'e1', side: 'enemies', isHero: false, pos: { x: 1, y: 0 } });
    const fresh = resolveStrike(attacker, target, ctx(new Rng('f1'), [attacker, target], 0));
    const tired = resolveStrike(attacker, target, ctx(new Rng('f1'), [attacker, target], -10));
    expect(tired.roll.modifier).toBe(fresh.roll.modifier - 10);
  });
});

describe('dying/wounded/KO cascade (ported from dying_processor.gd)', () => {
  it('KO starts dying at 1 + wounded — repeated rescues get progressively lethal', () => {
    const fresh = combatant();
    expect(knockOut(fresh)).toBe(1);
    const scarred = combatant({ id: 'h2', wounded: 2 });
    expect(knockOut(scarred)).toBe(3);
    expect(hasCondition(scarred, 'unconscious')).toBe(true);
  });

  it('waking ratchets wounded permanently and sets HP to exactly 1', () => {
    const u = combatant();
    knockOut(u);
    // Force a wake by scanning seeds for a crit success (DC 11 → d20 ≥ 21 impossible; success path to 0 wakes).
    let guard = 0;
    while (hasCondition(u, 'dying') && guard++ < 200) resolveDyingRecovery(u, new Rng(`wake_${guard}`));
    expect(u.hp).toBe(1);
    expect(u.wounded).toBe(1);
    expect(conditionValue(u, 'wounded')).toBe(1);
  });

  it('recovery math: DC hardens with dying; crit fail +2; death at 4', () => {
    const u = combatant({ wounded: 1 });
    knockOut(u); // dying 2, DC 12
    // Find a seed whose first d20 is a nat 1 → crit fail → dying 4 → dead.
    let died = false;
    for (let i = 0; i < 400 && !died; i++) {
      const trial = combatant({ id: `t${i}`, wounded: 1 });
      knockOut(trial);
      const r = resolveDyingRecovery(trial, new Rng(`cf_${i}`));
      if (r.roll.d20 === 1) {
        expect(r.roll.dc).toBe(12);
        expect(r.dyingAfter).toBe(4);
        expect(r.died).toBe(true);
        died = true;
      }
    }
    expect(died).toBe(true);
  });

  it('damage while dying pushes the value; healing wakes with the ratchet', () => {
    const u = combatant();
    knockOut(u); // dying 1
    expect(damageWhileDying(u)).toBe(2);
    healDying(u, 8);
    expect(u.hp).toBe(8);
    expect(hasCondition(u, 'dying')).toBe(false);
    expect(u.wounded).toBe(1); // rescue still ratchets
  });

  it('the death spiral fixture: wounded 3 hero KOs straight to dying 4 territory', () => {
    const u = combatant({ wounded: 3 });
    const start = knockOut(u);
    expect(start).toBe(4); // one bad hit from death before any roll — the ratchet's endgame
    applyCondition(u, 'dying', start);
    expect(conditionValue(u, 'dying')).toBe(4);
  });
});
