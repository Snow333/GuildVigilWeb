/**
 * Spell resolution in combat — the data-driven caster layer over the converted
 * spells registry. Adds what the ledger demanded (Area 2 Change): AoE gets the
 * BASIC SAVE the Godot build never had (crit success none / success half /
 * fail full / crit fail double), friendly fire intact.
 *
 * Spell attacks never take flurry (ported rule). Scaling maps (cantrip curves)
 * resolve against caster level. Costs: slots by spell level, pact energy via
 * the hand-set warlock curve, cantrips free.
 */

import { ENGAGEMENT_RANGE } from '@content/combat';
import type { Rng } from '@sim/core/rng';
import type { RollBreakdown } from '@sim/core/events/types';
import { spellsById, warlockCostByLevel } from '@sim/registry';
import { averageDamage } from './ai';
import { determineDegree, rollDice } from './dice';
import { acMod, applyCondition, type ConditionId } from './conditions';
import { dist, type Combatant } from './types';

type SpellRow = NonNullable<ReturnType<typeof spellsById.get>>;

export interface SpellTargetResult {
  unit: Combatant;
  save?: RollBreakdown;
  attack?: RollBreakdown;
  damage: number;
  healing: number;
  conditionApplied?: { id: ConditionId; value: number; durationTicks: number };
}

export interface CastResult {
  spell: SpellRow;
  resource: 'slot' | 'pact' | 'atWill';
  cost: number;
  targets: SpellTargetResult[];
  /** True when this row's effect isn't executable yet (unknown buff shape). */
  inert: boolean;
}

/** Highest scaling entry ≤ casterLevel overrides base dice (cantrip curves). */
export function scaledDice(spell: SpellRow, casterLevel: number): string {
  const base = (spell.damage_dice as string | null) ?? '';
  const scalingRaw = spell.scaling as string | null;
  if (!scalingRaw || scalingRaw === '{}') return base;
  try {
    const map = JSON.parse(scalingRaw) as Record<string, string>;
    let best = base;
    let bestLevel = 0;
    for (const [lvl, dice] of Object.entries(map)) {
      const n = Number(lvl);
      if (n <= casterLevel && n > bestLevel) {
        best = dice;
        bestLevel = n;
      }
    }
    return best;
  } catch {
    return base;
  }
}

export function spellRange(spell: SpellRow): number {
  const rt = spell.range_type as string | null;
  if (rt === 'touch' || rt === 'self') return ENGAGEMENT_RANGE;
  return (spell.range_value as number | null) ?? ENGAGEMENT_RANGE;
}

/**
 * The default at-will attack for a caster on `spellList` (brief #15 §10–§11).
 *
 * Candidates are DERIVED — every damage cantrip the class's own spell list can
 * reach — so the rule stays self-maintaining as content grows. Among them,
 * content may DESIGNATE a preference via `default_cantrip`; where nothing is
 * marked, the best expected damage wins, ties broken by table order.
 *
 * That hybrid is what settles §11.2: "derived from the class spell list" and
 * "Electric Arc + Divine Lance" could not both be true under any single rule
 * (best-damage picks Telekinetic Projectile; lowest-id picks Electric Arc +
 * Produce Flame). Since §11.1 measured the choice as free — Electric Arc sits
 * within noise of a d6 cantrip everywhere, because a cantrip's value is that it
 * exists at range and never runs out, not its dice — designating on flavour
 * costs nothing and keeps the derivation.
 *
 * `spell_list` is comma-separated on both sides ('arcane,divine'), so this is a
 * set intersection, not a string compare.
 */
export function defaultCantripFor(spellList: string | null): SpellRow | null {
  if (!spellList) return null;
  const wanted = spellList.split(',').map((s) => s.trim()).filter(Boolean);
  if (wanted.length === 0) return null;

  let best: SpellRow | null = null;
  let bestScore = -Infinity;
  for (const spell of spellsById.values()) {
    if (((spell.spell_level as number | null) ?? 0) > 0) continue;
    if ((spell.effect_type as string | null) !== 'damage') continue;
    const dice = (spell.damage_dice as string | null) ?? '';
    if (dice === '' || dice === '0') continue;
    const on = ((spell.spell_list as string | null) ?? '').split(',').map((s) => s.trim());
    if (!wanted.some((w) => on.includes(w))) continue;

    // An authored designation outranks every unmarked candidate outright; the
    // damage term only orders the fallback.
    const designated = (spell.default_cantrip as number | null) === 1 ? 1000 : 0;
    const score = designated + averageDamage(dice);
    if (score > bestScore) {
      best = spell;
      bestScore = score;
    }
  }
  return best;
}

/** Spend the cost; caller must have verified affordability. */
export function spendCost(caster: Combatant, spell: SpellRow): { resource: CastResult['resource']; cost: number } {
  const level = (spell.spell_level as number | null) ?? 0;
  if (level <= 0 || !caster.casting) return { resource: 'atWill', cost: 0 };
  if (caster.casting.kind === 'pact') {
    const cost = warlockCostByLevel.get(level) ?? 0;
    caster.casting.pactEnergy -= cost;
    return { resource: 'pact', cost };
  }
  caster.casting.slots[level] = (caster.casting.slots[level] ?? 0) - 1;
  return { resource: 'slot', cost: 1 };
}

