/**
 * SPELL PLAN (M2) — the caster's spell page on the character sheet.
 *
 * One pure module answers: which spells can this hero use, which are in the
 * fight plan ("prepared"), how many may be, and in what order are they tried.
 * The fight plan IS the loadout: a spell is "prepared" when the loadout holds a
 * `cast` entry for it. Nothing here is a second copy of that state.
 *
 * PREPARED CASTERS (Cleric, Wizard, …) may plan at most one distinct spell per
 * slot of that spell level — a cleric with two 1st-level slots prepares two
 * 1st-level spells, like PF2E. Spontaneous casters and the Warlock plan any
 * spell they know: their limit is the repertoire they learned.
 */

import { classesById, spellsById } from '@sim/registry';
import { progressionFor } from '@sim/registry';
import type { LoadoutCondition, LoadoutEntry, LoadoutTargetSpec } from '@sim/combat/loadout';
import { spellConditionIds } from '@sim/combat/spells';
import { castableSpells, grantedListSpells, isPreparedCaster, spellAccess, type SpellAccess } from './knownSpells';
import { withLearnedSpells } from './autoLoadout';
import type { HeroState } from './types';

export interface PlanSpell {
  spellId: number;
  name: string;
  spellLevel: number;
  effectType: string;
  description: string;
  inPlan: boolean;
}

export interface PlanLevel {
  spellLevel: number;
  /** Max distinct spells of this level in the plan; null = no limit. */
  limit: number | null;
  planned: number;
  spells: PlanSpell[];
}

export interface PlanRule {
  /** Index into the hero's loadout. */
  loadoutIndex: number;
  spellId: number;
  name: string;
  spellLevel: number;
  effectType: string;
  condition: LoadoutCondition;
  target: LoadoutTargetSpec;
}

export interface SpellPlan {
  classId: number;
  className: string;
  access: SpellAccess;
  prepared: boolean;
  levels: PlanLevel[];
  /** The plan's spells in the order the hero tries them (top first). */
  priority: PlanRule[];
}

/** The class this hero casts with: its highest-level spellcasting class. */
export function castingClass(hero: HeroState): { classId: number; level: number } | null {
  let best: { classId: number; level: number } | null = null;
  for (const cl of hero.classLevels) {
    if (spellAccess(cl.classId) === 'none') continue;
    if (!best || cl.level > best.level) best = { classId: cl.classId, level: cl.level };
  }
  return best;
}

const spellLevelOf = (id: number): number => (spellsById.get(id)?.spell_level as number | null) ?? 0;
const effectOf = (id: number): string => (spellsById.get(id)?.effect_type as string | null) ?? '';

/** Slots per spell level (index = spell level) for a prepared caster; null otherwise. */
export function preparedLimits(classId: number, classLevel: number): number[] | null {
  if (!isPreparedCaster(classId)) return null;
  const prog = progressionFor(classId, classLevel) as Record<string, unknown> | undefined;
  const out: number[] = [];
  for (let lvl = 0; lvl <= 9; lvl++) out.push((prog?.[`spell_slots_${lvl}`] as number | null) ?? 0);
  return out;
}

const plannedIds = (loadout: readonly LoadoutEntry[]): Set<number> =>
  new Set(loadout.filter((e): e is Extract<LoadoutEntry, { action: 'cast' }> => e.action === 'cast').map((e) => e.spellId));

export function buildSpellPlan(hero: HeroState, loadout: readonly LoadoutEntry[]): SpellPlan | null {
  const cc = castingClass(hero);
  if (!cc) return null;
  const limits = preparedLimits(cc.classId, cc.level);
  const planned = plannedIds(loadout);
  const usable = castableSpells(hero);

  const byLevel = new Map<number, PlanSpell[]>();
  for (const id of usable) {
    const row = spellsById.get(id)!;
    const lvl = spellLevelOf(id);
    const list = byLevel.get(lvl) ?? [];
    list.push({
      spellId: id,
      name: row.name as string,
      spellLevel: lvl,
      effectType: effectOf(id),
      description: (row.description as string | null) ?? '',
      inPlan: planned.has(id),
    });
    byLevel.set(lvl, list);
  }
  const levels: PlanLevel[] = [...byLevel.keys()].sort((a, b) => a - b).map((lvl) => {
    const spells = byLevel.get(lvl)!;
    return { spellLevel: lvl, limit: limits ? limits[lvl] ?? 0 : null, planned: spells.filter((s) => s.inPlan).length, spells };
  });

  const priority: PlanRule[] = [];
  loadout.forEach((e, i) => {
    if (e.action !== 'cast') return;
    priority.push({
      loadoutIndex: i,
      spellId: e.spellId,
      name: (spellsById.get(e.spellId)?.name as string) ?? `Spell ${e.spellId}`,
      spellLevel: spellLevelOf(e.spellId),
      effectType: effectOf(e.spellId),
      condition: e.condition,
      target: e.target,
    });
  });

  return {
    classId: cc.classId,
    className: (classesById.get(cc.classId)?.name as string) ?? 'Caster',
    access: spellAccess(cc.classId),
    prepared: limits !== null,
    levels,
    priority,
  };
}

