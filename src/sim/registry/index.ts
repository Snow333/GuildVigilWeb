/**
 * Typed accessors over the generated content registries — derived indexes built
 * once at load (teardown §3.7: flat arrays + Object.fromEntries maps).
 * Sim code reads content ONLY through here; no raw table scans in resolvers.
 */

import { classes, enemies, quests } from '@content/generated';
import type { XpSourceResolver } from '@sim/heroes/xp';

// Key types widened to number: the generated `as const` tables produce literal
// ID unions, but lookups arrive as plain numbers from sim state.
export const enemiesById = new Map<number, (typeof enemies)[number]>(enemies.map((e) => [e.id, e]));
export const questsById = new Map<number, (typeof quests)[number]>(quests.map((q) => [q.id, q]));
export const classesById = new Map<number, (typeof classes)[number]>(classes.map((c) => [c.id, c]));

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
