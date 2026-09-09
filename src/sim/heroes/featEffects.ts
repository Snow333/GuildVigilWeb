/**
 * Feat-effects interpreter — registry-first rebuild (decision-ledger Area 1: Change).
 *
 * The Godot DSL outran its interpreter (~23 of 227 feats implemented). This module
 * inverts that: EVERY feat's effects payload is parsed and classified at load —
 * a payload that doesn't classify is a build error, not a silent no-op. What each
 * class of effect DOES is then owned by the right system:
 *
 *   resolved here (passive layer): stat_mod, skill_mod
 *   consumed by combat (1.3):      combat_action, reaction, stance, toggle,
 *                                  conditional_stat_mod, weapon_spec,
 *                                  spell_modifier, passive_modifier
 *   consumed by campaign/prep:     resource_grant, special
 *
 * Passive resolution semantics ported from scripts/feat_effect_resolver.gd, with
 * two documented completions the old code lacked:
 *   1. stat_mod `additional` payloads now apply (e.g. Spell Penetration's +1 DC).
 *   2. additional_skill_mod conditions are RETAINED on the parsed form (the old
 *      code applied them unconditionally and dropped the condition string).
 *      Application stays unconditional here — contextual gating is combat-side.
 */

import { feats } from '@content/generated';
import { characterLevel, type HeroState } from './types';

export type FeatEffectType =
  | 'stat_mod' | 'skill_mod'
  | 'passive_modifier' | 'combat_action' | 'reaction' | 'stance' | 'toggle'
  | 'conditional_stat_mod' | 'weapon_spec' | 'spell_modifier'
  | 'resource_grant' | 'special';

export type EffectDomain = 'passive' | 'combat' | 'campaign';

export const EFFECT_DOMAIN: Record<FeatEffectType, EffectDomain> = {
  stat_mod: 'passive',
  skill_mod: 'passive',
  passive_modifier: 'combat',
  combat_action: 'combat',
  reaction: 'combat',
  stance: 'combat',
  toggle: 'combat',
  conditional_stat_mod: 'combat',
  weapon_spec: 'combat',
  spell_modifier: 'combat',
  resource_grant: 'campaign',
  special: 'campaign',
};

/**
 * ⚠ THE READINESS GATE (brief #22 §2) — WHY THIS IS NOT `implemented: false`.
 *
 * 115 of 227 feats carry `"implemented": false` in their effects payload. That
 * flag was measured against the engine and it is SOUND IN ONE DIRECTION ONLY:
 *
 *   flag says unimplemented -> engine really doesn't use it   ✔ 0 contradictions
 *   flag is absent          -> engine implements it           ✘ 42 counter-examples
 *
 * The 42 are every `combat_action` (before #22 there was no verb at all),
 * plus all `resource_grant`, `special`, `spell_modifier`, `stance`, `toggle`
 * and `conditional_stat_mod` rows. Power Attack, Rage and the three Monk
 * stances all read "ready" and all did nothing.
 *
 * The flag means "the CONTENT SPEC is complete", not "the ENGINE does this".
 * Only the second question may grey out a picker row, so readiness is a
 * CONJUNCTION computed here — never a bare column read.
 *
 * `EFFECT_HAS_CONSUMER` is the engine half, and it is a LIAR-IN-WAITING: a
 * future brief that flips a bit before wiring the domain would silently
 * un-grey a menu of dead feats while every harness stayed green. That is the
 * exact failure mode brief #20 caught with its exposure test, so
 * `tests/heroes/readiness.test.ts` asserts every `true` entry has a feat that
 * demonstrably moves a resolver. Flip a bit without wiring it and that fails.
 */
export const EFFECT_HAS_CONSUMER: Record<FeatEffectType, boolean> = {
  stat_mod: true, // resolveStatMods, here
  skill_mod: true, // resolveSkillMods, here
  passive_modifier: true, // assembly (sneak dice), strike.ts, conditions.ts
  reaction: true, // assembly.reactionIds -> encounter reaction hooks
  weapon_spec: true, // assembly.weaponSpecBonus -> strike.ts
  combat_action: true, // brief #22 M2 — the 'ability' loadout verb
  toggle: true, // encounter.executeToggle (Rage)
  stance: true, // encounter.executeToggle (the Monk stances)
  conditional_stat_mod: false, // no consumer: Reckless Abandon is inert
  spell_modifier: false, // no consumer: Reach/Widen Spell are inert
  resource_grant: false, // no consumer: campaign/prep layer doesn't exist
  special: false, // no consumer: campaign layer
};

