/**
 * THE GEAR POLICY (brief #16 §5, APPROVED) — harness support, not sim code.
 *
 * The autopilot deliberately never equips: gearing is a PLAYER pleasure (the
 * paper-doll screen, the thing you've been eyeing in the town shop), so
 * `autopilotWeek` calling `session.equip()` would be the first step toward the
 * feature Steven declined. But a harness driven by the autopilot measures a
 * permanently unequipped party, which is not the player experience — and brief
 * #14 §10.3 measured gear as the largest single lever once the walls are fixed.
 *
 * So the harness models a competently-equipping player HERE, in tests/, as
 * data. `GearProvider` is the seam: brackets of party characters can replace
 * `bracketProvider` later without either harness file changing.
 *
 * ── Why a hand-authored table and not "best available stat" ──────────────────
 * Because the obvious policy is measurably wrong (brief #16 §5.1). Implemented
 * literally it puts FULL PLATE on the wizard and the rogue at level 7 —
 * `max_dex 0`, which deletes the three points of AC the rogue's whole build
 * pays for — and a Frost Dagger in all four hands. Three columns you would
 * expect to prevent that do not: `item_level` is read by nothing,
 * `class_weapon_proficiency` is exported and read by nothing, and
 * `armor_check_penalty` is read by nothing. The sim will let any hero wear or
 * swing anything, so the constraint has to live in the policy.
 */

import type { ItemInstance } from '@sim/core/events/types';
import { assembleParty, type HeroKit } from '@sim/campaign/assembly';
import { buildAutoLevelUpPlan } from '@sim/campaign/campaign';
import { starterParty } from '@sim/campaign/starterParty';
import type { DispatchHero } from '@sim/dungeon/checks';
import { applyLevelUp } from '@sim/heroes/levelUp';
import { characterLevel } from '@sim/heroes/types';
import { progressionFor } from '@sim/registry';

/** The autopilot's own skill priorities — harness and live play share one path. */
const PRIORITIES = ['perception', 'athletics', 'thievery'] as const;

export interface GearRung {
  minLevel: number;
  /** Registry item id, or null for "no armour" (the wizard's opening rung). */
  armor: number | null;
  weapon: number;
}

/** The seam. Return null to leave the founding muster's kit untouched. */
export type GearProvider = (classId: number, level: number) => GearRung | null;

/**
 * classId 1 Fighter · 2 Wizard · 3 Cleric · 4 Rogue.
 *
 * Two authoring rules, both load-bearing:
 *
 *  1. NO `striking_tier > 0` ROWS (ids 145/146/147/166/168). Those five derive
 *     at 1.5x their authored damage — Striking Greatsword +2 is authored `2d12`
 *     and derives `3d12` — because the extra die is baked into `damage_dice`
 *     AND applied again from `striking_tier` (brief #14 bug B). Excluding them
 *     keeps the bug out of this harness's first baseline. The milestone that
 *     fixes B adds these rungs and moves the snapshot for a stated reason.
 *
 *  2. ARMOUR RESPECTS CLASS FLAVOUR. The sim enforces nothing, so the wizard
 *     could wear a chain shirt for +2 AC; measured at +5.7 / +8.4 points of
 *     completion at d2/d3, which is at or inside the +/-8-point significance bar
 *     at 300 runs (brief #16 §3), so it is not a finding. Steven's call: keep
 *     the flavour, and solve the backline's exposure with positioning rather
 *     than by dressing the wizard in mail.
 */
