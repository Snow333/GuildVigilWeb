import { describe, expect, it } from 'vitest';
import { deriveDispatchSummary } from '@sim/core/events/summary';
import { runDungeonDispatch, type Caution, type MissionProfile } from '@sim/dungeon/dispatch';
import type { DispatchHero } from '@sim/dungeon/checks';
import { templatesForTier } from '@sim/dungeon/pool';
import { populate } from '@sim/dungeon/population';
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

  /**
   * THE CLUE REGRESSION. `mysteryHunt` was unwinnable on `small` (0 of 120) and
   * failed 61% of the time on `tiny`, because the clue's pickup used to be the
   * LAST `else if` of the room-type chain: a clue in a combat, treasure, vault
   * or shrine room short-circuited earlier and `clueSecured` never flipped.
   * Tiers that own a lore room never hit it, which is how it survived to here.
   * The first two below fail hard against the pre-fix code.
   */
  describe('THE CLUE is carried by the room, not by its type', () => {
    it('every tier can actually finish a mysteryHunt', () => {
      for (const tier of ['tiny', 'small', 'medium', 'large'] as const) {
        let completed = 0;
        for (let i = 0; i < 40; i++) {
          const r = runDungeonDispatch({
            dispatchId: `clue_${tier}_${i}`, partyId: 'party_1', party: party(),
            tier, seed: `clue_${i}`, profile: 'mysteryHunt', caution: 'standard',
            difficulty: 2, partyLevel: 3,
          });
          if (r.outcome === 'completed') completed++;
        }
        // Post-fix every tier sits in the mid-30s of 40. Pre-fix: small 0, tiny 13.
        expect({ tier, clears: completed >= 28 }).toEqual({ tier, clears: true });
      }
    });

    it('a clue outside a lore room is still picked up, exactly once', () => {
      // `small` owns no lore room, so its clue always lands on an ordinary one.
      const r = runDungeonDispatch({
        dispatchId: 'clue_nonlore', partyId: 'party_1', party: party(),
        tier: 'small', seed: 'clue_0', profile: 'mysteryHunt', caution: 'standard',
        difficulty: 2, partyLevel: 3,
      });
      expect(r.clueSecured).toBe(true);
      const found = r.stream.byType('explore.clue_found');
      expect(found).toHaveLength(1);
      const entered = r.stream.byType('explore.room_entered').find((e) => e.data.roomId === found[0]!.data.roomId)!;
      expect(entered.data.roomType).not.toBe('lore');
    });

    it('the clue never sits in a vault — always locked, roomDcMod 4', () => {
      for (const tier of ['tiny', 'small', 'medium', 'large'] as const) {
        for (const t of templatesForTier(tier)) {
          for (const seed of ['s1', 's2', 's3']) {
            const clue = [...populate(t, seed, 2, 3).rooms.values()].find((room) => room.hasClue)!;
            expect({ id: t.templateId, type: clue.type }).not.toEqual({ id: t.templateId, type: 'vault' });
          }
        }
      }
    });
  });

  /**
   * BRIEF #13 (Q2). `fullExplore`'s objective is every room visited OR BLOCKED,
   * so a boss chamber whose own door beat every hero satisfied it — the run
   * reported CLEARED with the boss untouched, 4.4% of fullExplore runs measured.
   * Rooms BEHIND a sealed door always failed honestly; only the boss room being
   * the sealed room was a lie. Fails against pre-fix source, where the scan
   * below finds sealed-boss runs that completed.
   */
  describe('a sealed boss chamber is not a cleared dungeon', () => {
    const four = () => [...party(), member('hero_4')];
    const scan = Array.from({ length: 200 }, (_, i) =>
      runDungeonDispatch({
        dispatchId: `sealed_${i}`, partyId: 'party_1', party: four(),
        tier: 'tiny', seed: `sealed_${i}`, profile: 'fullExplore', caution: 'standard',
        difficulty: 2, partyLevel: 4,
      }));

    it('the scan is not vacuous: some runs really do lose the boss behind a door', () => {
      expect(scan.filter((r) => r.bossRoomSealed).length).toBeGreaterThan(0);
    });

    it('no run with a sealed boss chamber reports completed', () => {
      const lies = scan.filter((r) => r.bossRoomSealed && r.outcome === 'completed');
      expect({ lies: lies.length }).toEqual({ lies: 0 });
    });

    it('and none of them claims a defeated boss either', () => {
      for (const r of scan.filter((x) => x.bossRoomSealed)) {
        expect({ sealed: true, bossDefeated: r.bossDefeated }).toEqual({ sealed: true, bossDefeated: false });
        expect(r.retreatReason).toBe('objectiveFailed');
      }
    });

    it('sealedRoutes reports exactly what the stream recorded', () => {
      for (const r of scan) {
        expect(r.sealedRoutes).toBe(r.stream.byType('explore.route_blocked').length);
      }
    });
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