/**
 * Validate a candidate loadout's prepared counts. Returns an error sentence, or
 * null when it is within the limits. Non-prepared casters always pass.
 */
export function preparedViolation(hero: HeroState, loadout: readonly LoadoutEntry[]): string | null {
  const cc = castingClass(hero);
  if (!cc) return null;
  const limits = preparedLimits(cc.classId, cc.level);
  if (!limits) return null;
  const counts = new Map<number, number>();
  for (const id of plannedIds(loadout)) counts.set(spellLevelOf(id), (counts.get(spellLevelOf(id)) ?? 0) + 1);
  for (const [lvl, n] of counts) {
    if (n > (limits[lvl] ?? 0)) return `only ${limits[lvl] ?? 0} level-${lvl} spell(s) can be prepared, got ${n}`;
  }
  return null;
}

/** The entry a spell gets when the player adds it by hand. Debuffs are allowed here. */
export function defaultEntryFor(spellId: number): LoadoutEntry {
  const effect = effectOf(spellId);
  if (effect === 'healing') return { action: 'cast', spellId, condition: { kind: 'allyHpBelow', pct: 0.4 }, target: 'lowestAlly' };
  if (effect === 'buff') {
    const marker = spellConditionIds(spellsById.get(spellId)!)[0];
    return marker
      ? { action: 'cast', spellId, condition: { kind: 'notActive', conditionId: marker }, target: 'self' }
      : { action: 'cast', spellId, condition: { kind: 'always' }, target: 'self' };
  }
  return { action: 'cast', spellId, condition: { kind: 'always' }, target: 'scoredEnemy' };
}

/** Add or remove a spell from the plan. Throws when a prepared level is full. */
export function togglePlanned(hero: HeroState, loadout: readonly LoadoutEntry[], spellId: number): LoadoutEntry[] {
  if (!castableSpells(hero).includes(spellId)) throw new Error(`togglePlanned: spell ${spellId} is not usable by this hero`);
  if (plannedIds(loadout).has(spellId)) {
    return loadout.filter((e) => !(e.action === 'cast' && e.spellId === spellId));
  }
  let next = withLearnedSpells(loadout, [spellId]);
  if (next.length === loadout.length) {
    // withLearnedSpells skips debuffs (no safe automatic rule); a player choice is fine.
    next = [...loadout];
    const firstCantrip = next.findIndex((e) => e.action === 'cast' && spellLevelOf(e.spellId) === 0);
    next.splice(firstCantrip < 0 ? next.length : firstCantrip, 0, defaultEntryFor(spellId));
  }
  const bad = preparedViolation(hero, next);
  if (bad) throw new Error(`togglePlanned: ${bad}`);
  return next;
}

/** Move a spell up/down among the plan's spells; other entries keep their places. */
export function moveSpellRule(loadout: readonly LoadoutEntry[], loadoutIndex: number, dir: -1 | 1): LoadoutEntry[] {
  const castIdx = loadout.map((e, i) => (e.action === 'cast' ? i : -1)).filter((i) => i >= 0);
  const at = castIdx.indexOf(loadoutIndex);
  const other = castIdx[at + dir];
  if (at < 0 || other === undefined) return [...loadout];
  const next = [...loadout];
  [next[loadoutIndex], next[other]] = [next[other]!, next[loadoutIndex]!];
  return next;
}

/** Change WHEN and AT WHOM one planned spell is cast. */
export function setSpellRule(
  loadout: readonly LoadoutEntry[],
  loadoutIndex: number,
  condition: LoadoutCondition,
  target: LoadoutTargetSpec,
): LoadoutEntry[] {
  const e = loadout[loadoutIndex];
  if (!e || e.action !== 'cast') throw new Error(`setSpellRule: entry ${loadoutIndex} is not a spell`);
  const next = [...loadout];
  next[loadoutIndex] = { ...e, condition, target };
  return next;
}

/**
 * After a level-up: add candidate spells to the plan in order, while the
 * prepared limit for their level has room. Used for both a Wizard's newly
 * learned spells and a Cleric's newly granted ones.
 */
export function addWhileRoom(hero: HeroState, loadout: readonly LoadoutEntry[], candidates: readonly number[]): LoadoutEntry[] {
  let next = [...loadout];
  for (const id of candidates) {
    if (plannedIds(next).has(id)) continue;
    const trial = withLearnedSpells(next, [id]);
    if (trial.length === next.length) continue; // debuffs etc.: no automatic rule
    if (preparedViolation(hero, trial)) continue;
    next = trial;
  }
  return next;
}

/** Spells a divine-list caster gains between two class levels, best first (heals, then damage, then buffs). */
export function newlyGranted(classId: number, fromLevel: number, toLevel: number): number[] {
  const before = new Set(grantedListSpells(classId, fromLevel));
  const pref: Record<string, number> = { healing: 0, damage: 1, buff: 2 };
  return grantedListSpells(classId, toLevel)
    .filter((id) => !before.has(id) && effectOf(id) in pref)
    .sort((a, b) => spellLevelOf(b) - spellLevelOf(a) || pref[effectOf(a)]! - pref[effectOf(b)]! || a - b);
}
