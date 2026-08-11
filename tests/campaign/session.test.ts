import { describe, expect, it } from 'vitest';
import { autopilotWeek } from '@sim/campaign/campaign';
import { CampaignSession, REGION_IDS, regionAnchors, regionFor } from '@sim/campaign/session';
import { storylineByQuestId } from '@sim/registry';
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

describe('chart discovery — brief #8 step 5 (the "?" rule lives in the sim)', () => {
  it('a fresh campaign has surveyed nothing: every posting is discovered=false', () => {
    const s = newSession();
    s.advanceWeek();
    expect(s.board().length).toBeGreaterThan(0);
    expect(s.board().every((b) => !b.discovered)).toBe(true);
  });

  it('completing a quest surveys its POI: the repost carries discovered=true, the rest stay "?"', () => {
    // Hand-driven, no level-ups: the party stays level 1, so the level band keeps
    // the early fillers posting and a completed one can repost after its cooldown
    // (autopilot outlevels the low band before the cooldown lets anything back).
    const s = newSession();
    let surveyedId: number | null = null;
    for (let w = 0; w < 40; w++) {
      s.advanceWeek();
      if (surveyedId !== null) {
        const back = s.board().find((b) => b.questId === surveyedId);
        if (!back) continue; // cooldown or a crowded board — keep waiting
        expect(back.discovered).toBe(true);
        for (const b of s.board()) {
          // The current pool's authored POIs are one-per-quest, so surveyed ⇔
          // completed (shared poi_id would widen discovery — see poiSurveyed).
          expect(b.discovered, `quest ${b.questId}`).toBe(b.questId === surveyedId);
        }
        return;
      }
      // Take the easiest non-arc posting (arc beats happen once — they never repost).
      const pick = s
        .board()
        .filter((b) => !storylineByQuestId.has(b.questId))
        .sort((a, b) => a.challenge - b.challenge || a.questId - b.questId)[0];
      if (!pick) continue;
      s.acceptQuest(pick.questId);
      if (s.launchDispatch().outcome === 'completed') surveyedId = pick.questId;
    }
    expect.fail(`no repost of a completed quest within 40 weeks (completed: ${surveyedId})`);
  });

  it('discovery survives serialize → deserialize (derived from the completed map)', () => {
    const s = newSession();
    for (let w = 0; w < 12; w++) autopilotWeek(s, PRIORITIES);
    const restored = CampaignSession.deserialize(s.serialize());
    expect(restored.board().map((b) => [b.questId, b.discovered])).toEqual(
      s.board().map((b) => [b.questId, b.discovered]),
    );
  });
});

describe('regionAnchors — chart geometry stays inside its partition', () => {
  it('covers all five regions and every anchor lies in the region it draws', () => {
    const anchors = regionAnchors();
    expect(anchors.map((a) => a.regionId).sort()).toEqual([...REGION_IDS].sort());
    for (const a of anchors) {
      expect(regionFor({ x: a.cx, y: a.cy }), a.regionId).toBe(a.regionId);
    }
  });
});
