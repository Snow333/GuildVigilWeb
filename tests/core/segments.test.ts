import { describe, expect, it } from 'vitest';
import { EventStream } from '@sim/core/events/stream';
import { combatSegments } from '@sim/core/events/segments';
import { buildFixtureDispatch } from '@sim/fixtures/dispatchFixture';
import { runEncounter } from '@sim/combat/encounter';
import type { Combatant } from '@sim/combat/types';
import { combatant } from '../combat/conditions.test';

const hero = (id: string): Combatant =>
  combatant({ id, name: id, attackBonus: 7, damageDice: '1d8+3', maxHp: 28, hp: 28, ac: 17 });
const foe = (id: string): Combatant =>
  combatant({ id, name: 'Goblin', baseId: '1', side: 'enemies', isHero: false, attackBonus: 4, damageDice: '1d6+1', maxHp: 10, hp: 10, ac: 14 });

describe('combatSegments — one splitter for both carriers (brief #12)', () => {
  it('finds every fight in a dispatch stream and re-bases its ticks to zero', () => {
    const segs = combatSegments(buildFixtureDispatch());
    expect(segs.map((s) => s.combatId)).toEqual(['disp_1:f0', 'disp_1:f1']);

    const [first, second] = segs;
    expect(first!.startTick).toBe(375);
    expect(first!.result).toBe('victory');
    expect(first!.roomId).toBe('t_small_04:r1');
    // Re-based: a fight always plays from 0 whatever offset it sat at.
    expect(first!.events[0]!.tick).toBe(0);
    expect(first!.events[0]!.type).toBe('combat.started');
    expect(first!.events[first!.events.length - 1]!.type).toBe('combat.ended');
    expect(first!.ticks).toBe(first!.endTick - first!.startTick);
    expect(second!.startTick).toBe(425);
  });

  it('a standalone encounter stream is a single segment, already at zero', () => {
    const r = runEncounter('c1', 'camp', [hero('h1'), hero('h2')], [foe('e0'), foe('e1')], 'seg_solo');
    const segs = combatSegments(r.stream);
    expect(segs).toHaveLength(1);
    expect(segs[0]!.startTick).toBe(0);
    expect(segs[0]!.result).toBe(r.result);
    expect(segs[0]!.events).toHaveLength(r.stream.length);
  });

  it('a stream with no combat yields nothing', () => {
    const s = new EventStream('dispatch', 'd');
    s.emit(0, 'dispatch.started', { dispatchId: 'd', partyId: 'p', profile: 'lootRun', caution: 'standard' });
    s.emit(5, 'explore.room_entered', { roomId: 'r0', roomType: 'entrance' });
    expect(combatSegments(s)).toEqual([]);
  });

  it('a truncated fight is still returned, with a null result — never silently dropped', () => {
    const s = new EventStream('dispatch', 'd');
    s.emit(0, 'combat.started', { combatId: 'c1', roomId: 'r1', sideA: ['h1'], sideB: ['e1'] });
    s.emit(3, 'combat.unit_engaged', { unitId: 'h1', targetId: 'e1' });
    const segs = combatSegments(s);
    expect(segs).toHaveLength(1);
    expect(segs[0]!.result).toBeNull();
    expect(segs[0]!.ticks).toBe(3);
  });

  it('back-to-back fights with no ended between them still separate', () => {
    const s = new EventStream('dispatch', 'd');
    s.emit(0, 'combat.started', { combatId: 'c1', roomId: 'r1', sideA: ['h1'], sideB: ['e1'] });
    s.emit(2, 'combat.unit_engaged', { unitId: 'h1', targetId: 'e1' });
    s.emit(4, 'combat.started', { combatId: 'c2', roomId: 'r2', sideA: ['h1'], sideB: ['e2'] });
    s.emit(6, 'combat.ended', { combatId: 'c2', result: 'victory', ticks: 2 });
    const segs = combatSegments(s);
    expect(segs.map((x) => x.combatId)).toEqual(['c1', 'c2']);
    expect(segs[0]!.result).toBeNull();
    expect(segs[1]!.result).toBe('victory');
  });
});
