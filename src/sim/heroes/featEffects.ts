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
  // ── M2: the Ranger and the Bard, who had NO feats at all ──
  310, // Precise Shot       (Ranger L2)   strike_with_bonus
  311, // Hobbling Shot      (Ranger L4)   strike_plus_condition, slowed
  312, // Driving Shot       (Ranger L6)   strike_plus_shove
  313, // Terrifying Volley  (Ranger L8)   strike_plus_condition, frightened
  314, // Crippling Shot     (Ranger L10)  strike_plus_trip, no MAP
  330, // Inspire Courage    (Bard L1)     grant_party_condition, emboldened
  333, // Dirge of Doom      (Bard L8)     grant_party_condition on ENEMIES
  334, // Inspire Greatness  (Bard L9)     grant_party_condition, heroism
  340, // Harmonize          (Bard L2)     grant_ally_ac
  341, // Soothing Refrain   (Bard L4)     remove_condition, once per combat
  342, // Song of Strife     (Bard L6)     grant_party_condition, blessed
  343, // Bardic Sting       (Bard L8)     strike_plus_condition, sickened
  344, // Call to Arms       (Bard L10)    grant_party_condition, hasted
]);

/** Why a feat cannot be selected. FROZEN set — the UI label-pairs each one. */
export type UnreadyReason = 'not_yet_implemented' | 'prereq_unmet' | 'already_taken' | 'level_unmet';

/**
 * Is this feat's effect something the ENGINE can act on today? Content-spec
 * completeness AND an engine consumer AND (for actives) a wired row.
 * Selection eligibility adds prereqs/level/duplication on top — see `feats.ts`.
 *
 * ⚠ TYPE-LEVEL ONLY, AND THAT IS NOT ENOUGH TO GREY A PICKER ROW. This asks
 * whether the feat's effect *type* has a consumer. Every real consumer matches
 * something NARROWER — see `featConsumer` below, which is what the picker uses.
 */
export function isEffectReady(featId: number): boolean {
  const fx = featEffectsById.get(featId);
  if (!fx) return false;
  if (fx.raw['implemented'] === false) return false;
  if (!EFFECT_HAS_CONSUMER[fx.effectType]) return false;
  if (fx.effectType === 'combat_action' && !ACTIVE_WIRED.has(featId)) return false;
  return true;
}

// ── Real reach: which consumer, if any, actually picks this feat up ──────────

/**
 * ⚠ WHY THIS EXISTS: `isEffectReady` OVERSTATES WHAT WORKS BY 2.8×.
 *
 * Measured in `class-abilities-phase1-findings.md` §1 (2026-09-15) and
 * reproduced here: 227 authored, **83 pass `isEffectReady`, 30 reach a
 * consumer**. The gate asks whether the effect TYPE has a consumer, but every
 * real consumer matches a narrower payload shape — and two of them match the
 * feat's NAME. `EFFECT_HAS_CONSUMER.passive_modifier = true` alone covers 119
 * feats and reaches exactly ONE (Sneak Attack).
 *
 * `offersForSlot` greyed on the type gate, so it offered 67 selectable feats of
 * which 42 reached no engine code: a player picking at random got a dead feat
 * **63% of the time** (findings §1).
 *
 * ⚠ THIS TABLE IS A TRANSCRIPTION OF CALL SITES, NOT A DESIGN. Each entry names
 * the file:line it mirrors. It is the same liar-in-waiting risk as
 * `EFFECT_HAS_CONSUMER` — narrowed, not eliminated — so
 * `tests/heroes/featReach.test.ts` drives a hero through `assembleHero` /
 * `runEncounter` per entry and proves the effect LANDS. A test that asks this
 * predicate whether a feat is ready is worthless; assert the consumer.
 *
 * ⚠ WHEN YOU WIRE A NEW HOOK, ADD ITS MATCHER HERE AND ITS WITNESS THERE.
 * Wiring a consumer without extending this table leaves the feat greyed out —
 * silently invisible content, the mirror of the bug this fixes.
 */
export interface ConsumerMatcher {
  /** The consumer function's name, for diagnostics and the witness table. */
  readonly site: string;
  /** Where it lives — kept so a moved consumer is findable. */
  readonly where: string;
  readonly matches: (fx: ParsedFeatEffect) => boolean;
}