export const GEAR_BRACKETS: Readonly<Record<number, readonly GearRung[]>> = {
  // Fighter — dex +1, so heavy armour always wins on effective AC. Longsword line.
  1: [
    { minLevel: 1, armor: 25, weapon: 3 },   // Chain Mail + Longsword (the muster kit)
    { minLevel: 3, armor: 26, weapon: 111 }, // Scale Mail + Masterwork Longsword
    { minLevel: 4, armor: 27, weapon: 17 },  // Half Plate + Longsword +1
    { minLevel: 5, armor: 27, weapon: 133 }, // Half Plate + Longsword +2
    { minLevel: 7, armor: 28, weapon: 133 }, // Full Plate + Longsword +2
    { minLevel: 8, armor: 28, weapon: 140 }, // Full Plate + Longsword +3
  ],
  // Wizard — robes and light only. The answer to being shot at is the cantrip
  // (brief #15 §10), not plate.
  2: [
    { minLevel: 1, armor: null, weapon: 16 }, // Staff (the muster kit)
    { minLevel: 2, armor: 22, weapon: 124 },  // Leather + Masterwork Staff
    { minLevel: 4, armor: 23, weapon: 132 },  // Studded Leather + Dagger +2
  ],
  // Cleric — dex +0, so heavy armour costs nothing. Mace line.
  3: [
    { minLevel: 1, armor: 26, weapon: 7 },   // Scale Mail + Mace (the muster kit)
    { minLevel: 2, armor: 25, weapon: 115 }, // Chain Mail + Masterwork Mace
    { minLevel: 5, armor: 27, weapon: 137 }, // Half Plate + Mace +2
    { minLevel: 7, armor: 28, weapon: 137 }, // Full Plate + Mace +2
  ],
  // Rogue — dex +3, so `max_dex` is the whole game: Chain Shirt (ac 4 / md 3)
  // beats Full Plate (ac 8 / md 0) for this hero. Rapier line.
  4: [
    { minLevel: 1, armor: 22, weapon: 9 },   // Leather + Rapier (the muster kit)
    { minLevel: 2, armor: 24, weapon: 117 }, // Chain Shirt + Masterwork Rapier
    { minLevel: 4, armor: 24, weapon: 136 }, // Chain Shirt + Rapier +2
    { minLevel: 8, armor: 24, weapon: 142 }, // Chain Shirt + Rapier +3
  ],
};

/** The competently-equipping player: highest rung whose `minLevel` is reached. */
export const bracketProvider: GearProvider = (classId, level) => {
  const table = GEAR_BRACKETS[classId];
  if (!table) return null;
  let best: GearRung | null = null;
  for (const rung of table) {
    if (rung.minLevel <= level && (best === null || rung.minLevel >= best.minLevel)) best = rung;
  }
  return best;
};

/**
 * The negative control for the policy itself (brief #16 §8, NC6): the founding
 * kit, never upgraded — what the autopilot actually produces. A harness that
 * silently failed to equip would look exactly like a healthy green baseline,
 * because an unequipped party is the very thing this policy exists to stop
 * measuring, so this provider has to exist and has to be exercised.
 */
export const starterProvider: GearProvider = () => null;

const instance = (baseId: number): ItemInstance => ({
  baseId: String(baseId),
  tier: 'mundane',
  propertyIds: [],
  seed: `harness_gear_${baseId}`,
});

/** Take the founding wedge to character level N via the autopilot's own plan. */
function levelTo(kits: HeroKit[], target: number): HeroKit[] {
  for (const kit of kits) {
    while (characterLevel(kit.hero) < target) {
      const plan = buildAutoLevelUpPlan(kit.hero, PRIORITIES);
      if (!plan) break;
      const primary = kit.hero.classLevels[0];
      if (!primary) break;
      const prog = progressionFor(plan.classId, primary.level + 1);
      if (!prog) break;
      applyLevelUp(kit.hero, { ...plan, hpPerLevel: prog.hp_per_level as number });
    }
  }
  return kits;
}

/**
 * Kits are expensive to build (a level-up loop per hero) and cheap to reuse:
 * `assembleParty` costs 0.053 ms and hands back fresh Combatants every call, so
 * one cached kit set per (level, policy) serves every run of a cell.
 */
const kitCache = new Map<string, HeroKit[]>();

export function kitsAt(level: number, provider: GearProvider, policyName: string): HeroKit[] {
  const key = `${level}::${policyName}`;
  const cached = kitCache.get(key);
  if (cached) return cached;

  const kits = levelTo(starterParty(), level);
  for (const kit of kits) {
    const primary = kit.hero.classLevels[0];
    if (!primary) continue;
    const rung = provider(primary.classId, characterLevel(kit.hero));
    if (!rung) continue;
    kit.equipped = [
      ...(rung.armor !== null ? [instance(rung.armor)] : []),
      instance(rung.weapon),
    ];
  }
  kitCache.set(key, kits);
  return kits;
}

/** A fresh, fully-derived party at level N under a gear policy. */
export function partyAt(level: number, provider: GearProvider, policyName: string): DispatchHero[] {
  return assembleParty(kitsAt(level, provider, policyName));
}
