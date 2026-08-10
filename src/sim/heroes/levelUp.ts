/**
 * Level-up application — atomic commit of a level-up plan.
 * Ported from level_up_apply.gd / level_up_prereq_check.gd / multiclass_constants.gd
 * and the state-factory HP formula (max(1, hp_per_level + effective CON mod)).
 *
 * Preserved nuances (decision-ledger Area 1):
 *  - Boost-before-class ordering: eligibility projects the pending boost, so a
 *    CHA-12 fighter can boost to 14 and enter Sorcerer in the SAME level-up.
 *  - CON boost pays retroactive HP: modDiff × prior character level (the new
 *    level's HP already uses the boosted mod).
 *  - Advancing an existing class is always allowed by prereqs (caps still bind).
 *
 * Fixed, not re-inherited:
 *  - THE INT-BOOST BUG: skill points now use the EFFECTIVE Int (incl. pending
 *    boost). The Godot wizard computed them from pre-boost Int.
 *  - Negative ability mods use PF-RAW floor (score 7 → −2); GDScript's integer
 *    division truncated toward zero (−1). Divergence documented here.
 */

import { classesById } from '@sim/registry';
import { abilityMod, characterLevel, type AbilityKey, type HeroFeat, type HeroState } from './types';

export const CHARACTER_LEVEL_CAP = 20;
export const CLASS_LEVEL_CAP = 20;

/**
 * DELIBERATE DIVERGENCE (career-harness finding, 1.5): fresh heroes add
 * PF2E-style ancestry base HP at creation. The Godot factory's per-level-only
 * formula produced 7–12 HP level-1 heroes — below the band the combat system
 * was tuned and harness-validated against (~18 HP "level-appropriate"), and
 * they folded to any single hit. Level-up gains are unchanged.
 */
export const ANCESTRY_BASE_HP = 8;

/** Creation-time max HP: ancestry base + the level-1 gain (same floor as level-ups). */
export function freshHeroMaxHp(hpPerLevel: number, conMod: number): number {
  return ANCESTRY_BASE_HP + Math.max(1, hpPerLevel + conMod);
}
export const PRESTIGE_CLASS_LEVEL_CAP = 10;
export const MAX_CLASSES = 5;
export const ABILITY_BOOST_LEVELS = [5, 10, 15, 20] as const;
export const MULTICLASS_ABILITY_REQ = 13;

/** Does reaching this NEW character level grant an ability boost? */
export function isBoostLevel(newCharacterLevel: number): boolean {
  return (ABILITY_BOOST_LEVELS as readonly number[]).includes(newCharacterLevel);
}

export interface EligibilityResult {
  met: boolean;
  reason: string;
}

/**
 * Can this hero take/advance this class? Mirrors LevelUpPrereqCheck.check_class,
 * extended with the class-level caps the Godot picker enforced separately.
 * `selectedBoost` projects a pending boost (boost-before-class ordering).
 */
export function checkClassEligibility(
  hero: HeroState,
  classId: number,
  selectedBoost?: AbilityKey,
): EligibilityResult {
  const classRow = classesById.get(classId);
  if (!classRow) return { met: false, reason: `Unknown class ${classId}` };

  if (characterLevel(hero) >= CHARACTER_LEVEL_CAP) {
    return { met: false, reason: `Character level cap (${CHARACTER_LEVEL_CAP}) reached` };
  }

  const existing = hero.classLevels.find((cl) => cl.classId === classId);
  if (existing) {
    const cap = classRow.class_type === 'prestige' ? PRESTIGE_CLASS_LEVEL_CAP : CLASS_LEVEL_CAP;
    if (existing.level >= cap) {
      return { met: false, reason: `${classRow.name} is at its level cap (${cap})` };
    }
    return { met: true, reason: '' }; // advancing an existing class: always prereq-met
  }

  if (hero.classLevels.length >= MAX_CLASSES) {
    return { met: false, reason: `Maximum ${MAX_CLASSES} classes reached` };
  }

  const keyAbility = (classRow.key_ability ?? 'str') as AbilityKey;
  let score = hero.abilities[keyAbility];
  if (selectedBoost === keyAbility) score += 2;
  if (score < MULTICLASS_ABILITY_REQ) {
    return {
      met: false,
      reason: `Requires ${keyAbility.toUpperCase()} ${MULTICLASS_ABILITY_REQ} (current: ${score})`,
    };
  }
  return { met: true, reason: '' };
}

