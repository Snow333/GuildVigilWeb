/**
 * Condition system — ported from condition_defs.gd / condition_tracker.gd /
 * condition_modifiers.gd. Values stack keep-highest; durations are ticks
 * (the rounds→seconds translation, decision-ledger Area 2).
 * Flanking's dot-product rule ports to continuous positions unchanged.
 */

import { ENGAGEMENT_RANGE, FLANK_DOT_THRESHOLD } from '@content/combat';
import { dist, type Combatant, type Vec2 } from './types';

export const CONDITION_IDS = [
  'dying', 'unconscious', 'wounded', 'frightened', 'sickened', 'slowed', 'stunned',
  'prone', 'flat_footed', 'grabbed', 'restrained', 'blinded', 'hasted', 'blessed',
  'heroism', 'defending', 'persistent_damage', 'paralyzed',
  'raging', 'fatigued', 'tiger_stance', 'crane_stance', 'mountain_stance',
] as const;

export type ConditionId = (typeof CONDITION_IDS)[number];

// ── CRUD (tracker semantics: keep-highest value, keep-longest duration) ─────

export function applyCondition(unit: Combatant, id: ConditionId, value = 1, expiresAtTick: number | null = null): void {
  const existing = unit.conditions.get(id);
  if (!existing) {
    unit.conditions.set(id, { value, expiresAtTick });
    return;
  }
  existing.value = Math.max(existing.value, value);
  if (expiresAtTick === null || existing.expiresAtTick === null) existing.expiresAtTick = null;
  else existing.expiresAtTick = Math.max(existing.expiresAtTick, expiresAtTick);
}

export function setConditionValue(unit: Combatant, id: ConditionId, value: number): void {
  const existing = unit.conditions.get(id);
  if (existing) existing.value = value;
  else unit.conditions.set(id, { value, expiresAtTick: null });
}

export const removeCondition = (unit: Combatant, id: ConditionId): void => void unit.conditions.delete(id);
export const hasCondition = (unit: Combatant, id: ConditionId): boolean => unit.conditions.has(id);
export const conditionValue = (unit: Combatant, id: ConditionId): number => unit.conditions.get(id)?.value ?? 0;

/** Expire timed conditions; returns the ids that lapsed (for condition_expired events). */
export function expireConditions(unit: Combatant, nowTick: number): ConditionId[] {
  const expired: ConditionId[] = [];
  for (const [id, c] of unit.conditions) {
    if (c.expiresAtTick !== null && nowTick >= c.expiresAtTick) {
      unit.conditions.delete(id);
      expired.push(id as ConditionId);
    }
  }
  return expired;
}

// ── Modifier queries (ported verbatim from condition_modifiers.gd) ──────────

export function attackMod(unit: Combatant): number {
  let mod = 0;
  mod -= conditionValue(unit, 'frightened');
  mod -= conditionValue(unit, 'sickened');
  if (hasCondition(unit, 'prone')) mod -= 2;
  if (hasCondition(unit, 'restrained')) mod -= 2;
  if (hasCondition(unit, 'blinded')) mod -= 2;
  if (hasCondition(unit, 'blessed')) mod += 1;
  if (hasCondition(unit, 'heroism')) mod += 1;
  if (hasCondition(unit, 'fatigued')) mod -= 1;
  return mod;
}

export function acMod(unit: Combatant): number {
  let mod = 0;
  if (isFlatFootedByCondition(unit)) mod -= 2;
  if (hasCondition(unit, 'unconscious')) mod -= 4;
  mod -= conditionValue(unit, 'frightened');
  if (hasCondition(unit, 'heroism')) mod += 1;
  if (hasCondition(unit, 'defending')) mod += conditionValue(unit, 'defending');
  if (hasCondition(unit, 'raging')) mod -= 1;
  if (hasCondition(unit, 'fatigued')) mod -= 1;
  if (hasCondition(unit, 'crane_stance')) mod += 1;
  if (hasCondition(unit, 'mountain_stance')) mod += 2;
  return mod;
}

/** Bonus melee damage from toggles (Rage +2). */
export const damageMod = (unit: Combatant): number => (hasCondition(unit, 'raging') ? 2 : 0);

/** Raging blocks concentrate actions. */
export const canCastSpells = (unit: Combatant): boolean => !hasCondition(unit, 'raging');

/** Stance-modified unarmed strikes, or null. */
export function unarmedOverride(unit: Combatant): { dice: string; type: string } | null {
  if (hasCondition(unit, 'tiger_stance')) return { dice: '1d8', type: 'slashing' };
  if (hasCondition(unit, 'crane_stance')) return { dice: '1d6', type: 'bludgeoning' };
  if (hasCondition(unit, 'mountain_stance')) return { dice: '1d8', type: 'bludgeoning' };
  return null;
}

export const speedMod = (unit: Combatant): number => (hasCondition(unit, 'mountain_stance') ? -1 : 0);

export const canMove = (unit: Combatant): boolean =>
  !(hasCondition(unit, 'grabbed') || hasCondition(unit, 'restrained') || hasCondition(unit, 'unconscious'));

// ── Flat-footed & flanking (continuous space) ───────────────────────────────

export function isFlatFootedByCondition(unit: Combatant): boolean {
  return (
    hasCondition(unit, 'flat_footed') || hasCondition(unit, 'grabbed') ||
    hasCondition(unit, 'restrained') || hasCondition(unit, 'unconscious')
  );
}

const withinEngagement = (a: Vec2, b: Vec2): boolean => {
  const d = dist(a, b);
  return d > 0 && d <= ENGAGEMENT_RANGE;
};

/**
 * Team-wide flanking: if ANY two living allies of the attacker's side are in
 * engagement range of the target on roughly opposite sides (direction vectors
 * dot < −0.5), the target is flanked for the WHOLE team. Dot-product rule
 * ported unchanged from grid space to continuous positions.
 */
export function isFlanked(target: Combatant, attacker: Combatant, all: readonly Combatant[]): boolean {
  const adjacentAllies = all.filter(
    (u) => u.side === attacker.side && u.hp > 0 && withinEngagement(u.pos, target.pos),
  );
  for (let i = 0; i < adjacentAllies.length; i++) {
    for (let j = i + 1; j < adjacentAllies.length; j++) {
      const a = adjacentAllies[i]!.pos;
      const b = adjacentAllies[j]!.pos;
      const va = { x: a.x - target.pos.x, y: a.y - target.pos.y };
      const vb = { x: b.x - target.pos.x, y: b.y - target.pos.y };
      const la = Math.hypot(va.x, va.y);
      const lb = Math.hypot(vb.x, vb.y);
      if (la > 0 && lb > 0 && (va.x * vb.x + va.y * vb.y) / (la * lb) < FLANK_DOT_THRESHOLD) {
        return true;
      }
    }
  }
  return false;
}

/** Full flat-footed check: conditions, prone-vs-adjacent-attacker, flanking. */
export function isFlatFooted(target: Combatant, attacker: Combatant, all: readonly Combatant[]): boolean {
  if (isFlatFootedByCondition(target)) return true;
  if (hasCondition(target, 'prone') && withinEngagement(attacker.pos, target.pos)) return true;
  return isFlanked(target, attacker, all);
}
