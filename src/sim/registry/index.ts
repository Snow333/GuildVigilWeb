/**
 * Typed accessors over the generated content registries — derived indexes built
 * once at load (teardown §3.7: flat arrays + Object.fromEntries maps).
 * Sim code reads content ONLY through here; no raw table scans in resolvers.
 */

import {
  buildings, class_progression, classes, enemies, quests, shop_stock, skills, spells,
  warlock_spell_costs,
} from '@content/generated';
import type { XpSourceResolver } from '@sim/heroes/xp';

// Key types widened to number: the generated `as const` tables produce literal
// ID unions, but lookups arrive as plain numbers from sim state.
export const enemiesById = new Map<number, (typeof enemies)[number]>(enemies.map((e) => [e.id, e]));
export const questsById = new Map<number, (typeof quests)[number]>(quests.map((q) => [q.id, q]));
export const classesById = new Map<number, (typeof classes)[number]>(classes.map((c) => [c.id, c]));
export const spellsById = new Map<number, (typeof spells)[number]>(spells.map((s) => [s.id, s]));
export const spellsByName = new Map<string, (typeof spells)[number]>(spells.map((s) => [s.name, s]));
/** Warlock pact energy cost by spell level (the hand-set 0/6/10/15/21/28/36 curve). */
export const warlockCostByLevel = new Map<number, number>(
  warlock_spell_costs.map((w) => [w.spell_level as number, w.energy_cost as number]),
);

/** Per-class-level progression row (hp/level, feat slots, spell slots). */
export const progressionByClassLevel = new Map<string, (typeof class_progression)[number]>(
  class_progression.map((r) => [`${r.class_id}:${r.level}`, r]),
);

export function progressionFor(classId: number, level: number): (typeof class_progression)[number] | null {
  return progressionByClassLevel.get(`${classId}:${level}`) ?? null;
}

export const buildingsById = new Map<number, (typeof buildings)[number]>(buildings.map((b) => [b.id, b]));

/** Shop stock rows in table order (rotation subsets derive per week from these). */
export const shopStockRows: readonly (typeof shop_stock)[number][] = shop_stock;

/** Skill names in registry order — the level-up wizard's allocation vocabulary. */
export const skillNames: readonly string[] = skills.map((s) => s.name.toLowerCase());

/** Production XP source resolver over the real registries. */
export const contentXpResolver: XpSourceResolver = {
  monsterXp(sourceId) {
    const enemy = enemiesById.get(sourceId);
    return enemy ? (enemy.xp_reward as number) : null;
  },
  questXp(sourceId) {
    const quest = questsById.get(sourceId);
    return quest ? (quest.reward_xp as number) : null;
  },
};
