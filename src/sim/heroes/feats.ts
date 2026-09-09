/**
 * Feat SELECTION — the level-up picker's data layer (brief #22 M1).
 *
 * The four `feat_slot_class / _general / _ancestry / _skill` columns are
 * authored on all 460 `class_progression` rows and, until this module, NOTHING
 * in `src/` read them: the level-up wizard sent `feats: []` on every commit.
 * This module turns that authored schedule into offers.
 *
 * Two things live here and nowhere else:
 *
 *  1. THE SLOT SCHEDULE — how many picks of each kind a level grants.
 *  2. ELIGIBILITY — level, prerequisites, duplication, and the §2 readiness
 *     gate, expressed as a {selectable, reason} pair so the UI's grey label and
 *     the commit-time guard come from ONE call. Never two code paths.
 *
 * `applyLevelUp` already accepts `feats` and applies them atomically, so this
 * module adds no mutation: it is a selector over content plus hero state.
 */

import { feats } from '@content/generated';
import { progressionFor } from '@sim/registry';
import { featEffectsById, isEffectReady, type UnreadyReason } from './featEffects';
import { characterLevel, type HeroFeat, type HeroState } from './types';

export type FeatSlotKind = 'class' | 'general' | 'ancestry' | 'skill';

export const FEAT_SLOT_KINDS: readonly FeatSlotKind[] = ['class', 'general', 'ancestry', 'skill'];

type FeatRow = (typeof feats)[number];

export const featsById: Map<number, FeatRow> = new Map(feats.map((f) => [f.id, f]));

/**
 * ⚠ PREREQS NAME FEATS, AND TWO NAMES ARE AMBIGUOUS.
 *
 * All 27 prerequisite payloads are `{"feat": "<name>"}` (17) or
 * `{"skill_rank": {...}}` (10) — two shapes, no others, so this is a total
 * check and not an open-ended DSL. But the feat side keys on NAME while the
 * hero holds IDs, and **"Reach Spell" and "Undisrupted Casting" each exist
 * TWICE** (Wizard #99 / Sorcerer #114; Wizard #221 / Cleric #225). A bare
 * name->id map would let a Sorcerer's Reach Spell satisfy a Wizard's chain.
 *
 * So: name -> ALL ids bearing it, resolved once at load. "Any held id with
 * this name satisfies" is the rule, and class scoping falls out naturally
 * because a hero can only have taken the copy their own class offered.
 */
const featIdsByName: Map<string, number[]> = (() => {
  const m = new Map<string, number[]>();
  for (const f of feats) {
    const list = m.get(f.name);
    if (list) list.push(f.id);
    else m.set(f.name, [f.id]);
  }
  return m;
})();

export interface SlotCounts {
  class: number;
  general: number;
  ancestry: number;
  skill: number;
}

export const NO_SLOTS: SlotCounts = { class: 0, general: 0, ancestry: 0, skill: 0 };

/**
 * Feat slots granted by reaching `classLevel` in `classId`. Read straight off
 * the authored row — the schedule is content, never a formula in code.
 *
 * ⚠ Fighter's class track is a PF1-style bonus-feat cadence (1 at odd levels,
 * 2 at even = 30 by L20) on top of everyone else's flat PF2E 10. It is
 * deliberate content, and it runs SHORT of authored feats from L16 (23 owned
 * against 30 slots). An unfillable slot is a UI state, not an error.
 */
export function slotsForLevel(classId: number, classLevel: number): SlotCounts {
  const prog = progressionFor(classId, classLevel);
  if (!prog) return { ...NO_SLOTS };
  return {
    class: (prog.feat_slot_class as number | null) ?? 0,
    general: (prog.feat_slot_general as number | null) ?? 0,
    ancestry: (prog.feat_slot_ancestry as number | null) ?? 0,
    skill: (prog.feat_slot_skill as number | null) ?? 0,
  };
}

/** Does this feat belong in a slot of this kind, for a hero of this class? */
function matchesSlot(row: FeatRow, kind: FeatSlotKind, classId: number): boolean {
  const featClass = row.class_id as number | null;
  switch (kind) {
    case 'class':
      return featClass === classId;
    case 'general':
      return featClass === null && row.feat_type === 'general';
    case 'skill':
      return featClass === null && row.feat_type === 'skill';
    case 'ancestry':
      // ⚠ ZERO rows carry an ancestry_id — the schedule grants 5 ancestry slots
      // per career against an EMPTY pool. Brief #22 D1: show the track greyed
      // as visible future content rather than suppressing it, so the hole is
      // legible instead of silently absent.
      return (row.ancestry_id as number | null) !== null;
  }
}

export interface PrereqResult {
  met: boolean;
  /** Player-facing reason, empty when met. Composed by the UI, not here. */
  reason: string;
}

/** Prerequisite check — the two authored shapes, and nothing else. */
export function checkFeatPrereqs(hero: HeroState, featId: number, heroFeats: readonly HeroFeat[]): PrereqResult {
  const row = featsById.get(featId);
  if (!row) return { met: false, reason: 'Unknown feat' };

  const raw = row.prerequisites as string | null;
  if (!raw || raw === '' || raw === '{}' || raw === '[]') return { met: true, reason: '' };

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    // Content integrity is a build gate elsewhere (featEffects throws on bad
    // effects); a bad prereq must never silently GRANT a feat.
    return { met: false, reason: 'Malformed prerequisite' };
  }

  const requiredFeat = parsed['feat'] as string | undefined;
  if (requiredFeat) {
    const candidates = featIdsByName.get(requiredFeat) ?? [];
    const held = heroFeats.some((hf) => candidates.includes(hf.featId));
    if (!held) return { met: false, reason: `Requires ${requiredFeat}` };
  }

  const skillReq = parsed['skill_rank'] as Record<string, unknown> | undefined;
  if (skillReq) {
    for (const [skill, needed] of Object.entries(skillReq)) {
      const need = typeof needed === 'number' ? needed : Number(needed);
      if (!Number.isFinite(need)) continue;
      if ((hero.skills[skill] ?? 0) < need) {
        return { met: false, reason: `Requires ${skill} rank ${need}` };
      }
    }
  }

  return { met: true, reason: '' };
}

