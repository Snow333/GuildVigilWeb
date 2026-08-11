/**
 * Hero identity — ancestry + gender (brief #10, decisions 1 & 3).
 *
 * COSMETIC FOR NOW, deliberately: ancestry names the hero and picks the
 * portrait, and does NOTHING else. No boosts, no flaws, no traits, no speed —
 * the registry rows carry that data and this module pointedly ignores it until
 * a systems brief hires Pathfinder ancestry mechanics on purpose. If you are
 * here to wire ability_boosts into character creation: that is a new brief.
 *
 * Old saves backfill from the hero's id via FNV-1a (never Math.random, never
 * the campaign Rng — the Rng's stream position must not depend on how many
 * heroes needed backfilling). A veteran's face is identical on every machine
 * and every reload, forever.
 */

import { hashIndex } from '@sim/core/hash';
import { ArtKeys } from '@sim/core/ids';
import { ancestryIds, ancestryNameById } from '@sim/registry';

/** Registry ancestry row id (1 Human · 2 Elf · 3 Dwarf · 4 Halfling · 5 Half-Orc · 6 Gnome). */
export type AncestryId = number;

export type Gender = 'f' | 'm';

export const GENDERS: readonly Gender[] = ['f', 'm'];

/**
 * Portrait lookup key — the same subject the bible's filenames use
 * (`hero-halforc-f-bust-01.png` → `hero-halforc-f`). Derived from the registry
 * name rather than hand-tabled, so a new ancestry row needs no code change
 * here — only its art. tools/build-portraits.mjs writes exactly these keys.
 */
export function portraitKey(ancestry: AncestryId, gender: Gender): string {
  return ArtKeys.hero(ancestryNameById.get(ancestry) ?? String(ancestry), gender);
}

export interface HeroIdentity {
  ancestry: AncestryId;
  gender: Gender;
}

/**
 * Deterministic identity for a hero that never had one (constraint 8: the
 * backfilled value seeds on the entity ID). Two independent hash namespaces so
 * ancestry and gender don't correlate — `id` alone would tie the low bit of the
 * ancestry pick to the gender pick.
 */
export function deriveHeroIdentity(heroId: string): HeroIdentity {
  const ids = ancestryIds;
  const ancestry = ids[hashIndex('ancestry', heroId, ids.length)] ?? ids[0] ?? 1;
  const gender = GENDERS[hashIndex('gender', heroId, GENDERS.length)] ?? 'f';
  return { ancestry, gender };
}

/** True when the value is a live registry ancestry id (guards hand-edited saves). */
export function isAncestryId(v: unknown): v is AncestryId {
  return typeof v === 'number' && ancestryIds.includes(v);
}

export function isGender(v: unknown): v is Gender {
  return v === 'f' || v === 'm';
}
