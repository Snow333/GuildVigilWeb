/**
 * Production combatant builders from registry rows (the harness builds its own
 * fixtures; dispatch needs the real thing). Saves derive from level until the
 * enemy statblocks grow explicit save columns (enemy-grammar content work).
 */

import { abilityMod } from '@sim/heroes/types';
import { enemiesById } from '@sim/registry';
import type { Combatant } from './types';

/**
 * Enemy skill totals. Statblocks carry full ability scores but no skill ranks
 * and no proficiency column, so ranks derive from level — the same shape brief
 * #19 §13.4 used for the Perception DC (`10 + level + WIS`, which is this
 * total plus a d20's average).
 */
const enemySkill = (level: number, score: number): number => level + abilityMod(score);

export function buildEnemy(enemyId: number, instanceId: string): Combatant {
  const row = enemiesById.get(enemyId);
  if (!row) throw new Error(`buildEnemy: unknown enemy ${enemyId}`);
  const level = row.base_level as number;
  return {
    id: instanceId,
    name: row.name,
    baseId: String(enemyId),
    side: 'enemies',
    isHero: false,
    pos: { x: 0, y: 0 },
    maxHp: row.hp,
    hp: row.hp,
    ac: row.ac,
    attackBonus: row.attack_bonus,
    damageDice: row.damage_dice,
    weaponRange: 1,
    engageRange: 1, // enemy statblocks are melee until the registry grows ranged rows
    weaponAgile: false,
    weaponPenalty: 0,
    weaponSpecBonus: 0,
    isWeaponProficient: true,
    sneakAttackDice: '',
    speed: row.speed as number,
    wounded: 0,
    level,
    initiativeBonus: level + 2, // ported enemy initiative: d20 + level + 2
    stealth: enemySkill(level, row.dex as number),
    perception: enemySkill(level, row.wis as number),
    isCaster: false,
    saves: { fort: 2 + level, ref: 2 + level, will: 1 + level },
    tempHp: 0,
    casting: null,
    loadout: [],
    /**
     * ⚠ AoO NOW COMES FROM CONTENT (brief #19 §10.2). This line used to read
     * `reactions: []` with the comment "enemies have intrinsic AoO in the
     * encounter loop" — and the loop's `hasAoo` was `!u.isHero ||
     * u.reactions.includes('aoo')`, so EVERY enemy in the game got an attack
     * of opportunity while `enemies.aoo_count` was read by nothing. 40 of the
     * 45 rows say 0; only five say ≥ 1 (Hobgoblin Legionnaire, Hobgoblin
     * Tactician, Vanguard Champion, The Whisper's Blade at 1, Vanguard-Captain
     * Ruk Mor-Tal at 2).
     *
     * Content is authoritative here and PF2E agrees with it: AoO is a Fighter
     * class feature and a property of specific monsters, not something a goblin
     * has. That is the rule that decides code-vs-content disputes — the side
     * that matches the ruleset wins — and it is the mirror image of brief #14's
     * bug B, where the code was the one that matched.
     *
     * ⚠ COUNTS ABOVE 1 ARE NOT MODELLED. Ruk Mor-Tal's `aoo_count: 2` grants
     * one AoO per `attackIntervalTicks` like everyone else; PF2E's reaction
     * budget has no home in continuous time yet, and §10.2 measured the
     * boolean. Logged, not silently rounded away.
     */
    reactions: ((row.aoo_count as number | null) ?? 0) >= 1 ? ['aoo'] : [],
    lastReactionTick: -1000,
    conditions: new Map(),
    flurrySwings: 0,
    lastSwingTick: 0,
    nextActionTick: 0,
  };
}