/**
 * `combat_action` is `true` above, but only NINE rows are actually wired (the
 * unflagged actives for the founding four — brief #22 §4.3). Per-type
 * readiness is therefore necessary but not sufficient for that one type, and
 * `ACTIVE_WIRED` is the row-level allow-list. Kept beside the map it refines
 * so the two cannot drift apart unnoticed.
 */
export const ACTIVE_WIRED: ReadonlySet<number> = new Set([
  1, // Power Attack        (Fighter L1)  strike_with_bonus
  4, // Intimidating Strike (Fighter L2)  strike_plus_condition
  9, // Brutish Shove       (Fighter L2)  strike_plus_shove
  5, // Knockdown           (Fighter L4)  strike_plus_trip
  7, // Improved Knockdown  (Fighter L8)  strike_plus_trip, no MAP
  8, // Determination       (Fighter L10) remove_condition, once per combat
  135, // Channel Smite      (Cleric L2)   strike_plus_channel
  138, // Defensive Ward     (Cleric L6)   grant_ally_ac
  71, // Poison Weapon       (Rogue L2)    apply_weapon_poison
]);

/** Why a feat cannot be selected. FROZEN set — the UI label-pairs each one. */
export type UnreadyReason = 'not_yet_implemented' | 'prereq_unmet' | 'already_taken' | 'level_unmet';

/**
 * Is this feat's effect something the ENGINE can act on today? Content-spec
 * completeness AND an engine consumer AND (for actives) a wired row.
 * Selection eligibility adds prereqs/level/duplication on top — see `feats.ts`.
 */
export function isEffectReady(featId: number): boolean {
  const fx = featEffectsById.get(featId);
  if (!fx) return false;
  if (fx.raw['implemented'] === false) return false;
  if (!EFFECT_HAS_CONSUMER[fx.effectType]) return false;
  if (fx.effectType === 'combat_action' && !ACTIVE_WIRED.has(featId)) return false;
  return true;
}

export type Scaling = 'flat' | 'per_level' | 'per_class_level';

export interface ParsedFeatEffect {
  featId: number;
  featName: string;
  /** Granting class (null for general/ancestry feats) — drives per_class_level scaling. */
  classId: number | null;
  effectType: FeatEffectType;
  /** Constraint 7-style wiring metadata: the stats/skills/mechanics this touches. */
  affects: string[];
  /** The raw payload, for domain owners (combat/campaign) to interpret. */
  raw: Record<string, unknown>;
}

const KNOWN_TYPES = new Set<string>(Object.keys(EFFECT_DOMAIN));

function deriveAffects(raw: Record<string, unknown>): string[] {
  const out = new Set<string>();
  const grab = (v: unknown) => {
    if (typeof v === 'string' && v.length > 0) out.add(v);
  };
  grab(raw['stat']);
  grab(raw['skill']);
  grab(raw['resource']);
  grab(raw['effect']);
  grab(raw['mechanic']);
  grab(raw['dungeon_bonus']);
  const additional = raw['additional'] as Record<string, unknown> | undefined;
  if (additional) grab(additional['stat']);
  const extraSkill = raw['additional_skill_mod'] as Record<string, unknown> | undefined;
  if (extraSkill) grab(extraSkill['skill']);
  const mods = raw['mods'] as { stat?: string }[] | undefined;
  if (Array.isArray(mods)) for (const m of mods) grab(m?.stat);
  return [...out].sort();
}

