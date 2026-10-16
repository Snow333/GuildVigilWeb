import { describe, expect, it } from 'vitest';
import { CampaignSession, type QuestRecord } from '@sim/campaign/session';
import { questsById } from '@sim/registry';
import { deriveDispatchSummary } from '@sim/core/events/summary';
import { buildMissionSummary } from '../../src/ui/screens/missionSummary';
import { starterParty } from '../fixtures/party-fixture';

/**
 * The mission summary is built from REAL launches (the production path:
 * accept → launchDispatch), and every number is checked against
 * `deriveDispatchSummary` — the sim's own tally — computed independently here.
 */

/**
 * Play weeks by hand and collect the records. `dungeons` picks the easiest
 * dungeon posting; otherwise the easiest posting of any kind (a camp fight).
 */
function collectRecords(
  seedName: string,
  dungeons: boolean,
  weeks = 40,
): { session: CampaignSession; records: QuestRecord[] } {
  const session = CampaignSession.create({ campaignId: seedName, seed: `world_${seedName}`, party: starterParty() });
  const records: QuestRecord[] = [];
  const isCamp = (id: number): boolean => {
    const q = questsById.get(id);
    return q?.quest_type === 'combat' && !!q.enemy_group;
  };
  for (let w = 0; w < weeks; w++) {
    session.advanceWeek();
    const pick = session
      .board()
      .filter((b) => (dungeons ? !isCamp(b.questId) : true))
      .sort((a, b) => a.challenge - b.challenge || a.questId - b.questId)[0];
    if (!pick) continue;
    session.acceptQuest(pick.questId);
    records.push(session.launchDispatch());
  }
  return { session, records };
}

const dungeonRuns = ['mission_a', 'mission_b', 'mission_d'].map((n) => collectRecords(n, true));
const campRuns = [collectRecords('mission_a', false)];
const pool = [...dungeonRuns, ...campRuns].flatMap((r) => r.records);
const withDispatch = pool.filter((r) => r.dispatch);
const roster = dungeonRuns[0]!.session.roster();

describe('buildMissionSummary — real launches', () => {
  it('the pool covers dungeon runs (otherwise every test below is vacuous)', () => {
    expect(withDispatch.length).toBeGreaterThan(3);
  });

  it('per-hero numbers equal deriveDispatchSummary and heroes are named, never raw ids', () => {
    let compared = 0;
    for (const record of withDispatch) {
      const expected = deriveDispatchSummary(record.dispatch!.stream);
      const out = buildMissionSummary(record, roster);
      // Surface fights add to these tallies, so only compare records with none.
      if (record.fights) continue;
      for (const row of out.rows) {
        // A hero who stood in the line but never struck, healed or got hit
        // (a dead hero is still mustered) has NO tally entry: that is all zeros.
        const tally = expected.heroes[row.heroId] ?? {
          damageDealt: 0, damageTaken: 0, healingDone: 0, kills: 0, timesDowned: 0, died: false,
        };
        expect(row.name).toBe(roster.find((r) => r.id === row.heroId)!.name);
        expect(row.name).not.toMatch(/^hero_/);
        expect(row.damageDealt).toBe(tally.damageDealt);
        expect(row.damageTaken).toBe(tally.damageTaken);
        expect(row.healingDone).toBe(tally.healingDone);
        expect(row.kills).toBe(tally.kills);
        expect(row.timesDowned).toBe(tally.timesDowned);
        expect(row.died).toBe(tally.died);
        compared++;
      }
    }
    expect(compared).toBeGreaterThan(0);
    // Somebody fought: a table of all zeros would hide a broken tally.
    const total = withDispatch
      .filter((r) => !r.fights)
      .flatMap((r) => buildMissionSummary(r, roster).rows)
      .reduce((s, r) => s + r.damageDealt, 0);
    expect(total).toBeGreaterThan(0);
  });

  it('a completed dungeon says cleared, with the real room and fight counts', () => {
    const done = withDispatch.find((r) => r.outcome === 'completed');
    expect(done, 'a completed dungeon in the pool').toBeDefined();
    const d = done!.dispatch!;
    const wins = deriveDispatchSummary(d.stream).combats.victories;
    const { sentence } = buildMissionSummary(done!, []);
    expect(sentence).toContain('Cleared the dungeon');
    expect(sentence).toContain(`${d.roomsVisited} ${d.roomsVisited === 1 ? 'room' : 'rooms'}`);
    expect(sentence).toContain(`${wins} ${wins === 1 ? 'fight' : 'fights'} won`);
    expect(sentence.includes('boss slain')).toBe(d.bossDefeated);
  });

  it('a retreat says retreated after N rooms and gives a plain reason', () => {
    const retreat = withDispatch.find((r) => r.outcome === 'failed');
    expect(retreat, 'a retreat in the pool').toBeDefined();
    const d = retreat!.dispatch!;
    const { sentence } = buildMissionSummary(retreat!, []);
    expect(sentence).toMatch(/^Retreated after \d+ rooms?\./);
    expect(sentence).toContain(`${d.roomsVisited}`);
  });

  it('a wipe and a road death get their own plain sentences', () => {
    const base = withDispatch[0]!;
    const wiped: QuestRecord = { ...base, outcome: 'wiped', dispatch: { ...base.dispatch!, outcome: 'wiped', roomsVisited: 3 } };
    expect(buildMissionSummary(wiped, []).sentence).toBe('The party was wiped out after 3 rooms.');
    const ambushed: QuestRecord = { week: 1, questId: 1, outcome: 'ambushKilled' };
    expect(buildMissionSummary(ambushed, []).sentence).toBe('The party was cut down by ambushers on the road.');
  });

  it('retreat reasons are put in plain words', () => {
    const base = withDispatch[0]!;
    const make = (reason: string): QuestRecord => ({
      ...base,
      outcome: 'failed',
      dispatch: { ...base.dispatch!, outcome: 'retreated', retreatReason: reason, roomsVisited: 1 },
    });
    expect(buildMissionSummary(make('hardFloor'), []).sentence).toBe('Retreated after 1 room. The party was too hurt to go on.');
    expect(buildMissionSummary(make('playerRecall'), []).sentence).toContain('You called the party back.');
    expect(buildMissionSummary(make('objectiveFailed'), []).sentence).toContain('could not reach its goal');
  });

  it('no jargon in any sentence', () => {
    for (const r of pool) {
      expect(buildMissionSummary(r, []).sentence).not.toMatch(/dispatch|tick|event/i);
    }
  });

  it('surface fights (camp quests) merge their tallies and are named', () => {
    const camp = pool.find((r) => r.fights && !r.dispatch && r.outcome !== 'ambushKilled');
    expect(camp, 'a camp quest in the pool').toBeDefined();
    const out = buildMissionSummary(camp!, roster);
    const expected = camp!.fights!.map((f) => deriveDispatchSummary(f.stream));
    expect(out.rows.length).toBeGreaterThan(0);
    for (const row of out.rows) {
      const sum = (pick: (t: ReturnType<typeof deriveDispatchSummary>['heroes'][string]) => number): number =>
        expected.reduce((s, e) => s + (e.heroes[row.heroId] ? pick(e.heroes[row.heroId]!) : 0), 0);
      expect(row.damageDealt).toBe(sum((t) => t.damageDealt));
      expect(row.damageTaken).toBe(sum((t) => t.damageTaken));
      expect(row.kills).toBe(sum((t) => t.kills));
    }
    expect(out.sentence).toMatch(/camp/);
  });
});
