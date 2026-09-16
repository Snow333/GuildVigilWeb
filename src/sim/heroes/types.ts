/** Hero sim-state model — the in-memory shape resolvers operate on. */

import type { AncestryId, Gender } from './ancestry';

export type AbilityKey = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha';

export type Abilities = Record<AbilityKey, number>;

export interface ClassLevel {
  classId: number;
  level: number;
  /** Sequence the class was taken in (multiclass ordering). */
  orderTaken: number;
}

export type HeroStatus = 'active' | 'benched' | 'dead';

/** A feat as held by a hero: the id plus any sub-choices made at selection. */
export interface HeroFeat {
  featId: number;
  choices?: { skill?: string };
}

export interface HeroState {
  id: string;
  name: string;
  status: HeroStatus;
  xp: number;
  maxHp: number;
  abilities: Abilities;
  classLevels: ClassLevel[];
  /** Skill ranks by skill name. */
  skills: Record<string, number>;
  feats: HeroFeat[];
  /**
   * KNOWN SPELLS — the pool half of core-loop D4 (brief #22 M3). Spell ids the
   * hero has learned; the loadout draws its `cast` entries from here.
   *
   * ⚠ Optional because saves predate it. `backfillKnownSpells` fills it from
   * the hero's loadout so an existing Mira does not lose Heal on load, and
   * `assembleHero` still appends the auto-cantrip regardless — a caster is
   * never left with nothing to do (brief #15 measured hero deaths 686 -> 156
   * when the cantrip default landed; do not regress that).
   */
  knownSpells?: number[];
  /** PF2E wounded ratchet value (persists between fights until treated). */
  wounded: number;
  /**
   * THE THIRD LIMITER TIER — featId -> uses spent since the last long rest
   * (brief #31 D2). See `heroes/longRest.ts` for the rules.
   *
   * ⚠ THIS LIVES ON THE SHEET BECAUSE IT MUST OUTLIVE THE ENCOUNTER. The other
   * two limiters (`Combatant.abilityUses`, `abilityReadyAt`) are rebuilt from
   * the sheet every dispatch and so needed no migration; this one cannot be,
   * or a charge spent in room 2 would return in room 3.
   *
   * ⚠ Optional because saves predate it, and ABSENT MEANS FULLY RESTED — an
   * old save loads as a rested party rather than one with unknown charges.
   * `backfillLongRestUses` normalises the shape without inventing a number.
   */
  longRestUses?: Record<number, number>;
  /**
   * Player-chosen at the founding muster; deterministically backfilled on old
   * saves (heroes/ancestry). COSMETIC — identity + portrait only, zero stat
   * effect, until a systems brief says otherwise. Nothing in assembly.ts,
   * levelUp.ts, or any resolver may read these.
   */
  ancestry: AncestryId;
  gender: Gender;
}

/** Character level = sum of all class levels (no hardcoded cap in data; cap enforced in logic). */
export function characterLevel(hero: Pick<HeroState, 'classLevels'>): number {
  return hero.classLevels.reduce((sum, cl) => sum + cl.level, 0);
}

/** PF ability modifier. */
export function abilityMod(score: number): number {
  return Math.floor((score - 10) / 2);
}
