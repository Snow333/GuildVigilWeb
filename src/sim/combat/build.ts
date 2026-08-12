/**
 * Production combatant builders from registry rows (the harness builds its own
 * fixtures; dispatch needs the real thing). Saves derive from level until the
 * enemy statblocks grow explicit save columns (enemy-grammar content work).
 */

import { enemiesById } from '@sim/registry';
import type { Combatant } from './types';

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
    weaponAgile: false,
    weaponPenalty: 0,
    weaponSpecBonus: 0,
    isWeaponProficient: true,
    sneakAttackDice: '',
    speed: row.speed as number,
    wounded: 0,
    level,
    initiativeBonus: level + 2, // ported enemy initiative: d20 + level + 2
    isCaster: false,
    saves: { fort: 2 + level, ref: 2 + level, will: 1 + level },
    tempHp: 0,
    casting: null,
    loadout: [],
    reactions: [], // enemies have intrinsic AoO in the encounter loop
    lastReactionTick: -1000,
    conditions: new Map(),
    flurrySwings: 0,
    lastSwingTick: 0,
    nextActionTick: 0,
  };
}
