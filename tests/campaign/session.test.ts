import { describe, expect, it } from 'vitest';
import { autopilotWeek } from '@sim/campaign/campaign';
import { CampaignSession } from '@sim/campaign/session';
import { starterParty } from '../fixtures/party-fixture';

/**
 * CampaignSession locks — the 2.0 done criteria in executable form:
 * save → reload → identical serialized state, and a reloaded session that
 * CONTINUES identically (the ambush-RNG snapshot doing its job). Stream-level
 * equivalence with Phase 1 is locked by the career harness's exact snapshot.
 */

const PRIORITIES = ['perception', 'athletics', 'thievery'] as const;

const newSession = (id = 'sess_0', seed = 'world_sess_0'): CampaignSession =>
  CampaignSession.create({ campaignId: id, seed, party: starterParty() });

describe('CampaignSession — persistence and resume determinism', () => {
  it('serialize → deserialize → serialize round-trips exactly', () => {
    const s = newSession();
    for (let w = 0; w < 6; w++) autopilotWeek(s, PRIORITIES);
    const state = s.serialize();
    const restored = CampaignSession.deserialize(state);
    expect(restored.serialize()).toEqual(state);
  });

  it('a reloaded session continues EXACTLY like an unreloaded one (12+12 weeks)', () => {
    const original = newSession();
    const toReload = newSession();
    for (let w = 0; w < 12; w++) {
      autopilotWeek(original, PRIORITIES);
      autopilotWeek(toReload, PRIORITIES);
    }
    const resumed = CampaignSession.deserialize(toReload.serialize());
    for (let w = 0; w < 12; w++) {
      autopilotWeek(original, PRIORITIES);
      autopilotWeek(resumed, PRIORITIES);
    }
    // Full-state equality: gold, heroes, board, escalation facts, RNG position.
    expect(resumed.serialize()).toEqual(original.serialize());
  });

  it('a serialized mid-campaign state survives a JSON wire trip (the SaveEnvelope body)', () => {
    const s = newSession();
    for (let w = 0; w < 4; w++) autopilotWeek(s, PRIORITIES);
    const wire = JSON.parse(JSON.stringify(s.serialize()));
    expect(CampaignSession.deserialize(wire).serialize()).toEqual(s.serialize());
  });
});

describe('CampaignSession — command validation', () => {
  it('bad accepts and launches throw before mutating', () => {
    const s = newSession();
    expect(() => s.launchDispatch()).toThrow(/no active quest/);
    s.advanceWeek();
    expect(() => s.acceptQuest(99999)).toThrow(/not on the board/);
    const first = s.board()[0]!;
    s.acceptQuest(first.questId);
    expect(() => s.acceptQuest(first.questId)).toThrow(/already active/);
    expect(s.activeQuest()?.questId).toBe(first.questId);
    expect(s.board().some((b) => b.questId === first.questId)).toBe(false);
  });

  it('applyLevelUp rejects unknown heroes and derives hpPerLevel itself', () => {
    const s = newSession();
    expect(() =>
      s.applyLevelUp('hero_99', { classId: 1, skillRanks: {}, feats: [], autoGrantedFeatIds: [] }),
    ).toThrow(/unknown hero/);
  });
});

describe('CampaignSession — queries derive, never store', () => {
  it('week-1 board entries carry challenge, expiry, pressure, and a reachable path', () => {
    const s = newSession();
    s.advanceWeek();
    const board = s.board();
    expect(board.length).toBeGreaterThan(0);
    for (const b of board) {
      expect(b.challenge).toBeGreaterThanOrEqual(1);
      expect(b.expiresWeek).toBe(b.postedWeek + 2);
      expect(b.pressureTier).toBeGreaterThanOrEqual(0);
      expect(s.travelPreview(b.questId)).not.toBeNull(); // POI placement guarantees reachability
    }
    expect(s.currentWeek()).toBe(1);
    expect(s.goldAmount()).toBe(0);
    expect(s.roster()).toHaveLength(4);
    expect(s.roster().every((r) => r.level === 1)).toBe(true);
  });
});
