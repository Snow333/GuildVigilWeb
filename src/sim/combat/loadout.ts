/**
 * The loadout-priority layer — core-loop D4 made executable: "known pool →
 * ordered active loadout; the AI plays down the priority list." The vocabulary
 * is deliberately gambit-lite (teardown §4.1: seventeen enum members produce
 * the entire tactical game). Ordering IS the strategy.
 */

import { spellsById, warlockCostByLevel } from '@sim/registry';
import { chooseTarget } from './ai';
import { dist, type Combatant } from './types';

export type LoadoutCondition =
  | { kind: 'always' }
  | { kind: 'selfHpBelow'; pct: number }
  | { kind: 'allyHpBelow'; pct: number }
  | { kind: 'enemyWithin'; range: number }
  | { kind: 'notActive'; conditionId: string }; // toggles/stances: fire once

export type LoadoutTargetSpec = 'scoredEnemy' | 'nearestEnemy' | 'lowestAlly' | 'self';

export type LoadoutEntry =
  | { action: 'strike'; condition: LoadoutCondition; target: 'scoredEnemy' | 'nearestEnemy' }
  | { action: 'cast'; spellId: number; condition: LoadoutCondition; target: LoadoutTargetSpec }
  | { action: 'toggle'; featId: number; condition: LoadoutCondition };

export const DEFAULT_STRIKE: LoadoutEntry = { action: 'strike', condition: { kind: 'always' }, target: 'scoredEnemy' };

export interface ResolvedAction {
  entry: LoadoutEntry;
  target: Combatant | null; // null only for toggles
}

function conditionMet(c: LoadoutCondition, u: Combatant, all: readonly Combatant[]): boolean {
  switch (c.kind) {
    case 'always':
      return true;
    case 'selfHpBelow':
      return u.hp / u.maxHp < c.pct;
    case 'allyHpBelow':
      return all.some((a) => a.side === u.side && a.id !== u.id && a.hp > 0 && a.hp / a.maxHp < c.pct);
    case 'enemyWithin':
      return all.some((e) => e.side !== u.side && e.hp > 0 && dist(u.pos, e.pos) <= c.range);
    case 'notActive':
      return !u.conditions.has(c.conditionId);
  }
}

function resolveTarget(spec: LoadoutTargetSpec, u: Combatant, all: readonly Combatant[], healThreshold?: number): Combatant | null {
  switch (spec) {
    case 'self':
      return u;
    case 'scoredEnemy':
      return chooseTarget(u, all);
    case 'nearestEnemy': {
      const enemies = all.filter((e) => e.side !== u.side && e.hp > 0 && !e.conditions.has('unconscious'));
      if (enemies.length === 0) return null;
      return enemies.reduce((a, b) => {
        const da = dist(u.pos, a.pos);
        const db = dist(u.pos, b.pos);
        return db < da || (db === da && b.id < a.id) ? b : a;
      });
    }
    case 'lowestAlly': {
      const allies = all.filter(
        (a) => a.side === u.side && a.id !== u.id &&
          (a.hp > 0 || a.conditions.has('dying')) &&
          (healThreshold === undefined || a.hp / a.maxHp < healThreshold),
      );
      if (allies.length === 0) return null;
      return allies.reduce((a, b) => {
        const fa = a.hp / a.maxHp;
        const fb = b.hp / b.maxHp;
        return fb < fa || (fb === fa && b.id < a.id) ? b : a;
      });
    }
  }
}

/** Can this unit pay for the spell right now? (Cantrips are free.) */
export function canAfford(u: Combatant, spellId: number): boolean {
  const spell = spellsById.get(spellId);
  if (!spell) return false;
  const level = (spell.spell_level as number | null) ?? 0;
  if (level <= 0) return true; // cantrip / at-will
  if (!u.casting) return false;
  if (u.casting.kind === 'pact') return u.casting.pactEnergy >= (warlockCostByLevel.get(level) ?? Infinity);
  return (u.casting.slots[level] ?? 0) > 0;
}

/**
 * Walk the loadout top-down; first entry whose condition holds, whose target
 * resolves, and whose cost is affordable wins. Falls back to DEFAULT_STRIKE.
 */
export function pickAction(u: Combatant, all: readonly Combatant[]): ResolvedAction {
  for (const entry of u.loadout) {
    if (!conditionMet(entry.condition, u, all)) continue;
    if (entry.action === 'toggle') return { entry, target: null };
    if (entry.action === 'cast') {
      if (!canAfford(u, entry.spellId)) continue;
      const spell = spellsById.get(entry.spellId);
      const healGate = spell?.effect_type === 'healing' && entry.condition.kind === 'allyHpBelow'
        ? entry.condition.pct
        : undefined;
      const target = resolveTarget(entry.target, u, all, healGate);
      if (!target) continue;
      return { entry, target };
    }
    const target = resolveTarget(entry.target, u, all);
    if (target) return { entry, target };
  }
  return { entry: DEFAULT_STRIKE, target: chooseTarget(u, all) };
}
