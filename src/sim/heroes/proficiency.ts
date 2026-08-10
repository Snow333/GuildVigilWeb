/**
 * Proficiency tiers — faithful port of scripts/proficiency_tiers.gd.
 * Untrained/Trained/Expert/Master/Legendary, resolved per stat across ALL of a
 * hero's classes (keep highest). Feeds attack rolls, saves, and spell DCs.
 */

import { class_proficiency_tiers } from '@content/generated';
import { characterLevel, type HeroState } from './types';

export const TIER_UNTRAINED = 0;
export const TIER_TRAINED = 1;
export const TIER_EXPERT = 2;
export const TIER_MASTER = 3;
export const TIER_LEGENDARY = 4;

export const TIER_BONUS: Record<number, number> = {
  [TIER_TRAINED]: 0,
  [TIER_EXPERT]: 2,
  [TIER_MASTER]: 4,
  [TIER_LEGENDARY]: 6,
};

export const TIER_NAMES: Record<number, string> = {
  [TIER_UNTRAINED]: 'Untrained',
  [TIER_TRAINED]: 'Trained',
  [TIER_EXPERT]: 'Expert',
  [TIER_MASTER]: 'Master',
  [TIER_LEGENDARY]: 'Legendary',
};

/** Derived index: (classId → stat → milestones sorted by level req). Built once at load. */
const tierIndex = new Map<number, Map<string, { tier: number; levelReq: number }[]>>();
for (const row of class_proficiency_tiers) {
  const byStat = tierIndex.get(row.class_id) ?? new Map();
  tierIndex.set(row.class_id, byStat);
  const list = byStat.get(row.stat) ?? [];
  byStat.set(row.stat, list);
  list.push({ tier: row.tier, levelReq: row.class_level_req });
}

/** Base proficiency = character_level / 2 + 1 (integer division). */
export function baseProficiency(charLevel: number): number {
  return Math.floor(charLevel / 2) + 1;
}

export function tierBonus(tier: number): number {
  return TIER_BONUS[tier] ?? 0;
}

/** Highest tier for a stat across all the hero's classes at their current class levels. */
export function bestTier(hero: Pick<HeroState, 'classLevels'>, stat: string): number {
  let best = TIER_UNTRAINED;
  for (const cl of hero.classLevels) {
    const milestones = tierIndex.get(cl.classId)?.get(stat);
    if (!milestones) continue;
    for (const m of milestones) {
      if (m.levelReq <= cl.level && m.tier > best) best = m.tier;
    }
  }
  return best;
}

/** Full proficiency value = base + tier bonus. Attack rolls, saves, spell DC. */
export function totalProficiency(hero: Pick<HeroState, 'classLevels'>, stat: string): number {
  const level = Math.max(characterLevel(hero), 1);
  return baseProficiency(level) + tierBonus(bestTier(hero, stat));
}
