/**
 * The loadout-priority layer — core-loop D4 made executable: "known pool →
 * ordered active loadout; the AI plays down the priority list." The vocabulary
 * is deliberately gambit-lite (teardown §4.1: seventeen enum members produce
 * the entire tactical game). Ordering IS the strategy.
 */

import { spellsById, warlockCostByLevel } from '@sim/registry';
import { abilityDef, abilityReady, type AbilityDef } from './abilities';
import { chooseTarget, gap } from './ai';
import type { Combatant } from './types';

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
  | { action: 'toggle'; featId: number; condition: LoadoutCondition }
  /**
   * THE FOURTH VERB (brief #22 M2). `combat_action` feats — Power Attack,
   * Knockdown, Determination — were classified by the registry and expressible
   * NOWHERE, so a fighter's entire active kit was unreachable. Shaped like
   * `cast` on purpose: both are "do a specific thing to a target if you can
   * afford it", and `pickAction` treats affordability identically.
   */
  | { action: 'ability'; featId: number; condition: LoadoutCondition; target: LoadoutTargetSpec };

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
      return all.some((e) => e.side !== u.side && e.hp > 0 && gap(u, e) <= c.range);
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
        // Brief #20: "nearest" means nearest BODY, so a giant standing on
        // you outranks a kobold whose centre happens to be marginally closer.
        const da = gap(u, a);
        const db = gap(u, b);
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
 *
 * ⚠ `tick` is required by the ability branch (cooldown + once-per-combat
 * limiters read it) and defaults to 0 so every existing caller and test keeps
 * working: at tick 0 nothing is on cooldown and nothing has been used, so a
 * loadout with no `ability` entries behaves exactly as before.
 */
export function pickAction(u: Combatant, all: readonly Combatant[], tick = 0): ResolvedAction {
  for (const entry of u.loadout) {
    if (!conditionMet(entry.condition, u, all)) continue;
    if (entry.action === 'toggle') return { entry, target: null };
    if (entry.action === 'ability') {
      // Same shape as `cast`: affordability first, then a resolvable target.
      // An ability on cooldown or spent for the fight is SKIPPED, not blocking
      // — the walk continues to the next entry, so a fighter whose Power
      // Attack is still recovering falls through to a plain strike rather than
      // standing still. That fall-through IS the design.
      if (!abilityReady(u, entry.featId, tick)) continue;
      const def = abilityDef(entry.featId);
      if (!def) continue;
      // Self-targeted abilities (Determination, Poison Weapon, Defensive Ward)
      // resolve without an enemy; only strike-riders need a victim.
      if (!def.isStrike) {
        if (!abilityWorthUsing(def, u, all)) continue;
        return { entry, target: entry.target === 'self' ? u : resolveTarget(entry.target, u, all) };
      }
      const target = resolveTarget(entry.target, u, all);
      if (!target) continue;
      return { entry, target };
    }
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

/**
 * Would this non-strike ability actually DO something right now?
 *
 * ⚠ Without this the AI burns its once-per-combat Determination on turn one
 * with no conditions to remove, and re-applies Poison Weapon over a rider it
 * already has. A `combat_action` that no-ops still costs the action, so
 * "can I?" and "should I?" are different questions and the loadout walk needs
 * both. This is the ability equivalent of `canAfford`.
 */
function abilityWorthUsing(def: AbilityDef, u: Combatant, all: readonly Combatant[]): boolean {
  switch (def.effect) {
    case 'remove_condition': {
      const removable = (def.raw['conditions_removable'] as string[] | undefined) ?? [];
      return removable.some((id) => u.conditions.has(id));
    }
    case 'apply_weapon_poison':
      return u.pendingPoisonDice === null;
    case 'grant_ally_ac':
      return all.some((a) => a.side === u.side && a.id !== u.id && a.hp > 0 && !a.conditions.has('defending'));
    default:
      return true;
  }
}
