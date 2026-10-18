import { describe, expect, it } from 'vitest';
import { CampaignSession, type QuestRecord } from '@sim/campaign/session';
import { questsById } from '@sim/registry';
import type { SimEvent } from '@sim/core/events/types';
import { interpretEvent } from '../../src/ui/beats/interpret';
import { buildMissionSummary } from '../../src/ui/screens/missionSummary';
import { starterParty } from '../fixtures/party-fixture';

/**
 * Track S — the player must be able to SEE what a skill did.
 *
 * Built from REAL launches (accept -> launchDispatch), the same path the game
 * takes, so the party's skills come from assembleHero and the lines come from
 * events a dungeon really emitted. Nothing here hand-writes an event.
 */

function dungeonRecords(name: string, weeks = 40): { records: QuestRecord[]; roster: { id: string; name: string }[] } {
  const session = CampaignSession.create({ campaignId: name, seed: `world_${name}`, party: starterParty() });
  const records: QuestRecord[] = [];
  const isCamp = (id: number): boolean => {
    const q = questsById.get(id);
    return q?.quest_type === 'combat' && !!q.enemy_group;
  };
  for (let w = 0; w < weeks; w++) {
    session.advanceWeek();
    const pick = session.board().filter((b) => !isCamp(b.questId))
      .sort((a, b) => a.challenge - b.challenge || a.questId - b.questId)[0];
    if (!pick) continue;
    session.acceptQuest(pick.questId);
    records.push(session.launchDispatch());
  }
  return { records, roster: session.roster() };
}

const runs = ['skills_a', 'skills_b', 'skills_c'].map((n) => dungeonRecords(n));
const pool = runs.flatMap((r) => r.records.map((rec) => ({ rec, roster: r.roster }))).filter((p) => p.rec.dispatch);

const skillEvents = (rec: QuestRecord) =>
  rec.dispatch!.stream.all().filter((e): e is Extract<SimEvent, { type: 'explore.skill_used' }> => e.type === 'explore.skill_used');
const ok = (e: { data: { roll: { degree: string } } }) => e.data.roll.degree === 'success' || e.data.roll.degree === 'critSuccess';

describe('the mission report says what the four skills did', () => {
  it('real dungeon launches call on the skills (otherwise the rest is vacuous)', () => {
    expect(pool.length).toBeGreaterThan(3);
    expect(pool.filter((p) => skillEvents(p.rec).length > 0).length).toBeGreaterThan(2);
  });

  it('one line per skill used, named by hero, and the counts match the stream', () => {
    let checked = 0;
    for (const { rec, roster } of pool) {
      const events = skillEvents(rec);
      const lines = buildMissionSummary(rec, roster).skillLines;
      const used = new Set(events.map((e) => e.data.skill));
      expect(lines.map((l) => l.skill.toLowerCase()).sort()).toEqual([...used].sort());
      for (const l of lines) {
        const mine = events.filter((e) => e.data.skill === l.skill.toLowerCase());
        const wins = mine.filter(ok);
        const winners = [...new Set(wins.map((e) => roster.find((r) => r.id === e.data.heroId)?.name))];
        expect(l.text).not.toMatch(/hero_\d/);
        if (l.skill === 'Deception' && wins.length > 0) {
          expect(l.text).toContain(`in ${wins.length} of ${mine.length} fight`);
          expect(l.text).toContain(winners[0]!);
        }
        if (l.skill === 'Survival' && wins.length > 0) {
          const hp = wins.reduce((s, e) => s + e.data.amount, 0);
          expect(l.text).toContain(`healed ${hp} more HP`);
        }
        if (l.skill === 'Religion') {
          expect(l.text).toMatch(wins.length > 0 ? /warded the undead in \d+ of \d+ fight/ : /tried to ward the undead/);
        }
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(3);
  });

  it('a mission that never called on a skill shows no Skills lines', () => {
    const quiet = pool.filter((p) => skillEvents(p.rec).length === 0);
    for (const { rec, roster } of quiet) expect(buildMissionSummary(rec, roster).skillLines).toEqual([]);
  });
});

describe('the beat feed has a plain line for every skill outcome', () => {
  const base = { seq: 1, tick: 10 } as const;
  const roll = (degree: 'success' | 'failure') => ({ d20: 12, modifier: 3, total: 15, dc: 14, degree, natStep: 0 as const });
  const line = (effect: 'runes_dispelled' | 'undead_warded' | 'forage' | 'feint', degree: 'success' | 'failure', amount = 2) =>
    interpretEvent(
      { ...base, type: 'explore.skill_used', data: { roomId: 'r1', skill: 'arcana', effect, heroId: 'hero_1', roll: roll(degree), amount } },
      () => 'Elandra',
    )!.text;

  it('names the skill and the hero in every case', () => {
    expect(line('runes_dispelled', 'success')).toMatch(/Elandra.*runes.*Arcana/);
    expect(line('undead_warded', 'success')).toMatch(/Elandra.*ward.*Religion/);
    expect(line('undead_warded', 'failure', 0)).toMatch(/Elandra.*Religion.*fails/);
    expect(line('forage', 'success', 9)).toMatch(/Elandra.*Survival.*9 more/);
    expect(line('forage', 'failure', 0)).toMatch(/Elandra.*Survival/);
    expect(line('feint', 'success')).toMatch(/Elandra.*Deception.*off guard/);
    expect(line('feint', 'failure', 0)).toMatch(/Elandra.*feint fails.*Deception/);
  });
});
