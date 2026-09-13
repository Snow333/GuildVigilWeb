/**
 * ENEMY ABILITIES M3 — the positional and conditional traits (brief #26).
 *
 * pack_tactics · formation_bonus · charge · ferocity · regeneration_10
 *
 * ⚠ SAME RULES AS THE M1/M2 SUITE, AND FOR THE SAME REASON. No test here may
 * assert through `resolveEnemyAbilities`, and none may assert against the flag
 * it just set — a sabotage run during M2 proved that checking
 * `damageModifiers.immune.has(...)` stayed GREEN with the consumer gutted,
 * because it read the table rather than the effect. Every assertion below
 * reaches a real consumer: a resolved strike, or the event stream of a fight.
 */

import { describe, it, expect } from 'vitest';
import { resolveStrike } from '@sim/combat/strike';
import { runEncounter } from '@sim/combat/encounter';
import { buildEnemy } from '@sim/combat/build';
import { Rng } from '@sim/core/rng';
import {
  CHARGE_MIN_DISTANCE, FORMATION_AC_BONUS, PACK_TACTICS_BONUS,
} from '@sim/combat/enemyAbilities';
import type { Combatant } from '@sim/combat/types';

const WOLF = 3;        // L1 animal   — pack_tactics, trip
const HOBGOBLIN = 10;  // L3 humanoid — formation_bonus
const MINOTAUR = 14;   // L5 beast    — charge, gore
const ORC = 11;        // L3 humanoid — ferocity
const TROLL = 17;      // L6 giant    — regeneration_10, fire_weakness
const GOBLIN = 1;      // L1 humanoid — no abilities (the control)

const at = (u: Combatant, x: number, y: number): Combatant => {
  u.pos = { x, y };
  return u;
};

/** A strike resolved with a FIXED d20, so only the modifier can move the total. */
const strikeWith = (attacker: Combatant, defender: Combatant, all: Combatant[]) =>
  resolveStrike(attacker, defender, {
    rng: new Rng('fixed-seed'), flurryPenalty: 0, all,
  } as never);

describe('M3 — pack tactics', () => {
  /**
   * ⚠ ASSERTS THE ROLL'S MODIFIER, which is what the engine actually uses,
   * rather than the `packTactics` flag. Two wolves vs one wolf, same seed, same
   * positions apart from the packmate's presence.
   */
  it('a wolf with a packmate in contact attacks at a higher modifier than a lone wolf', () => {
    const target = at(buildEnemy(GOBLIN, 'prey'), 10, 10);
    target.side = 'heroes';

    const lone = at(buildEnemy(WOLF, 'w1'), 11, 10);
    const solo = strikeWith(lone, target, [lone, target]);

    const packmate = at(buildEnemy(WOLF, 'w2'), 9, 10);
    const pack = strikeWith(lone, target, [lone, packmate, target]);

    expect(pack.roll.modifier - solo.roll.modifier).toBe(PACK_TACTICS_BONUS);
  });

  it('a goblin gains nothing from an adjacent ally — the trait is what matters, not the geometry', () => {
    const target = at(buildEnemy(GOBLIN, 'prey2'), 10, 10);
    target.side = 'heroes';
    const g1 = at(buildEnemy(GOBLIN, 'g1'), 11, 10);
    const solo = strikeWith(g1, target, [g1, target]);
    const g2 = at(buildEnemy(GOBLIN, 'g2'), 9, 10);
    const withAlly = strikeWith(g1, target, [g1, g2, target]);
    expect(withAlly.roll.modifier).toBe(solo.roll.modifier);
  });

  it('a DISTANT packmate confers nothing — contact is required', () => {
    const target = at(buildEnemy(GOBLIN, 'prey3'), 10, 10);
    target.side = 'heroes';
    const wolf = at(buildEnemy(WOLF, 'w3'), 11, 10);
    const solo = strikeWith(wolf, target, [wolf, target]);
    const faraway = at(buildEnemy(WOLF, 'w4'), 19, 19);
    const withFar = strikeWith(wolf, target, [wolf, faraway, target]);
    expect(withFar.roll.modifier).toBe(solo.roll.modifier);
  });
});

describe('M3 — formation bonus', () => {
  it('a hobgoblin beside another hobgoblin is harder to hit', () => {
    const attacker = at(buildEnemy(GOBLIN, 'atk'), 11, 10);
    attacker.side = 'heroes';

    const lone = at(buildEnemy(HOBGOBLIN, 'h1'), 10, 10);
    const solo = strikeWith(attacker, lone, [attacker, lone]);

    const ally = at(buildEnemy(HOBGOBLIN, 'h2'), 9, 10);
    const formed = strikeWith(attacker, lone, [attacker, lone, ally]);

    // The DC is the defender's effective AC — the real consumer of the bonus.
    expect(formed.roll.dc - solo.roll.dc).toBe(FORMATION_AC_BONUS);
  });

  /**
   * ⚠ THE DISCIPLINE IS THE POINT. A hobgoblin standing beside a wolf is not in
   * formation. Without this control, "any adjacent ally" would pass every
   * assertion above.
   */
  it('a hobgoblin beside a DIFFERENT creature is not in formation', () => {
    const attacker = at(buildEnemy(GOBLIN, 'atk2'), 11, 10);
    attacker.side = 'heroes';
    const hob = at(buildEnemy(HOBGOBLIN, 'h3'), 10, 10);
    const solo = strikeWith(attacker, hob, [attacker, hob]);
    const wolf = at(buildEnemy(WOLF, 'w5'), 9, 10);
    const mixed = strikeWith(attacker, hob, [attacker, hob, wolf]);
    expect(mixed.roll.dc).toBe(solo.roll.dc);
  });
});

