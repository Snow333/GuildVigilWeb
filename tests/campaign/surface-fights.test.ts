import { describe, expect, it } from 'vitest';
import { CampaignSession, type QuestRecord } from '@sim/campaign/session';
import { combatSegments } from '@sim/core/events/segments';
import { namesFromStream } from '../../src/ui/beats/names';
import { questsById } from '@sim/registry';
import { starterParty } from '../fixtures/party-fixture';

/**
 * Brief #12 milestone 12.1 — surface fights are CARRIED, not discarded.
 *
 * Both sites in launchDispatch used `fight.stream` for killsFrom() XP and then
 * dropped it, which is why PlaybackScreen printed "The mission resolved on the
 * surface (no dungeon record)" for a camp quest and for a road death.
 */

const newSession = (id: string, seed: string): CampaignSession =>
  CampaignSession.create({ campaignId: id, seed, party: starterParty() });

/** Quests that resolve as one stand-up surface fight (`quest_type === 'combat'` + roster). */
const isCampQuest = (questId: number): boolean => {
  const q = questsById.get(questId);
  return q?.quest_type === 'combat' && Boolean(q.enemy_group);
};

/**
 * Play forward until a QuestRecord matching `want` turns up.
 * `choose` picks which posting to take — camp quests are a minority of the
 * board (7 of 22 rows), so taking board[0] blindly rarely reaches one.
 */
function findRecord(
  want: (r: QuestRecord) => boolean,
  choose: (ids: number[]) => number | undefined = (ids) => ids[0],
  maxCampaigns = 12,
  weeksEach = 26,
): QuestRecord | null {
  for (let c = 0; c < maxCampaigns; c++) {
    const s = newSession(`sf_${c}`, `world_sf_${c}`);
    for (let w = 0; w < weeksEach; w++) {
      s.advanceWeek();
      const pick = choose(s.board().map((b) => b.questId));
      if (pick === undefined) continue;
      try {
        s.acceptQuest(pick);
        const rec = s.launchDispatch();
        if (want(rec)) return rec;
      } catch {
        // heroes dead / nothing launchable this week — keep turning weeks
      }
    }
  }
  return null;
}

describe('surface fights reach the record (brief #12)', () => {
  it('a CAMP quest carries its fight, and it segments and names cleanly', () => {
    const rec = findRecord(
      (r) => (r.fights ?? []).some((f) => f.site === 'camp'),
      (ids) => ids.find(isCampQuest),
    );
    expect(rec, 'no camp-quest launch found in the sampled campaigns').not.toBeNull();

    const camp = rec!.fights!.find((f) => f.site === 'camp')!;
    expect(camp.label).toBe('the camp');
    expect(camp.combatId).toMatch(/:camp$/);

    // It is a real, watchable fight: one segment, spawn facts, a result.
    const segs = combatSegments(camp.stream);
    expect(segs).toHaveLength(1);
    expect(segs[0]!.events[0]!.type).toBe('combat.started');
    expect(segs[0]!.result).not.toBeNull();

    const spawns = camp.stream.byType('combat.unit_spawned');
    expect(spawns.length).toBeGreaterThan(1);
    expect(spawns.some((s) => s.data.side === 'heroes')).toBe(true);
    expect(spawns.some((s) => s.data.side === 'enemies')).toBe(true);

    // Every unit in the fight can be labelled — no raw instance ids left.
    const names = namesFromStream(camp.stream);
    for (const s of spawns) expect(names.get(s.data.unitId)).toBeTruthy();
  });

  it('a ROAD AMBUSH carries its fight — including on the ambushKilled early return', () => {
    const rec = findRecord((r) => (r.fights ?? []).some((f) => f.site === 'road'));
    expect(rec, 'no road ambush found in the sampled campaigns').not.toBeNull();

    const road = rec!.fights!.find((f) => f.site === 'road')!;
    expect(road.label).toBe('the road');
    expect(road.combatId).toMatch(/:ambush$/);
    expect(combatSegments(road.stream)).toHaveLength(1);

    // The record is watchable whether the road won or lost. A death on the road
    // is the case that most needed this — it used to return with nothing at all.
    if (rec!.outcome === 'ambushKilled') {
      expect(rec!.dispatch).toBeUndefined();
      expect(rec!.fights).toHaveLength(1);
    }
  });

  it('a DUNGEON quest needs no carrier: its fights already segment out of the dispatch stream', () => {
    const rec = findRecord((r) => r.dispatch !== undefined && (r.dispatch.stream.byType('combat.started').length > 0));
    expect(rec, 'no dungeon launch with a fight found').not.toBeNull();
    const segs = combatSegments(rec!.dispatch!.stream);
    expect(segs.length).toBeGreaterThan(0);
    for (const seg of segs) {
      expect(seg.events[0]!.tick).toBe(0); // re-based, ready to play
      expect(seg.events.some((e) => e.type === 'combat.unit_spawned')).toBe(true);
    }
  });

  it('widening QuestRecord is NOT a save-format change — SessionSaveState is untouched', () => {
    const s = newSession('sf_save', 'world_sf_save');
    s.advanceWeek();
    const before = Object.keys(s.serialize()).sort();

    const pick = s.board()[0]!;
    s.acceptQuest(pick.questId);
    const rec = s.launchDispatch();
    expect(questsById.get(rec.questId)).toBeDefined();

    const state = s.serialize();
    expect(Object.keys(state).sort()).toEqual(before);

    // The record — and any EventStream inside it — never reaches the envelope.
    const wire = JSON.stringify(state);
    expect(wire).not.toContain('combatId');
    expect(wire).not.toContain('unit_spawned');
    expect(CampaignSession.deserialize(JSON.parse(wire)).serialize()).toEqual(state);
  });
});
