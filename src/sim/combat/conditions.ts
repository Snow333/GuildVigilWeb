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
  /**
   * THE SPELL-BUFF QUARTET (brief #25). `{bonus, to}` is the second-largest
   * authored buff shape (13 rows) and it needs a place to LAND: a timed numeric
   * modifier keyed by what it modifies.
   *
   * ⚠ THESE ARE NEW IDS, NOT REUSES, AND THAT IS DELIBERATE. `defending`
   * already carries a numeric AC bonus and `blessed` already carries +1 attack,
   * so Mage Armor could have ridden `defending`. It must not: values stack
   * KEEP-HIGHEST per id, so folding a spell into a feat's condition would let
   * Defensive Ward silently swallow Mage Armor (and vice versa), and the
   * after-action log would say "Defensive Ward" for a wizard spell. One id per
   * authored source keeps both the stacking and the read-out honest.
   *
   *   warded      → acMod       (`to: 'ac'`)            Shield, Mage Armor
   *   emboldened  → attackMod   (`to: 'attack'`)        Bless
   *   steeled     → saveMod     (`to: 'saves'`)         Protection
   *   honed       → damageMod   (`to: 'weapon_damage'`) Magic Weapon
   *
   * ⚠ Every one of the four is VALUE-CARRYING, not a flag. `bonus` is authored
   * as 1, 2 or 4 across the rows, so a boolean would flatten Barkskin's +2 and
   * Seraphine's +4 into Shield's +1.
   */
  'warded', 'emboldened', 'steeled', 'honed',
  /**
   * ⚠ `immobilized` IS A MOVEMENT LOCK, NOT A SLOW, and it is the only new
   * CONDITION the debuff resolver needed. Three authored rows name it (Web,
   * Fenwick's Tangling Growth, Tanglefoot Bag) and the engine had no way to
   * say "rooted but still fighting" — `grabbed`/`restrained` both also strip
   * AC via `isFlatFootedByCondition`, which is a different and much harsher
   * spell. `canMove` is its consumer and its only one.
   */
  'immobilized',
] as const;

export type ConditionId = (typeof CONDITION_IDS)[number];

// ── CRUD (tracker semantics: keep-highest value, keep-longest duration) ─────

/**
 * Is this string a condition the engine actually models?
 *
 * ⚠ EXISTS BECAUSE AUTHORED CONTENT OUTRUNS THE ENGINE. Weapon riders name
 * conditions like `persistent_bleed` and `persistent_poison` that CONDITION_IDS
 * does not contain. A cast to ConditionId would apply a condition nothing reads
 * — silent dead content, the exact failure brief #24 is cleaning up. This makes
 * the gap checkable, and a content test lists what is still missing.
 */
export function isConditionId(id: string): id is ConditionId {
  return (CONDITION_IDS as readonly string[]).includes(id);
}

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
  // Brief #25: Bless's `{bonus:1, to:'attack'}` lands here. Value-carrying, so
  // a +2 row would be worth +2 without touching this line.
  mod += conditionValue(unit, 'emboldened');
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
  // Brief #25: Shield, Mage Armor, Barkskin, Armor of Shadows all land here.
  mod += conditionValue(unit, 'warded');
  return mod;
}

/**
 * SAVE BONUS FROM CONDITIONS (brief #25) — the fourth modifier query, added
 * because `{bonus:1, to:'saves'}` (Protection, Magic Circle, Heroism,
 * Seraphine's Divine Aegis) had nowhere to land.
 *
 * ⚠ There was NO save-modifier query at all before this. `rollSave` in
 * spells.ts read `target.saves.<type>` raw, so no condition in the game could
 * ever move a saving throw — the fifth instance of "the content carries the
 * concept and the sim never reads it" after `weapon_range`,
 * `class_weapon_proficiency`, stealth/perception and athletics.
 */
export const saveMod = (unit: Combatant): number => conditionValue(unit, 'steeled');

/**
 * Bonus melee damage from toggles (Rage +2) and buffs (Magic Weapon, brief
 * #25 — `{bonus:1, to:'weapon_damage'}`).
 */
export const damageMod = (unit: Combatant): number =>
  (hasCondition(unit, 'raging') ? 2 : 0) + conditionValue(unit, 'honed');

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
  !(
    hasCondition(unit, 'grabbed') || hasCondition(unit, 'restrained') ||
    hasCondition(unit, 'unconscious') ||
    // Brief #25: Web / Tangling Growth root a unit in place without stripping
    // its AC — the deliberate difference from `grabbed`/`restrained`.
    hasCondition(unit, 'immobilized')
  );

// ── Flat-footed & flanking (continuous space) ───────────────────────────────

export function isFlatFootedByCondition(unit: Combatant): boolean {
  return (
    hasCondition(unit, 'flat_footed') || hasCondition(unit, 'grabbed') ||
    hasCondition(unit, 'restrained') || hasCondition(unit, 'unconscious')
  );
}

/**
 * Brief #20: adjacency measures BODY TO BODY, so allies flank a Large target
 * from half a unit further out and a prone creature's attacker counts as
 * adjacent sooner.
 *
 * ⚠ Takes raw radii rather than Combatants because this serves TWO rules from
 * two different call shapes (flanking adjacency, and prone-vs-adjacent), so it
 * cannot use `gap()`. The `dist(a, b) > 0` term stays on CENTRES: it exists to
 * stop a unit flanking itself, and two overlapping bodies still have distinct
 * centres.
 */
const withinEngagement = (a: Vec2, b: Vec2, ra = 0, rb = 0): boolean => {
  const centres = dist(a, b);
  const surface = Math.max(0, centres - ra - rb);
  return centres > 0 && surface <= ENGAGEMENT_RANGE;
};

/**
 * Team-wide flanking: if ANY two living allies of the attacker's side are in
 * engagement range of the target on roughly opposite sides (direction vectors
 * dot < −0.5), the target is flanked for the WHOLE team. Dot-product rule
 * ported unchanged from grid space to continuous positions.
 */
export function isFlanked(target: Combatant, attacker: Combatant, all: readonly Combatant[]): boolean {
  const adjacentAllies = all.filter(
    (u) => u.side === attacker.side && u.hp > 0 && withinEngagement(u.pos, target.pos, u.radius, target.radius),
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
  if (hasCondition(target, 'prone') && withinEngagement(attacker.pos, target.pos, attacker.radius, target.radius)) return true;
  return isFlanked(target, attacker, all);
}
