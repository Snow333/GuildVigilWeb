import { describe, expect, it } from 'vitest';
import { EventStream } from '@sim/core/events/stream';
import { EVENT_TYPE_MANIFEST } from '@sim/core/events/types';

function fixtureStream(): EventStream {
  const s = new EventStream('dispatch', 'disp_1');
  s.emit(0, 'dispatch.started', { dispatchId: 'disp_1', partyId: 'party_1', profile: 'bossRush', caution: 'standard' });
  const entered = s.emit(10, 'explore.room_entered', { roomId: 't1:r0', roomType: 'entrance' });
  const combat = s.emit(20, 'combat.started', { combatId: 'disp_1:f0', roomId: 't1:r0', sideA: ['hero_1'], sideB: ['disp_1:e0'] }, entered.seq);
  const attack = s.emit(25, 'combat.attack_resolved', {
    attackerId: 'hero_1', targetId: 'disp_1:e0',
    roll: { d20: 18, modifier: 7, total: 25, dc: 15, degree: 'critSuccess', natStep: 0 },
    flurryPenalty: 0, flanked: false,
  }, combat.seq);
  s.emit(25, 'combat.damage_applied', { targetId: 'disp_1:e0', amount: 14, kind: 'slashing', hpAfter: 0 }, attack.seq);
  s.emit(30, 'dispatch.completed', { outcome: 'success' });
  return s;
}

describe('EventStream (constraint #4)', () => {
  it('seq is monotonic and time never goes backwards', () => {
    const s = fixtureStream();
    const events = s.all();
    events.forEach((e, i) => expect(e.seq).toBe(i));
    for (let i = 1; i < events.length; i++) {
      expect(events[i]!.tick).toBeGreaterThanOrEqual(events[i - 1]!.tick);
    }
    expect(() => s.emit(5, 'dispatch.completed', { outcome: 'success' })).toThrow(/backwards/);
  });

  it('cause chains walk to the root; dangling causes terminate, never throw', () => {
    const s = fixtureStream();
    const dmg = s.byType('combat.damage_applied')[0]!;
    const chain = s.chainOf(dmg.seq);
    expect(chain.map((e) => e.type)).toEqual([
      'explore.room_entered', 'combat.started', 'combat.attack_resolved', 'combat.damage_applied',
    ]);
    // Dangling cause: an event referencing a seq that does not exist.
    const s2 = new EventStream('dispatch', 'x');
    s2.emit(0, 'dispatch.started', { dispatchId: 'x', partyId: 'party_1', profile: 'fullExplore', caution: 'bold' }, 999);
    expect(s2.chainOf(0)).toHaveLength(1);
  });

  it('minimum stream contract: started + a terminal event', () => {
    const s = fixtureStream();
    expect(s.byType('dispatch.started')).toHaveLength(1);
    const terminals = [...s.byType('dispatch.completed'), ...s.byType('dispatch.retreated'), ...s.byType('dispatch.wiped')];
    expect(terminals).toHaveLength(1);
  });

  it('hash is stable for identical content (replay verification)', () => {
    expect(fixtureStream().hash()).toBe(fixtureStream().hash());
  });

  it('FREEZE GUARD: the type manifest only ever grows', () => {
    // Renaming or removing an event type breaks every consumer and all
    // persisted summaries. Additions are legal; edits are not. If this
    // snapshot fails because a type vanished or changed spelling: stop.
    expect([...EVENT_TYPE_MANIFEST].sort()).toMatchSnapshot();
    expect(new Set(EVENT_TYPE_MANIFEST).size).toBe(EVENT_TYPE_MANIFEST.length);
  });
});
