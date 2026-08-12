/**
 * Difficulty bands (brief #11) — what the guild would SAY about a posting.
 *
 * A raw challenge number is meaningless on its own: challenge 3 is routine for a
 * level-5 guild and a funeral for a level-1 one. The band is therefore relative,
 * and it reuses the relation the autopilot already decides by — it declines
 * anything above `partyLevel + 1` (see campaign.ts `autopilotWeek`). ONE relation,
 * derived in one place: if the board ever tells the player "beyond us" about a job
 * the guild would happily take, the label has become a lie.
 *
 * The four bands map 1:1 onto the FROZEN status set in its documented semantics
 * (tokens.css): quiet · attention · warning · critical. Always label-paired —
 * the word ships with the colour, never the colour alone.
 */

export type DifficultyBandId = 'routine' | 'measured' | 'dangerous' | 'beyond';

export interface DifficultyBand {
  id: DifficultyBandId;
  /** Player-facing word. The colour never travels without it. */
  label: string;
  /** Index into the frozen status set (--gv-s0…--gv-s3). */
  tier: 0 | 1 | 2 | 3;
  /** Plain-language why, in the guild's voice — shown beside the label. */
  reason: string;
}

/**
 * Bands by `challenge − partyLevel`:
 *   ≤ −2  routine    two or more levels under the guild
 *   −1…0  measured   at or just under
 *     +1  dangerous  the autopilot's ceiling — it will take this, barely
 *   ≥ +2  beyond     over the ceiling; the guild declines
 */
export function difficultyFor(challenge: number, partyLevel: number): DifficultyBand {
  // Defence in depth: a non-finite party level (an empty roster used to produce
  // NaN) must not poison every posting on the board with a blank band.
  const level = Number.isFinite(partyLevel) ? partyLevel : 1;
  const delta = challenge - level;

  if (delta <= -2) {
    return { id: 'routine', label: 'Routine', tier: 0, reason: 'well within the guild' };
  }
  if (delta <= 0) {
    return { id: 'measured', label: 'Measured', tier: 1, reason: 'a fair match for the guild' };
  }
  if (delta === 1) {
    return { id: 'dangerous', label: 'Dangerous', tier: 2, reason: 'a level above the guild' };
  }
  return {
    id: 'beyond',
    label: 'Beyond us',
    tier: 3,
    reason: delta === 2 ? 'two levels over the guild' : `${delta} levels over the guild`,
  };
}
