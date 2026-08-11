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
import type { BackfillStage } from './saveStore';

/** Shape we probe for — deliberately loose: a save older than these fields is the point. */
interface PartyBearing {
  party?: { hero?: { id?: unknown; ancestry?: unknown; gender?: unknown } }[];
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

/** Stages run in order. Append only — a stage's position is part of its contract. */
export const SAVE_BACKFILLS: readonly BackfillStage[] = [backfillHeroIdentity];
