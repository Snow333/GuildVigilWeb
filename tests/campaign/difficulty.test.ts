import { describe, expect, it } from 'vitest';
import { autopilotWeek } from '@sim/campaign/campaign';
import { difficultyFor } from '@sim/campaign/difficulty';
import { CampaignSession } from '@sim/campaign/session';
import { starterParty } from '../fixtures/party-fixture';

const band = (challenge: number, partyLevel: number) => difficultyFor(challenge, partyLevel).id;

describe('difficulty bands (brief #11)', () => {
  it('bands by challenge − partyLevel, at every threshold boundary', () => {
    // −3, −2 routine | −1, 0 measured | +1 dangerous | +2, +3 beyond
    expect(band(2, 5)).toBe('routine');
    expect(band(3, 5)).toBe('routine');
    expect(band(4, 5)).toBe('measured');
    expect(band(5, 5)).toBe('measured');
    expect(band(6, 5)).toBe('dangerous');
    expect(band(7, 5)).toBe('beyond');
    expect(band(8, 5)).toBe('beyond');
  });

  it('maps 1:1 onto the frozen status set in its documented semantics', () => {
    // quiet · attention · warning · critical — four bands, four tiers, no reuse.
    const tiers = [band(1, 5), band(5, 5), band(6, 5), band(9, 5)].map(
      (id, i) => difficultyFor([1, 5, 6, 9][i]!, 5).tier,
    );
    expect(tiers).toEqual([0, 1, 2, 3]);
    expect(new Set(tiers).size).toBe(4);
    expect(new Set([band(1, 5), band(5, 5), band(6, 5), band(9, 5)]).size).toBe(4);
  });

  it('always carries a label and a reason — the colour never travels alone', () => {
    for (let challenge = 1; challenge <= 12; challenge++) {
      const d = difficultyFor(challenge, 5);
      expect(d.label.length).toBeGreaterThan(0);
      expect(d.reason.length).toBeGreaterThan(0);
    }
  });

  it('SURVIVES A NON-FINITE PARTY LEVEL rather than poisoning the whole board', () => {
    // partyLevel() divided by heroes.length; an empty roster produced NaN, and
    // Math.max(NaN, 1) is NaN. Guarded in two places now — this pins the second.
    const d = difficultyFor(3, Number.NaN);
    expect(d.id).toBe('beyond'); // falls back to a level-1 guild
    expect(Number.isFinite(d.tier)).toBe(true);
    expect(d.label).toBe('Beyond us');
  });

  it('AGREES WITH THE AUTOPILOT: "beyond us" is exactly what the guild declines', () => {
    // autopilotWeek takes challenge <= partyLevel + 1 and leaves the rest to
    // expire. If these two ever disagree, the board is lying to the player.
    for (let pl = 1; pl <= 8; pl++) {
      for (let challenge = 1; challenge <= 12; challenge++) {
        const takeable = challenge <= pl + 1;
        expect(difficultyFor(challenge, pl).id === 'beyond').toBe(!takeable);
      }
    }
  });
});

describe('the board carries the band, so the UI computes no rule', () => {
  it('every posting arrives with a difficulty derived from the live party level', () => {
    const s = CampaignSession.create({ campaignId: 'diff', seed: 'world_diff', party: starterParty() });
    autopilotWeek(s, ['perception', 'athletics', 'thievery']);
    const board = s.board();
    expect(board.length).toBeGreaterThan(0);
    for (const entry of board) {
      expect(entry.difficulty).toEqual(difficultyFor(entry.challenge, s.partyLevel()));
    }
  });

  it('partyLevel never returns NaN, even with nobody left', () => {
    const s = CampaignSession.create({ campaignId: 'empty', seed: 'world_empty', party: [] });
    expect(s.partyLevel()).toBe(1);
    expect(Number.isFinite(s.partyLevel())).toBe(true);
  });
});
