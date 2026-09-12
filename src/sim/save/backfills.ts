/**
 * The registered backfill stages (constraint 8). saveStore.ts owns the CHAIN
 * mechanism; this file is the register, and CampaignSession.deserialize runs it
 * over every loaded save before anything reads the state.
 *
 * Every stage: idempotent, early-returns unchanged when there is nothing to do,
 * and seeds any value it invents on the entity ID — never on a clock, never on
 * Math.random, never on the campaign Rng (drawing from the Rng here would move
 * its stream position by however many heroes happened to need backfilling, and
 * two loads of the same save would diverge).
 */

import { deriveHeroIdentity, isAncestryId, isGender } from '@sim/heroes/ancestry';
import { normalizeQuickSlots, QUICK_SLOT_COUNT } from '@sim/heroes/quickSlots';
import type { BackfillStage } from './saveStore';

/** Shape we probe for — deliberately loose: a save older than these fields is the point. */
interface PartyBearing {
  party?: { hero?: { id?: unknown; ancestry?: unknown; gender?: unknown } }[];
}

/** Quick-slots and the alt weapon set (brief #23 M3/D4). */
interface PouchBearing {
  party?: { quickSlots?: unknown; altWeaponSet?: unknown }[];
}

/** Same looseness for the known-spells stage: the loadout WAS the pool. */
interface SpellBearing {
  party?: {
    hero?: { knownSpells?: unknown } | null;
    loadout?: { action?: unknown; spellId?: unknown }[];
  }[];
}

/**
 * Hero identity (brief #10): saves written before the founding muster carry no
 * ancestry/gender. Assign both from the hero's id, once, and persist on the
 * next save. Identical on every machine and every reload — a veteran's face
 * never changes. Also repairs a hand-edited save whose value left the registry.
 */
export const backfillHeroIdentity: BackfillStage = (state) => {
  const s = state as PartyBearing | null;
  if (!s || !Array.isArray(s.party)) return state;

  let touched = false;
  for (const kit of s.party) {
    const hero = kit?.hero;
    if (!hero || typeof hero.id !== 'string') continue;
    const needsAncestry = !isAncestryId(hero.ancestry);
    const needsGender = !isGender(hero.gender);
    if (!needsAncestry && !needsGender) continue;
    const derived = deriveHeroIdentity(hero.id);
    if (needsAncestry) hero.ancestry = derived.ancestry;
    if (needsGender) hero.gender = derived.gender;
    touched = true;
  }
  return touched ? s : state;
};

/**
 * Known spells (brief #22 M3): saves written before the known-spells model
 * carry no `knownSpells` array, but their casters DO have `cast` entries in
 * their loadout — that loadout WAS the pool. Recover the pool from it so a
 * veteran Mira keeps Heal and a veteran Elandra keeps Magic Missile.
 *
 * ⚠ Seeded on nothing at all: this stage INVENTS no value, it only reads what
 * the save already contains. That is the safest possible backfill, and it is
 * idempotent because a hero with the array present is skipped outright.
 *
 * ⚠ A hero with no cast entries gets an EMPTY array, not a guessed spell list.
 * Guessing would hand a level-9 wizard a fresh pool derived from today's
 * policy and silently rewrite a character the player built. `assembleHero`
 * appends the auto-cantrip anyway, so an empty pool is playable, not broken.
 */
export const backfillKnownSpells: BackfillStage = (state) => {
  const s = state as SpellBearing | null;
  if (!s || !Array.isArray(s.party)) return state;

  let touched = false;
  for (const kit of s.party) {
    const hero = kit?.hero;
    if (!hero || typeof hero !== 'object') continue;
    if (Array.isArray(hero.knownSpells)) continue; // already migrated

    const ids = new Set<number>();
    const loadout = kit?.loadout;
    if (Array.isArray(loadout)) {
      for (const entry of loadout) {
        if (entry && typeof entry === 'object' && entry.action === 'cast' && typeof entry.spellId === 'number') {
          ids.add(entry.spellId);
        }
      }
    }
    hero.knownSpells = [...ids].sort((a, b) => a - b);
    touched = true;
  }
  return touched ? s : state;
};

/**
 * Quick-slots (brief #23 M3): saves predate the pouch. Give every kit an
 * empty one of the right length, and seed the alt weapon set as empty.
 *
 * ⚠ INVENTS NOTHING — an empty pouch is the honest starting state. Handing
 * veteran parties free potions would silently rewrite an economy the player
 * built, and the restock path is the shop's job, not a migration's.
 *
 * ⚠ NORMALISES rather than only filling: a save written by a future build
 * with a different slot count, or a hand-edited one, is repaired to exactly
 * QUICK_SLOT_COUNT here rather than crashing a resolver later.
 */
export const backfillQuickSlots: BackfillStage = (state) => {
  const s = state as PouchBearing | null;
  if (!s || !Array.isArray(s.party)) return state;

  let touched = false;
  for (const kit of s.party) {
    if (!kit || typeof kit !== 'object') continue;
    const already = Array.isArray(kit.quickSlots) && kit.quickSlots.length === QUICK_SLOT_COUNT;
    if (!already) {
      kit.quickSlots = normalizeQuickSlots(kit.quickSlots);
      touched = true;
    }
    if (!Array.isArray(kit.altWeaponSet)) {
      kit.altWeaponSet = [];
      touched = true;
    }
  }
  return touched ? s : state;
};

/** Stages run in order. Append only — a stage's position is part of its contract. */
export const SAVE_BACKFILLS: readonly BackfillStage[] = [
  backfillHeroIdentity, backfillKnownSpells, backfillQuickSlots,
];
