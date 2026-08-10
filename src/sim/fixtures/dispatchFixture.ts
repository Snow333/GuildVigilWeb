import { EventStream } from '@sim/core/events/stream';
import type { RollBreakdown } from '@sim/core/events/types';

/**
 * THE consumer contract fixture: a small but realistic complete dispatch.
 * Every consumer (summary, beat feed, deeds, forecast) must parse this stream.
 * It is deliberately hand-built and FROZEN as the minimal contract. It moved
 * from tests/fixtures in 2.4 so the built artifact can render it for the
 * Playwright half of the exit criterion (#beat-fixture route); the tests
 * re-export from here — the stream itself is unchanged.
 *
 * Shape: travel → dungeon → trap check → fight (kill + a hero downed)
 *        → loot → clue → boss fight → collect → completed.
 */

const roll = (d20: number, mod: number, dc: number, degree: RollBreakdown['degree'], natStep: -1 | 0 | 1 = 0): RollBreakdown =>
  ({ d20, modifier: mod, total: d20 + mod, dc, degree, natStep });

export function buildFixtureDispatch(): EventStream {
  const s = new EventStream('dispatch', 'disp_1');

  s.emit(0, 'dispatch.started', { dispatchId: 'disp_1', partyId: 'party_1', questId: 'q_7', profile: 'bossRush', caution: 'standard' });
  s.emit(0, 'dispatch.travel_leg_started', { fromX: 16, fromY: 38, toX: 24, toY: 31, etaMinutes: 340 });
  s.emit(340, 'dispatch.travel_arrived', { poiId: 'poi_12' });
  const enter = s.emit(340, 'dispatch.dungeon_entered', { dungeonId: 'dg_1', templateId: 't_small_04', seed: 'pop_disp_1_t_small_04' });

  // Entrance room
  const r0 = s.emit(350, 'explore.room_entered', { roomId: 't_small_04:r0', roomType: 'entrance' }, enter.seq);
  s.emit(350, 'explore.area_revealed', { roomIds: ['t_small_04:r0'], corridorIds: ['t_small_04:c0', 't_small_04:c1'] }, r0.seq);

  // Doorway: trap detected and disarmed by the rogue
  const check = s.emit(360, 'explore.entry_check_started', { edgeId: 't_small_04:c0' });
  const det = s.emit(361, 'explore.trap_detected', { roomId: 't_small_04:r1', trapId: 'trap_1', roll: roll(14, 6, 16, 'success'), heroId: 'hero_2' }, check.seq);
  s.emit(362, 'explore.trap_disarm_attempted', { trapId: 'trap_1', roll: roll(11, 8, 16, 'success'), heroId: 'hero_2', retry: 0 }, det.seq);

  // Room 1: a fight
  const r1 = s.emit(370, 'explore.room_entered', { roomId: 't_small_04:r1', roomType: 'combat' });
  const c0 = s.emit(375, 'combat.started', { combatId: 'disp_1:f0', roomId: 't_small_04:r1', sideA: ['hero_1', 'hero_2'], sideB: ['disp_1:e0', 'disp_1:e1'] }, r1.seq);
  const a1 = s.emit(380, 'combat.attack_resolved', { attackerId: 'hero_1', targetId: 'disp_1:e0', weaponBaseId: 'longsword', roll: roll(17, 8, 15, 'critSuccess'), flurryPenalty: 0, flanked: true, sneakDice: 0 }, c0.seq);
  const d1 = s.emit(380, 'combat.damage_applied', { targetId: 'disp_1:e0', amount: 18, kind: 'slashing', hpAfter: 0 }, a1.seq);
  s.emit(380, 'combat.unit_died', { unitId: 'disp_1:e0' }, d1.seq);
  const a2 = s.emit(385, 'combat.attack_resolved', { attackerId: 'disp_1:e1', targetId: 'hero_2', roll: roll(19, 5, 17, 'success'), flurryPenalty: 0, flanked: false }, c0.seq);
  const d2 = s.emit(385, 'combat.damage_applied', { targetId: 'hero_2', amount: 11, kind: 'piercing', hpAfter: 0 }, a2.seq);
  const down = s.emit(385, 'combat.unit_downed', { unitId: 'hero_2', dyingValue: 1 }, d2.seq);
  s.emit(390, 'combat.dying_check_resolved', { unitId: 'hero_2', roll: roll(15, 0, 11, 'success'), dyingAfter: 0 }, down.seq);
  const a3 = s.emit(395, 'combat.attack_resolved', { attackerId: 'hero_1', targetId: 'disp_1:e1', weaponBaseId: 'longsword', roll: roll(12, 8, 15, 'success'), flurryPenalty: -5, flanked: false }, c0.seq);
  const d3 = s.emit(395, 'combat.damage_applied', { targetId: 'disp_1:e1', amount: 9, kind: 'slashing', hpAfter: 0 }, a3.seq);
  s.emit(395, 'combat.unit_died', { unitId: 'disp_1:e1' }, d3.seq);
  const end0 = s.emit(396, 'combat.ended', { combatId: 'disp_1:f0', result: 'victory', ticks: 21 }, c0.seq);
  s.emit(396, 'explore.room_cleared', { roomId: 't_small_04:r1' }, end0.seq);

  // Loot from the fight
  const lr = s.emit(400, 'loot.rolled', { sourceKind: 'enemy', sourceId: 'disp_1:e1', tableId: 'lt_3' }, end0.seq);
  s.emit(400, 'loot.item_generated', { item: { baseId: 'shortbow', tier: 'masterwork', propertyIds: [], seed: 'loot_disp_1_e1' } }, lr.seq);

  // Clue for the arc
  const r2 = s.emit(410, 'explore.room_entered', { roomId: 't_small_04:r2', roomType: 'lore' });
  s.emit(412, 'explore.clue_found', { roomId: 't_small_04:r2', clueId: 'clue_krath_2', arcId: 'arc_krath' }, r2.seq);

  // Boss
  const rb = s.emit(420, 'explore.room_entered', { roomId: 't_small_04:r5', roomType: 'boss' });
  const c1 = s.emit(425, 'combat.started', { combatId: 'disp_1:f1', roomId: 't_small_04:r5', sideA: ['hero_1', 'hero_2'], sideB: ['disp_1:e2'] }, rb.seq);
  const a4 = s.emit(430, 'combat.attack_resolved', { attackerId: 'hero_2', targetId: 'disp_1:e2', weaponBaseId: 'dagger', roll: roll(18, 9, 18, 'success'), flurryPenalty: 0, flanked: true, sneakDice: 2 }, c1.seq);
  const d4 = s.emit(430, 'combat.damage_applied', { targetId: 'disp_1:e2', amount: 21, kind: 'piercing', hpAfter: 0 }, a4.seq);
  s.emit(430, 'combat.unit_died', { unitId: 'disp_1:e2' }, d4.seq);
  const end1 = s.emit(431, 'combat.ended', { combatId: 'disp_1:f1', result: 'victory', ticks: 6 }, c1.seq);
  s.emit(431, 'explore.room_cleared', { roomId: 't_small_04:r5' }, end1.seq);

  // Boss loot honors the source floor (>= magical)
  const lb = s.emit(435, 'loot.rolled', { sourceKind: 'boss', sourceId: 'disp_1:e2', tableId: 'lt_9' }, end1.seq);
  s.emit(435, 'loot.item_generated', { item: { baseId: 'longsword', tier: 'magical', propertyIds: ['flaming'], seed: 'loot_disp_1_e2' } }, lb.seq);

  // Wrap up
  s.emit(440, 'loot.collected', {
    items: [
      { baseId: 'shortbow', tier: 'masterwork', propertyIds: [], seed: 'loot_disp_1_e1' },
      { baseId: 'longsword', tier: 'magical', propertyIds: ['flaming'], seed: 'loot_disp_1_e2' },
    ],
    gold: 74,
  });
  s.emit(440, 'hero.xp_awarded', { heroId: 'hero_1', amount: 90, source: 'combat' });
  s.emit(440, 'hero.xp_awarded', { heroId: 'hero_2', amount: 90, source: 'combat' });
  s.emit(445, 'dispatch.dungeon_exited', { dungeonId: 'dg_1' });
  s.emit(780, 'dispatch.completed', { outcome: 'success' });

  return s;
}