/** PF2E basic save: crit success 0× / success ½ / fail 1× / crit fail 2×. */
function basicSaveMultiplier(degree: RollBreakdown['degree']): number {
  if (degree === 'critSuccess') return 0;
  if (degree === 'success') return 0.5;
  if (degree === 'failure') return 1;
  return 2;
}

function rollSave(target: Combatant, saveType: string, dc: number, rng: Rng): RollBreakdown {
  const bonus =
    saveType === 'fort' ? target.saves.fort : saveType === 'will' ? target.saves.will : target.saves.ref;
  const d20 = rng.die(20);
  const { degree, natStep } = determineDegree(d20 + bonus, dc, d20);
  return { d20, modifier: bonus, total: d20 + bonus, dc, degree, natStep };
}

function aoeTargets(spell: SpellRow, center: Combatant, all: readonly Combatant[]): Combatant[] {
  const size = (spell.aoe_size as number | null) ?? 0;
  if (size <= 0) return [center];
  // Burst in continuous space; cones/lines resolve as bursts at the target
  // point for now (geometry refinement rides on the 1.4 room arenas).
  return all.filter(
    (u) => (u.hp > 0 || u.conditions.has('dying')) && dist(u.pos, center.pos) <= size,
  );
}

function parseCondition(spell: SpellRow): { id: ConditionId; value: number } | null {
  try {
    const fx = JSON.parse((spell.effects as string | null) ?? '{}') as Record<string, unknown>;
    if (typeof fx['condition'] === 'string') {
      return { id: fx['condition'] as ConditionId, value: (fx['value'] as number | undefined) ?? 1 };
    }
  } catch {
    /* inert */
  }
  return null;
}

function isAutoHit(spell: SpellRow): boolean {
  try {
    return Boolean((JSON.parse((spell.effects as string | null) ?? '{}') as Record<string, unknown>)['auto_hit']);
  } catch {
    return false;
  }
}

/**
 * Resolve a cast against a primary target. Costs are spent here; the caller
 * (encounter loop) applies damage/healing and emits events from the result.
 */
export function resolveCast(
  caster: Combatant,
  spellId: number,
  primary: Combatant,
  all: readonly Combatant[],
  nowTick: number,
  rng: Rng,
): CastResult {
  const spell = spellsById.get(spellId);
  if (!spell) throw new Error(`resolveCast: unknown spell ${spellId}`);
  const { resource, cost } = spendCost(caster, spell);
  const casterLevel = caster.casting?.casterLevel ?? caster.level;
  const dc = caster.casting?.dc ?? 12;
  const dice = scaledDice(spell, casterLevel);
  const effectType = spell.effect_type as string | null;
  const condition = parseCondition(spell);
  const result: CastResult = { spell, resource, cost, targets: [], inert: false };

  if (effectType === 'healing') {
    const amount = rollDice(rng, dice);
    result.targets.push({ unit: primary, damage: 0, healing: amount });
    return result;
  }

  if (effectType === 'damage') {
    const saveType = spell.save_type as string | null;
    const units = saveType && (spell.aoe_size as number | null) ? aoeTargets(spell, primary, all) : [primary];

    for (const unit of units) {
      const entry: SpellTargetResult = { unit, damage: 0, healing: 0 };
      if (isAutoHit(spell)) {
        entry.damage = rollDice(rng, dice); // Magic Missile: no roll, no save
      } else if (saveType) {
        const save = rollSave(unit, saveType, dc, rng);
        entry.save = save;
        entry.damage = Math.floor(rollDice(rng, dice) * basicSaveMultiplier(save.degree));
        if (condition && (save.degree === 'failure' || save.degree === 'critFailure')) {
          entry.conditionApplied = { ...condition, durationTicks: nowTick + 100 };
        }
      } else {
        // Spell attack roll vs AC — never takes flurry (ported rule).
        const d20 = rng.die(20);
        const attackBonus = caster.casting?.attackBonus ?? 4;
        const effectiveAc = unit.ac + acMod(unit);
        const { degree, natStep } = determineDegree(d20 + attackBonus, effectiveAc, d20);
        entry.attack = { d20, modifier: attackBonus, total: d20 + attackBonus, dc: effectiveAc, degree, natStep };
        if (degree === 'success' || degree === 'critSuccess') {
          entry.damage = Math.max(rollDice(rng, dice) * (degree === 'critSuccess' ? 2 : 1), 1);
          if (condition) entry.conditionApplied = { ...condition, durationTicks: nowTick + 100 };
        }
      }
      result.targets.push(entry);
    }
    return result;
  }

  // Buff/debuff rows with a parseable condition apply it to the primary target;
  // anything else is inert until its system lands (recorded, never a crash).
  if (condition) {
    result.targets.push({
      unit: primary, damage: 0, healing: 0,
      conditionApplied: { ...condition, durationTicks: nowTick + 600 },
    });
    return result;
  }
  result.inert = true;
  return result;
}

export function applyConditionFromCast(target: Combatant, c: NonNullable<SpellTargetResult['conditionApplied']>): void {
  applyCondition(target, c.id, c.value, c.durationTicks);
}
