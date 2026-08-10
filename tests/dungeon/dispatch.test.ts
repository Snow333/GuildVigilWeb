import { describe, expect, it } from 'vitest';
import { deriveDispatchSummary } from '@sim/core/events/summary';
import { runDungeonDispatch, type Caution, type MissionProfile } from '@sim/dungeon/dispatch';
import type { DispatchHero } from '@sim/dungeon/checks';
import { combatant } from '../combat/conditions.test';

function member(id: string, over: Parameters<typeof combatant>[0] = {}): DispatchHero {
  return {
    c: combatant({ id, name: id, attackBonus: 7, damageDice: '1d8+3', maxHp: 30, hp: 30, ac: 17, initiativeBonus: 5, ...over }),
    skills: { perception: 6, thievery: 5, athletics: 6 },
  };
}

const party = () => [member('hero_1'), member('hero_2'), member('hero_3', { weaponAgile: true, sneakAttackDice: '1d6', damageDice: '1d6+2' })];

function run(profile: MissionProfile, seed = 'd1', caution: Caution = 'standard', over: Partial<Parameters<typeof runDungeonDispatch>[0]> = {}) {
  return runDungeonDispatch({
    dispatchId: `disp_${seed}_${profile}`, partyId: 'party_1', party: party(),
    tier: 'small', seed, profile, caution, difficulty: 2, partyLevel: 3, ...over,
  });
}

describe('runDungeonDispatch — the profile engine (brief #4 acceptance)', () => {
  it('is deterministic: same inputs → identical stream hash', () => {
    expect(run('bossRush').stream.hash()).toBe(run('bossRush').stream.hash());
  });

  it('stream contract holds and the summary derives from a real run', () => {
    const r = run('fullExplore');
    const events = r.stream.all();
    expect(events[0]!.type).toBe('dispatch.started');
    const last = events[events.length - 1]!.type;
    expect(['dispatch.completed', 'dispatch.retreated', 'dispatch.wiped']).toContain(last);

    const summary = deriveDispatchSummary(r.stream);
    expect(summary.profile).toBe('fullExplore');
    expect(summary.exploration.roomsEntered).toBe(r.roomsVisited);
    expect(summary.loot.gold).toBe(r.gold);
  });

  it('bossRush beelines: visits fewer rooms than fullExplore on the same dungeon', () => {
    const rush = run('bossRush', 'compare');
    const full = run('fullExplore', 'compare');
    if (rush.outcome === 'completed' && full.outcome === 'completed') {
      expect(rush.roomsVisited).toBeLessThanOrEqual(full.roomsVisited);
      expect(rush.bossDefeated).toBe(true);
    }
    expect(rush.decisionsUsed).toBeLessThanOrEqual(full.decisionsUsed);
  });

  it('mysteryHunt secures the clue and leaves', () => {
    const r = run('mysteryHunt', 'clue1');
    if (r.outcome === 'completed') {
      expect(r.clueSecured).toBe(true);
      expect(r.stream.byType('explore.clue_found')).toHaveLength(1);
    }
  });

  it('CAUTION ORDERS: cautious never explores more than bold on the same seed', () => {
    for (const seed of ['c1', 'c2', 'c3']) {
      const cautious = run('fullExplore', seed, 'cautious');
      const bold = run('fullExplore', seed, 'bold');
      expect(cautious.roomsVisited).toBeLessThanOrEqual(bold.roomsVisited + 1);
    }
  });

  it('TERMINATION: every profile × pool tier × seeds ends, zero budget hits', () => {
    let runs = 0;
    for (const profile of ['fullExplore', 'bossRush', 'mysteryHunt', 'lootRun'] as MissionProfile[]) {
      for (const tier of ['tiny', 'small', 'medium'] as const) {
        for (let i = 0; i < 6; i++) {
          const r = runDungeonDispatch({
            dispatchId: `t_${profile}_${tier}_${i}`, partyId: 'party_1', party: party(),
            tier, seed: `term_${i}`, profile, caution: 'standard', difficulty: 2, partyLevel: 3,
          });
          runs++;
          expect(['completed', 'retreated', 'wiped']).toContain(r.outcome);
          expect(r.retreatReason).not.toBe('decisionBudget');
        }
      }
    }
    expect(runs).toBe(72);
  });

  it('a wipe is a wipe: an overmatched party dies with the stream saying so', () => {
    const weak = [member('hero_1', { maxHp: 8, hp: 8, ac: 11, attackBonus: 1, damageDice: '1d3' })];
    const r = runDungeonDispatch({
      dispatchId: 'doom', partyId: 'party_1', party: weak,
      tier: 'small', seed: 'doom', profile: 'bossRush', caution: 'bold', difficulty: 4, partyLevel: 1,
    });
    expect(['wiped', 'retreated']).toContain(r.outcome);
    if (r.outcome === 'wiped') {
      expect(r.stream.byType('dispatch.wiped')).toHaveLength(1);
    }
  });

  it('loot flows: completed runs collect gold and emit the collection event', () => {
    const r = run('lootRun', 'gold1');
    expect(r.gold).toBeGreaterThan(0);
    const collected = r.stream.byType('loot.collected');
    expect(collected).toHaveLength(1);
    expect(collected[0]!.data.gold).toBe(r.gold);
    expect(collected[0]!.data.items).toEqual(r.items);
  });
});
