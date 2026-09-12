/**
 * AUTOPILOT LEVEL-UP POLICY — per-class feat and boost priorities (brief #22 M5).
 *
 * ⚠ THIS IS A PLAYER-FACING FEATURE, NOT JUST A HARNESS CONCERN.
 * Steven's decision (#22 M5): "Autopilot takes a fixed per-class predefined
 * priority. But we want players to do the level up manually. Auto-pilot is
 * only an option if they want to skip making the choices."
 *
 * So this is "Level up for me" — one implementation, two consumers (the button
 * and the harness). The harness stays a valid proxy for hand play precisely
 * because it walks the same list a skipping player would get.
 *
 * ⚠ THESE ARE DATA, NOT LOGIC. Ordered id arrays live here so tuning the
 * autopilot never means touching the walk. Every entry is filtered through the
 * readiness gate and the prereq check at selection time, so an id that is not
 * yet wired is skipped rather than wasted — which means an entry can be listed
 * BEFORE its effect lands and will start being taken the day it does.
 */

import type { AbilityKey } from '@sim/heroes/types';

/**
 * Class feat priority, best-first, per class id.
 *
 * Fighter (1): Power Attack first — it is the only wired active that raises
 * damage every swing. Then the riders that stick a condition, then the chain
 * into Improved Knockdown, then Determination as the emergency button.
 * Reactive Strike is NOT here: it is auto-granted by the class feature.
 *
 * Rogue (4): Nimble Dodge (a wired reaction) before Poison Weapon (a wired
 * active), because surviving to strike beats a 1d4 rider.
 *
 * Cleric (3): the passives that are actually read, then the two wired actives.
 *
 * Wizard (2): ⚠ NOTHING IS WIRED. Its 24 class feats are 14 passive_modifier
 * (unwired shapes), 3 resource_grant, 2 spell_modifier, 1 special, 2 reaction,
 * 1 stat_mod, 1 combat_action — and of those only Spell Penetration (#97,
 * stat_mod) passes the readiness gate. The wizard's autopilot list is
 * deliberately short because the CONTENT is not ready, not because the class
 * was forgotten. Its power comes from M3's spells instead.
 */
export const CLASS_FEAT_PRIORITY: Readonly<Record<number, readonly number[]>> = {
  1: [1, 4, 5, 7, 9, 8], // Fighter: Power Attack, Intimidating Strike, Knockdown, Improved KD, Brutish Shove, Determination
  2: [97], // Wizard: Spell Penetration (the only wired one — see above)
  3: [133, 134, 135, 138], // Cleric: Healing Hands, Turn Undead, Channel Smite, Defensive Ward
  4: [69, 68, 71, 70], // Rogue: Nimble Dodge, Sneak Attack, Poison Weapon, Trap Finder
};

/**
 * General/skill feat priority — shared across classes, since both pools are
 * class-agnostic (43 rows with `class_id IS NULL`).
 */
export const SHARED_FEAT_PRIORITY: readonly number[] = [
  211, // Weapon Specialization — wired, flat damage
  180, // Battle Medicine
  204, // Combat Medic
];

/**
 * Ability boost priority per class, best-first. A milestone takes the first
 * BOOSTS_PER_MILESTONE entries that are still distinct.
 *
 * ⚠ KEY ABILITY FIRST, THEN CON. The old single-boost policy took the key
 * ability and nothing else; with four boosts the autopilot must spend the
 * other three deliberately or it would pick alphabetically and quietly build
 * worse characters than a player would.
 */
export const CLASS_BOOST_PRIORITY: Readonly<Record<number, readonly AbilityKey[]>> = {
  1: ['str', 'con', 'dex', 'wis'], // Fighter: hit harder, live longer
  2: ['int', 'con', 'dex', 'wis'], // Wizard: spell DC, then survivability
  3: ['wis', 'con', 'str', 'cha'], // Cleric: spell DC, then survivability
  4: ['dex', 'con', 'str', 'wis'], // Rogue: attack/AC, then survivability
};

/** Fallback for classes without an authored list (the other nine). */
export const DEFAULT_BOOST_ORDER: readonly AbilityKey[] = ['con', 'dex', 'str', 'wis', 'int', 'cha'];

/**
 * SKILL-POINT PRIORITIES for auto level-up (brief #24 D3).
 *
 * Steven, 2026-09-12: *"We want players to allocate points on character
 * creation and level up. So it's up to the player... For auto-level up we
 * should assume the character takes the skill point wizard/arcana
 * cleric/religion for RP purposes."*
 *
 * ⚠ THIS IS THE AUTOPILOT ONLY — a hand-levelled hero is never steered here.
 * The scroll ladder (scrolls.ts) is deliberately reachable by ANY class that
 * invests, so a Fighter who wants Arcana may take it; the autopilot simply
 * makes the role-play-obvious choice on the player's behalf.
 *
 * ⚠ THE CASTER SKILL LEADS ITS LIST ON PURPOSE. `buildAutoLevelUpPlan`
 * round-robins the priority order under the rank cap, so a leading entry gets
 * the first point at every level — which is what keeps an auto-levelled Wizard
 * on the native ladder (spellLevel + 1) as scrolls get harder.
 */
export const CLASS_SKILL_PRIORITY: Readonly<Record<number, readonly string[]>> = {
  1: ['athletics', 'perception'],              // Fighter
  2: ['arcana', 'perception'],                 // Wizard — reads arcane natively
  3: ['religion', 'perception', 'athletics'],  // Cleric — reads divine natively
  4: ['thievery', 'stealth', 'perception'],    // Rogue
};

/** The dungeon trio, for classes without an authored list. */
export const DEFAULT_SKILL_PRIORITY: readonly string[] = ['perception', 'thievery', 'athletics'];