/** Parse ALL feats at load. A malformed payload throws — content integrity is a build gate. */
function buildIndex(): Map<number, ParsedFeatEffect> {
  const index = new Map<number, ParsedFeatEffect>();
  for (const feat of feats) {
    const rawStr = feat.effects as string | null;
    if (!rawStr) throw new Error(`feat #${feat.id} "${feat.name}": empty effects payload`);
    let raw: Record<string, unknown>;
    try {
      raw = JSON.parse(rawStr) as Record<string, unknown>;
    } catch (e) {
      throw new Error(`feat #${feat.id} "${feat.name}": unparseable effects JSON (${String(e)})`);
    }
    const effectType = raw['effect_type'] as string | undefined;
    if (!effectType || !KNOWN_TYPES.has(effectType)) {
      throw new Error(`feat #${feat.id} "${feat.name}": unknown effect_type "${effectType}"`);
    }
    index.set(feat.id, {
      featId: feat.id,
      featName: feat.name,
      classId: (feat.class_id as number | null) ?? null,
      effectType: effectType as FeatEffectType,
      affects: deriveAffects(raw),
      raw,
    });
  }
  return index;
}

export const featEffectsById: Map<number, ParsedFeatEffect> = buildIndex();

export function effectsByDomain(domain: EffectDomain): ParsedFeatEffect[] {
  return [...featEffectsById.values()].filter((f) => EFFECT_DOMAIN[f.effectType] === domain);
}

// ── Passive resolution (ported from feat_effect_resolver.gd) ─────────────────

export type { HeroFeat } from './types';
import type { HeroFeat } from './types';

function scaledValue(fx: ParsedFeatEffect, hero: HeroState): number {
  const base = (fx.raw['value'] as number | undefined) ?? 0;
  const scaling = ((fx.raw['scaling'] as string | undefined) ?? 'flat') as Scaling | string;
  if (scaling === 'per_level') return base * characterLevel(hero);
  if (scaling === 'per_class_level') {
    // Granting class's level; general feats (classId null) fall back to char level.
    if (fx.classId === null) return base * characterLevel(hero);
    const cl = hero.classLevels.find((c) => c.classId === fx.classId);
    return base * Math.max(cl?.level ?? 0, 1);
  }
  return base;
}

/** Sum of stat_mod contributions across the hero's feats: {stat → total}. */
export function resolveStatMods(hero: HeroState, heroFeats: readonly HeroFeat[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (const hf of heroFeats) {
    const fx = featEffectsById.get(hf.featId);
    if (!fx || fx.effectType !== 'stat_mod') continue;
    const stat = fx.raw['stat'] as string | undefined;
    if (stat) result[stat] = (result[stat] ?? 0) + scaledValue(fx, hero);
    // Completion over GD: `additional` {stat, value} applies too (flat).
    const additional = fx.raw['additional'] as { stat?: string; value?: number } | undefined;
    if (additional?.stat) result[additional.stat] = (result[additional.stat] ?? 0) + (additional.value ?? 0);
  }
  return result;
}

/** Sum of skill_mod contributions: {skill → total}. Skill Focus resolves via choices. */
export function resolveSkillMods(hero: HeroState, heroFeats: readonly HeroFeat[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (const hf of heroFeats) {
    const fx = featEffectsById.get(hf.featId);
    if (!fx || fx.effectType !== 'skill_mod') continue;
    let skill = fx.raw['skill'] as string | undefined;
    if (skill === 'chosen_at_selection') skill = hf.choices?.skill;
    if (skill) result[skill] = (result[skill] ?? 0) + scaledValue(fx, hero);
    const extra = fx.raw['additional_skill_mod'] as { skill?: string; value?: number } | undefined;
    if (extra?.skill) result[extra.skill] = (result[extra.skill] ?? 0) + (extra.value ?? 0);
  }
  return result;
}

/** Does any party member carry a feat granting this dungeon bonus? (e.g. Trap Finder.) */
export function partyDungeonBonus(
  party: readonly { hero: HeroState; feats: readonly HeroFeat[] }[],
  bonusName: string,
): { found: boolean; heroName: string } {
  for (const member of party) {
    for (const hf of member.feats) {
      const fx = featEffectsById.get(hf.featId);
      if (fx && (fx.raw['dungeon_bonus'] as string | undefined) === bonusName) {
        return { found: true, heroName: member.hero.name };
      }
    }
  }
  return { found: false, heroName: '' };
}