describe('M3 — charge', () => {
  it('a minotaur that closed a real distance hits harder than one already in contact', () => {
    const target = at(buildEnemy(GOBLIN, 'prey4'), 10, 10);
    target.side = 'heroes';
    target.hp = 500;
    target.maxHp = 500;

    const standing = at(buildEnemy(MINOTAUR, 'm1'), 11, 10);
    standing.chargeStartDistance = -1; // never approached
    const still = strikeWith(standing, target, [standing, target]);

    const charger = at(buildEnemy(MINOTAUR, 'm2'), 11, 10);
    charger.chargeStartDistance = CHARGE_MIN_DISTANCE + 2; // closed from range
    const charged = strikeWith(charger, target, [charger, target]);

    expect(charged.damage).toBeGreaterThan(still.damage);
  });

  it('a SHORT approach is not a charge', () => {
    const target = at(buildEnemy(GOBLIN, 'prey5'), 10, 10);
    target.side = 'heroes';
    target.hp = 500;
    target.maxHp = 500;
    const a = at(buildEnemy(MINOTAUR, 'm3'), 11, 10);
    a.chargeStartDistance = -1;
    const still = strikeWith(a, target, [a, target]);
    const b = at(buildEnemy(MINOTAUR, 'm4'), 11, 10);
    b.chargeStartDistance = CHARGE_MIN_DISTANCE - 2; // shuffled, did not charge
    const shuffled = strikeWith(b, target, [b, target]);
    expect(shuffled.damage).toBe(still.damage);
  });
});

describe('M3 — ferocity', () => {
  /**
   * ⚠ DRIVEN THROUGH A REAL FIGHT, and asserted on the EVENT STREAM. Checking
   * `orc.ferocityUsed` after calling a helper would be asserting the flag
   * against itself.
   */
  it('an orc survives a killing blow once, and the record says so', () => {
    const orc = buildEnemy(ORC, 'orc1');
    const hero = buildEnemy(GOBLIN, 'hero1');
    hero.side = 'heroes';
    hero.isHero = true;
    hero.attackBonus = 50; // never misses
    hero.damageDice = '10d10'; // always lethal
    hero.hp = 500;
    hero.maxHp = 500;

    const r = runEncounter('c_fer', 'r_fer', [hero], [orc], 'ferocity-seed');
    const reactions = r.stream.all().filter(
      (e) => e.type === 'combat.reaction_triggered' &&
        (e.data as { reactionId: string }).reactionId === 'ferocity',
    );
    expect(reactions.length).toBe(1); // exactly once — not zero, not every blow
  });

  it('a goblin, which lacks ferocity, never triggers it', () => {
    const goblin = buildEnemy(GOBLIN, 'gob1');
    const hero = buildEnemy(GOBLIN, 'hero2');
    hero.side = 'heroes';
    hero.isHero = true;
    hero.attackBonus = 50;
    hero.damageDice = '10d10';
    hero.hp = 500;
    hero.maxHp = 500;
    const r = runEncounter('c_fer2', 'r_fer2', [hero], [goblin], 'ferocity-seed-2');
    const reactions = r.stream.all().filter(
      (e) => e.type === 'combat.reaction_triggered' &&
        (e.data as { reactionId: string }).reactionId === 'ferocity',
    );
    expect(reactions.length).toBe(0);
  });
});

describe('M3 — regeneration', () => {
  it('a wounded troll heals during a fight; a wounded goblin does not', () => {
    const healingIn = (enemyId: number, seed: string): number => {
      const enemy = buildEnemy(enemyId, 'e1');
      enemy.hp = Math.max(1, Math.floor(enemy.maxHp / 2)); // already wounded
      const hero = buildEnemy(GOBLIN, 'h1');
      hero.side = 'heroes';
      hero.isHero = true;
      hero.hp = 400;
      hero.maxHp = 400;
      const r = runEncounter('c_reg', 'r_reg', [hero], [enemy], seed);
      let healed = 0;
      for (const ev of r.stream.all()) {
        if (ev.type === 'combat.healing_applied') {
          const d = ev.data as { targetId: string; amount: number };
          if (d.targetId === enemy.id) healed += d.amount;
        }
      }
      return healed;
    };

    expect(healingIn(TROLL, 'regen-1')).toBeGreaterThan(0);
    expect(healingIn(GOBLIN, 'regen-2')).toBe(0);
  });

  /**
   * ⚠ REGENERATION MUST NOT RAISE THE DEAD. If it fired on a corpse, a troll
   * would be unkillable and every d5 fight would hit the tick cap.
   */
  it('regeneration never heals a troll that is already dead', () => {
    const troll = buildEnemy(TROLL, 't1');
    const hero = buildEnemy(GOBLIN, 'h2');
    hero.side = 'heroes';
    hero.isHero = true;
    hero.attackBonus = 50;
    hero.damageDice = '20d20';
    hero.hp = 500;
    hero.maxHp = 500;

    const r = runEncounter('c_reg3', 'r_reg3', [hero], [troll], 'regen-3');
    const events = r.stream.all();
    const deathIdx = events.findIndex(
      (e) => e.type === 'combat.unit_died' && (e.data as { unitId: string }).unitId === troll.id,
    );
    expect(deathIdx).toBeGreaterThan(-1); // it does die
    const healedAfterDeath = events.slice(deathIdx).some(
      (e) => e.type === 'combat.healing_applied' &&
        (e.data as { targetId: string }).targetId === troll.id,
    );
    expect(healedAfterDeath).toBe(false);
  });
});
