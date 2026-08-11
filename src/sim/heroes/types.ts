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
  /** PF2E wounded ratchet value (persists between fights until treated). */
  wounded: number;
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
