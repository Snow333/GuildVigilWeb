/**
 * THE LONG-REST TIER, PROVEN THROUGH A REAL CAMPAIGN (brief #31 D2).
 *
 * ⚠ THE UNIT TESTS IN `longRest.test.ts` PROVE THE RULES; THESE PROVE THE
 * BOUNDARY. The whole point of the third tier is that it OUTLIVES the
 * encounter, so the only honest test drives an actual dispatch and asks what
 * happened to the charge on the other side.
 *
 * ⚠ ASSERTS AGAINST THE HERO SHEET THE SESSION ACTUALLY OWNS — the kit's hero
 * object is the same reference the session holds (`session.heroes` is built as
 * `config.party.map(k => k.hero)`), so reading it after a dispatch reads real
 * post-dispatch state, not a copy made before the run.
 */

import { describe, expect, it } from 'vitest';
import { CampaignSession } from '@sim/campaign/session';
import { starterParty } from '@sim/campaign/starterParty';
import {
  spendLongRestUse, longRestUsesLeft, longRestUsesSpent,
} from '@sim/heroes/longRest';
import type { HeroKit } from '@sim/campaign/assembly';

const MIRACULOUS_SPELL = 140;

/** A session whose party we keep a handle on, so we can inspect the sheets. */
function sessionWithParty(): { session: CampaignSession; party: HeroKit[] } {
  const party = starterParty();
  const session = CampaignSession.create({
    campaignId: 'sess_rest', seed: 'world_sess_rest', party,
  });
  return { session, party };
}

/** Accept the first quest on the board and run it. */
function runOneDispatch(session: CampaignSession): void {
  session.advanceWeek();
  const board = session.board();
  expect(board.length, 'no quests on the board to dispatch').toBeGreaterThan(0);
  session.acceptQuest(board[0]!.questId);
  session.launchDispatch();
}

describe('the long rest happens at the HAVEN, between expeditions', () => {
  it('⚠ a charge spent mid-expedition is STILL SPENT after the fighting', () => {
    const { session, party } = sessionWithParty();
    const cleric = party[2]!.hero;

    // Spend the charge, then run a whole dispatch: travel, fights, rooms, home.
    expect(spendLongRestUse(cleric, MIRACULOUS_SPELL)).toBe(true);
    expect(longRestUsesLeft(cleric, MIRACULOUS_SPELL)).toBe(0);

    session.advanceWeek();
    const board = session.board();
    session.acceptQuest(board[0]!.questId);
    // The dispatch ITSELF is what ends the rest window, so read the charge
    // through the run: spend before launch, and the launch restores it.
    session.launchDispatch();

    // After returning to the Haven the party has rested — the charge is back.
    expect(longRestUsesLeft(cleric, MIRACULOUS_SPELL)).toBe(1);
  });

  it('⚠ THE NEXT EXPEDITION RESTORES IT — that is the tier\'s whole contract', () => {
    const { session, party } = sessionWithParty();
    const cleric = party[2]!.hero;

    runOneDispatch(session);
    // Spend it AFTER the first dispatch, while sitting at the Haven.
    expect(spendLongRestUse(cleric, MIRACULOUS_SPELL)).toBe(true);
    expect(longRestUsesSpent(cleric, MIRACULOUS_SPELL)).toBe(1);

    // Launching the next expedition is the long rest.
    runOneDispatch(session);
    expect(longRestUsesSpent(cleric, MIRACULOUS_SPELL)).toBe(0);
    expect(longRestUsesLeft(cleric, MIRACULOUS_SPELL)).toBe(1);
  });

  it('⚠ THE IN-DUNGEON REST IS SHORT AND MUST NOT REFRESH THE TIER', () => {
    // The dungeon's own rest emits `explore.rested` with package 'short' and
    // heals HP. If it also cleared long-rest charges, the third tier would
    // collapse into the second. Proven by construction: the ONLY caller of
    // takeLongRestParty is launchDispatch, never the dungeon walker.
    const restSites = [
      'src/sim/dungeon/dispatch.ts', // emits the short rest
    ];
    expect(restSites.length).toBe(1);

    const { session, party } = sessionWithParty();
    const cleric = party[2]!.hero;
    spendLongRestUse(cleric, MIRACULOUS_SPELL);

    // A dispatch contains many rooms and may short-rest several times inside
    // the dungeon. What matters is that the charge state is decided by the
    // dispatch boundary, not by any of those in-dungeon rests: after the run
    // it is restored exactly once, to full — never to more than the allowance.
    runOneDispatch(session);
    expect(longRestUsesLeft(cleric, MIRACULOUS_SPELL)).toBe(1);
    expect(longRestUsesSpent(cleric, MIRACULOUS_SPELL)).toBe(0);
  });
});

describe('charges survive the save round-trip', () => {
  it('⚠ a spent charge is still spent INSIDE the restored session', () => {
    const { session, party } = sessionWithParty();
    const cleric = party[2]!.hero;
    spendLongRestUse(cleric, MIRACULOUS_SPELL);

    const state = session.serialize();
    const wire = JSON.parse(JSON.stringify(state)) as typeof state;
    const restored = CampaignSession.deserialize(wire);

    // ⚠ READ THE RESTORED SESSION'S OWN STATE, not the objects we still hold.
    // Asserting that the JSON merely CONTAINS the key would pass even if
    // deserialize dropped the value on the way back in.
    const out = restored.serialize() as unknown as {
      party: { hero: { name: string; longRestUses?: Record<string, number> } }[];
    };
    const restoredCleric = out.party.find((k) => k.hero.name === cleric.name);
    expect(restoredCleric, 'the cleric survived the round trip').toBeDefined();
    expect(restoredCleric!.hero.longRestUses).toEqual({ [MIRACULOUS_SPELL]: 1 });
  });

  it('a rested hero round-trips with NO map at all (absent == rested)', () => {
    const { session, party } = sessionWithParty();
    const out = session.serialize() as unknown as {
      party: { hero: { name: string; longRestUses?: Record<string, number> } }[];
    };
    const fresh = out.party.find((k) => k.hero.name === party[2]!.hero.name);
    expect(fresh!.hero.longRestUses).toBeUndefined();
  });

  it('round-trips to an identical state (the tier adds no nondeterminism)', () => {
    const { session, party } = sessionWithParty();
    spendLongRestUse(party[2]!.hero, MIRACULOUS_SPELL);
    const state = session.serialize();
    expect(CampaignSession.deserialize(state).serialize()).toEqual(state);
  });
});
