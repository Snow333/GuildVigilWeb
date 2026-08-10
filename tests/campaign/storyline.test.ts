import { describe, expect, it } from 'vitest';
import { autopilotWeek } from '@sim/campaign/campaign';
import { CampaignSession } from '@sim/campaign/session';
import { starterParty } from '../fixtures/party-fixture';

/**
 * Arc mechanics (brief #6): storyline-gated posting with DERIVED progression,
 * once-only completed beats, pinned boss rosters, dialogue triggers, villain
 * beats, and named regions.
 */

const PRIORITIES = ['perception', 'athletics', 'thievery'] as const;

const newSession = (id: string): CampaignSession =>
  CampaignSession.create({ campaignId: id, seed: `world_${id}`, party: starterParty() });

describe('The Vanguard\'s Shadow — storyline gating', () => {
  it('week 1: the opener posts; successors stay locked', () => {
    const s = newSession('arc_0');
    s.advanceWeek();
    const ids = s.board().map((b) => b.questId);
    expect(ids).toContain(100); // The Burned Granary (sequence 1, game_start)
    expect(ids).not.toContain(101); // locked behind 100
    expect(ids).not.toContain(109); // the captain is ten beats away
  });

  it('completing an arc quest unlocks its successor; completed beats never repost', () => {
    const s = newSession('arc_1');
    // Drive with the autopilot policy until quest 100 completes (it is easiest at ch1).
    let completed100 = false;
    for (let w = 0; w < 12 && !completed100; w++) {
      const { record } = autopilotWeek(s, PRIORITIES);
      if (record?.questId === 100 && record.outcome === 'completed') completed100 = true;
    }
    expect(completed100).toBe(true);
    // 101 becomes eligible on a later week; 100 never posts again.
    let saw101 = false;
    let saw100Again = false;
    for (let w = 0; w < 8; w++) {
      s.advanceWeek();
      const ids = s.board().map((b) => b.questId);
      if (ids.includes(101)) saw101 = true;
      if (ids.includes(100)) saw100Again = true;
    }
    expect(saw101).toBe(true);
    expect(saw100Again).toBe(false); // arc beats happen once
  });

  it('arc progression DERIVES from the completed map: reload mid-arc, gating holds', () => {
    const s = newSession('arc_2');
    for (let w = 0; w < 10; w++) autopilotWeek(s, PRIORITIES);
    const restored = CampaignSession.deserialize(s.serialize());
    s.advanceWeek();
    restored.advanceWeek();
    expect(restored.board().map((b) => b.questId).sort()).toEqual(s.board().map((b) => b.questId).sort());
    expect(restored.serialize()).toEqual(s.serialize());
  });
});

describe('The Vanguard\'s Shadow — pinned bosses, dialogue, villain beats, regions', () => {
  it('an authored bossRoster pins the boss room EXACTLY (population unit pin)', async () => {
    const { populate } = await import('@sim/dungeon/population');
    const { pickTemplate } = await import('@sim/dungeon/pool');
    const template = pickTemplate('tiny', 'dispatch_disp_arc');
    const roster = [107, 104]; // quest 102's authored climax
    const pop = populate(template, 'dispatch_disp_arc', 2, 1, roster);
    const bossRoom = [...pop.rooms.values()].find((r) => r.type === 'boss')!;
    expect(bossRoom.enemyIds).toEqual(roster);
    // And without the override, the band roll still governs (no regression):
    const vanilla = populate(template, 'dispatch_disp_arc', 2, 1);
    const vanillaBoss = [...vanilla.rooms.values()].find((r) => r.type === 'boss')!;
    for (const id of vanillaBoss.enemyIds) expect(id).not.toBe(119); // captain never wanders in
  });

  it('the chain by hand: complete 100 → 101 posts; complete 101 → 102 posts', () => {
    const s = newSession('arc_3');
    const playUntilCompleted = (questId: number): void => {
      for (let guard = 0; guard < 40; guard++) {
        s.advanceWeek();
        if (!s.board().some((b) => b.questId === questId)) continue; // cooldown or crowded week
        s.acceptQuest(questId);
        if (s.launchDispatch().outcome === 'completed') return;
      }
      throw new Error(`quest ${questId} not completed within 40 weeks`);
    };
    playUntilCompleted(100);
    expect([...Array(6)].some(() => { s.advanceWeek(); return s.board().some((b) => b.questId === 101); })).toBe(true);
    playUntilCompleted(101);
    expect([...Array(6)].some(() => { s.advanceWeek(); return s.board().some((b) => b.questId === 102); })).toBe(true);
    expect(s.board().some((b) => b.questId === 103)).toBe(false); // still locked behind 102
  });

  it('dialogue: the Marshal speaks at arc start; the reveal fires only after quest 103', () => {
    const s = newSession('arc_4');
    const atStart = s.pendingDialogue();
    expect(atStart).toHaveLength(1);
    expect(atStart[0]!.speaker).toBe('Marshal Edrin Vale');
    expect(atStart[0]!.choices.length).toBeGreaterThan(0);
    // Not yet: the reveal (trigger 103), pre-boss (108), victory (109).
    expect(atStart.some((d) => d.text.includes('Iron shoes'))).toBe(false);
  });

  it('regions carry authored names', () => {
    const s = newSession('arc_5');
    expect(s.regionName('region_haven')).toBe('The Vigil Lands');
    expect(s.regionName('region_ne')).toBe('The Ashmark');
    expect(s.regionName('region_unmapped')).toBe('region_unmapped'); // graceful fallback
  });

  it('villain beats fire on upward tier crossings', () => {
    const s = newSession('arc_6');
    // Neglect breeds pressure: idle weeks until a region crosses a tier.
    for (let w = 0; w < 8; w++) s.advanceWeek();
    const beats = s.world.byType('world.villain_beat_fired');
    expect(beats.length).toBeGreaterThan(0);
    expect(beats[0]!.data.villainId).toBe('vanguard_captain_ruk_mor_tal');
    expect(beats[0]!.data.beatId).toMatch(/^vanguard_region_/);
  });
});