/** Names matched literally by `encounter.ts` TOGGLE_CONDITIONS. */
const TOGGLE_FEAT_NAMES: ReadonlySet<string> = new Set([
  'Rage', 'Tiger Stance', 'Crane Stance', 'Mountain Stance',
]);

/** Names matched literally by `assembly.ts` reactionIds. */
const REACTION_FEAT_NAMES: ReadonlySet<string> = new Set(['Reactive Strike', 'Nimble Dodge']);

/** Effects `abilities.ts` KNOWN_EFFECTS can actually execute. */
const WIRED_ACTIVE_EFFECTS: ReadonlySet<string> = new Set([
  'strike_with_bonus', 'strike_plus_condition', 'strike_plus_shove',
  'strike_plus_trip', 'strike_plus_channel',
  'remove_condition', 'grant_ally_ac', 'grant_party_condition', 'apply_weapon_poison',
]);

export const CONSUMER_MATCHERS: readonly ConsumerMatcher[] = [
  {
    site: 'resolveStatMods',
    where: 'heroes/featEffects.ts',
    matches: (fx) =>
      fx.effectType === 'stat_mod' &&
      (typeof fx.raw['stat'] === 'string' ||
        typeof (fx.raw['additional'] as { stat?: unknown } | undefined)?.stat === 'string'),
  },
  {
    site: 'resolveSkillMods',
    where: 'heroes/featEffects.ts',
    matches: (fx) => fx.effectType === 'skill_mod' && typeof fx.raw['skill'] === 'string',
  },
  {
    site: 'abilityDef',
    where: 'combat/abilities.ts',
    matches: (fx) =>
      fx.effectType === 'combat_action' && WIRED_ACTIVE_EFFECTS.has(fx.raw['effect'] as string),
  },
  {
    site: 'executeToggle',
    where: 'combat/encounter.ts — BY NAME',
    matches: (fx) =>
      (fx.effectType === 'toggle' || fx.effectType === 'stance') && TOGGLE_FEAT_NAMES.has(fx.featName),
  },
  {
    site: 'reactionIds',
    where: 'campaign/assembly.ts — BY NAME',
    matches: (fx) => fx.effectType === 'reaction' && REACTION_FEAT_NAMES.has(fx.featName),
  },
  {
    site: 'weaponSpecBonus',
    where: 'campaign/assembly.ts',
    matches: (fx) => fx.effectType === 'weapon_spec' && fx.raw['tier_bonus'] !== undefined,
  },
  {
    site: 'sneakDice',
    where: 'campaign/assembly.ts — one payload shape',
    matches: (fx) =>
      fx.effectType === 'passive_modifier' &&
      fx.raw['trigger'] === 'strike_vs_flat_footed' &&
      fx.raw['effect'] === 'bonus_damage',
  },
  {
    site: 'partyDungeonBonus',
    where: 'heroes/featEffects.ts',
    matches: (fx) => typeof fx.raw['dungeon_bonus'] === 'string',
  },
];

const consumerCache = new Map<number, string | null>();

/** Which consumer reads this feat today? Null when nothing in `src/` does. */
export function featConsumer(featId: number): string | null {
  const cached = consumerCache.get(featId);
  if (cached !== undefined) return cached;
  const fx = featEffectsById.get(featId);
  let site: string | null = null;
  if (fx) site = CONSUMER_MATCHERS.find((m) => m.matches(fx))?.site ?? null;
  consumerCache.set(featId, site);
  return site;
}

/**
 * Does picking this feat change ANYTHING in the engine today? This is the
 * honest question the level-up picker must ask.
 *
 * ⚠ CONJUNCTION WITH `isEffectReady` ON PURPOSE — it only ever NARROWS. Two
 * feats (#192 Courtly Graces, #193 Experienced Smuggler) are flagged
 * `implemented: false` yet ARE read by `resolveSkillMods` (findings §3, "the
 * reverse error"). Dropping the conjunction would un-grey them. Whether
 * spec-incomplete-but-working content should be offered is Steven's call, not
 * this module's, so the conservative form ships and the question is flagged.
 */
export function reachesConsumer(featId: number): boolean {
  return isEffectReady(featId) && featConsumer(featId) !== null;
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