/**
 * SKILL RANK CAP (playtest finding #4, Steven-approved 2026-08-10): a skill's
 * ranks may never exceed CHARACTER LEVEL, PF2-style. The Godot original never
 * enforced a ceiling (its fixtures shipped 4-rank level-1 heroes) — hand play
 * exposed the dump-stat lever, so the rule lands here as a deliberate,
 * documented divergence. Creation-time stats must also obey it (the starter
 * wedge was re-statted in the same commit).
 */
export function maxSkillRanks(characterLevelValue: number): number {
  return characterLevelValue;
}

/**
 * Skill points for a level-up: class base + Int mod, floor 1 — computed from the
 * EFFECTIVE Int including a pending Int boost (the fixed bug).
 */
export function skillPointsForLevel(classId: number, hero: HeroState, selectedBoost?: AbilityKey): number {
  const classRow = classesById.get(classId);
  if (!classRow) throw new Error(`skillPointsForLevel: unknown class ${classId}`);
  const effectiveInt = hero.abilities.int + (selectedBoost === 'int' ? 2 : 0);
  return Math.max(1, (classRow.skill_points_per_level as number) + abilityMod(effectiveInt));
}

/** HP gained this level: max(1, hp_per_level + effective CON mod). */
export function hpGainForLevel(hpPerLevel: number, hero: HeroState, selectedBoost?: AbilityKey): number {
  const effectiveCon = hero.abilities.con + (selectedBoost === 'con' ? 2 : 0);
  return Math.max(1, hpPerLevel + abilityMod(effectiveCon));
}

export interface LevelUpPlan {
  classId: number;
  /** From class_progression.hp_per_level for the NEW class level. */
  hpPerLevel: number;
  boost?: AbilityKey;
  /** Skill ranks to ADD, by skill name. */
  skillRanks: Record<string, number>;
  feats: HeroFeat[];
  autoGrantedFeatIds: number[];
}

export interface LevelUpApplied {
  classId: number;
  newClassLevel: number;
  newCharacterLevel: number;
  hpGain: number;
  retroactiveConHp: number;
  boost?: AbilityKey;
}

/**
 * Atomic apply: validates first, then mutates. A validation failure throws
 * BEFORE any mutation — no partial level-ups, mirroring the one-commit design.
 */
export function applyLevelUp(hero: HeroState, plan: LevelUpPlan): LevelUpApplied {
  const eligibility = checkClassEligibility(hero, plan.classId, plan.boost);
  if (!eligibility.met) throw new Error(`applyLevelUp: ${eligibility.reason}`);

  const priorCharacterLevel = characterLevel(hero);

  // Rank cap: validated against the NEW character level, before any mutation.
  const cap = maxSkillRanks(priorCharacterLevel + 1);
  for (const [skill, ranks] of Object.entries(plan.skillRanks)) {
    const after = (hero.skills[skill] ?? 0) + ranks;
    if (after > cap) {
      throw new Error(`applyLevelUp: ${skill} would reach ${after} ranks — cap is ${cap} (character level)`);
    }
  }

  const hpGain = hpGainForLevel(plan.hpPerLevel, hero, plan.boost);

  // Retroactive CON HP computed against PRIOR levels (the new level's HP already
  // uses the boosted mod via hpGainForLevel).
  let retroactiveConHp = 0;
  if (plan.boost === 'con') {
    const modDiff = abilityMod(hero.abilities.con + 2) - abilityMod(hero.abilities.con);
    if (modDiff > 0 && priorCharacterLevel > 0) retroactiveConHp = modDiff * priorCharacterLevel;
  }

  // ── Mutations (no failure paths below this line) ──
  const existing = hero.classLevels.find((cl) => cl.classId === plan.classId);
  let newClassLevel: number;
  if (existing) {
    existing.level += 1;
    newClassLevel = existing.level;
  } else {
    const orderTaken = hero.classLevels.length + 1;
    hero.classLevels.push({ classId: plan.classId, level: 1, orderTaken });
    newClassLevel = 1;
  }

  hero.maxHp += hpGain + retroactiveConHp;
  if (plan.boost) hero.abilities[plan.boost] += 2;
  for (const [skill, ranks] of Object.entries(plan.skillRanks)) {
    hero.skills[skill] = (hero.skills[skill] ?? 0) + ranks;
  }
  for (const feat of plan.feats) hero.feats.push(feat);
  for (const featId of plan.autoGrantedFeatIds) {
    if (!hero.feats.some((f) => f.featId === featId)) hero.feats.push({ featId });
  }

  const result: LevelUpApplied = {
    classId: plan.classId,
    newClassLevel,
    newCharacterLevel: priorCharacterLevel + 1,
    hpGain,
    retroactiveConHp,
  };
  if (plan.boost) result.boost = plan.boost;
  return result;
}