export interface FeatOffer {
  featId: number;
  name: string;
  featType: string;
  levelReq: number;
  description: string;
  /** May this be picked right now? */
  selectable: boolean;
  /** Set iff !selectable — drives the FROZEN grey-label set. */
  reason?: UnreadyReason;
  /** Human detail for `prereq_unmet` ("Requires Knockdown"). */
  detail?: string;
}

/**
 * Every feat that could fill a slot of `kind`, each marked selectable or not.
 *
 * ⚠ RETURNS UNSELECTABLE ROWS ON PURPOSE (brief #22 D1/§2.1). Steven's
 * decision is that dead content stays VISIBLE as future content, greyed with a
 * reason, rather than being filtered out — the same treatment the spell picker
 * gives its 140 inert rows. A caller that wants only the takeable ones filters
 * on `.selectable`; the UI does not.
 */
export function offersForSlot(
  hero: HeroState,
  classId: number,
  kind: FeatSlotKind,
  heroFeats: readonly HeroFeat[] = hero.feats,
): FeatOffer[] {
  const charLevel = characterLevel(hero);
  const classLevel = hero.classLevels.find((c) => c.classId === classId)?.level ?? 0;
  const out: FeatOffer[] = [];

  for (const row of feats) {
    if (!matchesSlot(row, kind, classId)) continue;

    // Class feats gate on the GRANTING class's level; general/skill feats gate
    // on character level. A 2/3 multiclass must not be offered a level-5 class
    // feat because its character level happens to reach it.
    const gateLevel = kind === 'class' ? classLevel : charLevel;
    const levelReq = (row.level_req as number | null) ?? 1;

    const offer: FeatOffer = {
      featId: row.id,
      name: row.name,
      featType: row.feat_type as string,
      levelReq,
      description: (row.description as string | null) ?? '',
      selectable: true,
    };

    // Order matters: the FIRST failing gate is the reason shown. Level before
    // prereqs reads better ("Requires level 8" beats "Requires Knockdown" when
    // both are true and the level is the real blocker).
    if (heroFeats.some((hf) => hf.featId === row.id)) {
      offer.selectable = false;
      offer.reason = 'already_taken';
    } else if (levelReq > gateLevel) {
      offer.selectable = false;
      offer.reason = 'level_unmet';
      offer.detail = `Requires level ${levelReq}`;
    } else if (!isEffectReady(row.id)) {
      offer.selectable = false;
      offer.reason = 'not_yet_implemented';
    } else {
      const prereq = checkFeatPrereqs(hero, row.id, heroFeats);
      if (!prereq.met) {
        offer.selectable = false;
        offer.reason = 'prereq_unmet';
        offer.detail = prereq.reason;
      }
    }

    out.push(offer);
  }

  // Stable order: level, then id. Never registry order — content growth would
  // reshuffle the player's menu.
  out.sort((a, b) => a.levelReq - b.levelReq || a.featId - b.featId);
  return out;
}

/** Convenience: only the feats that may actually be taken right now. */
export function eligibleFeats(
  hero: HeroState,
  classId: number,
  kind: FeatSlotKind,
  heroFeats: readonly HeroFeat[] = hero.feats,
): FeatOffer[] {
  return offersForSlot(hero, classId, kind, heroFeats).filter((o) => o.selectable);
}

/**
 * Feats auto-granted by reaching this class level — the `features` JSON keys
 * that have a matching `feats.feature_key` row.
 *
 * ⚠ ONLY TWO OF 47 FEATURE KEYS RESOLVE for the founding four
 * (`attack_of_opportunity` -> Reactive Strike, `sneak_attack_1d6` -> Sneak
 * Attack). The other 45 (`bravery`, `evasion`, `weapon_training_1..4`,
 * `channel_energy`, `domain`, ...) name features NOTHING defines, and defining
 * them is a separate brief (#22 §8). This function is deliberately narrow: it
 * grants what exists and silently ignores what does not, because an unknown
 * feature key is authored content awaiting an implementation, not an error.
 */
const featIdByFeatureKey: Map<string, number> = (() => {
  const m = new Map<string, number>();
  for (const f of feats) {
    const key = f.feature_key as string | null;
    if (key && !m.has(key)) m.set(key, f.id);
  }
  return m;
})();

export function autoGrantsForLevel(classId: number, classLevel: number): number[] {
  const prog = progressionFor(classId, classLevel);
  if (!prog) return [];
  let keys: string[];
  try {
    keys = JSON.parse((prog.features as string | null) ?? '[]') as string[];
  } catch {
    return [];
  }
  const out: number[] = [];
  for (const key of keys) {
    const id = featIdByFeatureKey.get(key);
    if (id !== undefined && !out.includes(id)) out.push(id);
  }
  return out;
}

/** The combat-active feats a hero holds (loadout editor's "add ability" pool). */
export function activeFeats(heroFeats: readonly HeroFeat[]): number[] {
  return heroFeats
    .filter((hf) => {
      const fx = featEffectsById.get(hf.featId);
      return fx?.effectType === 'combat_action' && isEffectReady(hf.featId);
    })
    .map((hf) => hf.featId);
}
