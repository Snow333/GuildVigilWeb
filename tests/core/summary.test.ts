import { describe, expect, it } from 'vitest';
import { deriveDispatchSummary } from '@sim/core/events/summary';
import { consumeStream } from '@sim/core/events/consume';
import type { SimEvent } from '@sim/core/events/types';
import { buildFixtureDispatch } from '../fixtures/dispatch-fixture';

describe('dispatch summary derivation (the persisted artifact)', () => {
  it('is deterministic: same stream → same summary', () => {
    const a = deriveDispatchSummary(buildFixtureDispatch());
    const b = deriveDispatchSummary(buildFixtureDispatch());
    expect(a).toEqual(b);
  });

  it('derives the fixture correctly (hand-checked values)', () => {
    const s = deriveDispatchSummary(buildFixtureDispatch());

    expect(s.outcome).toBe('completed');
    expect(s.profile).toBe('bossRush');
    expect(s.ticks).toBe(780);

    // hero_1: crit for 18 + follow-up 9 = 27 dealt, 2 kills, no damage taken
    expect(s.heroes['hero_1']).toMatchObject({ damageDealt: 27, damageTaken: 0, kills: 2, timesDowned: 0, died: false, xp: 90 });
    // hero_2: sneak-attacked the boss for 21, took 11, went down once, recovered;
    // checks: trap detect + disarm, both succeeded
    expect(s.heroes['hero_2']).toMatchObject({ damageDealt: 21, damageTaken: 11, kills: 1, timesDowned: 1, died: false, checksAttempted: 2, checksSucceeded: 2, xp: 90 });

    expect(s.combats).toEqual({ count: 2, victories: 2, defeats: 0, fled: 0, stalemates: 0 });
    expect(s.exploration).toMatchObject({ roomsEntered: 4, roomsCleared: 2, trapsDisarmed: 1, trapsTriggered: 0, cluesFound: 1 });
    expect(s.loot.gold).toBe(74);
    expect(s.loot.collected).toHaveLength(2);
    expect(s.loot.collected[1]?.tier).toBe('magical'); // boss floor honored in fixture

    expect(s).toMatchSnapshot();
  });
});

describe('forward-tolerant consumption (constraint: skip-and-log, never crash)', () => {
  it('handles known types and reports — not throws on — unknown ones', () => {
    const stream = buildFixtureDispatch();
    const events = [...stream.all()];
    // Simulate an event type from a FUTURE build:
    events.push({ seq: 999, tick: 800, type: 'future.new_thing', data: { anything: true } } as unknown as SimEvent);

    let rooms = 0;
    const result = consumeStream(events, {
      'explore.room_entered': () => { rooms++; },
    });

    expect(rooms).toBe(4);
    expect(result.handled).toBe(4);
    expect(result.unhandledTypes).toContain('future.new_thing');
  });

  it('the fixture parses with zero unknowns for a full-vocabulary consumer', () => {
    // A consumer that registers every type it cares about should find nothing
    // unexpected in the contract fixture (i.e. the fixture uses only frozen types).
    const stream = buildFixtureDispatch();
    const seen = new Set(stream.all().map((e) => e.type));
    for (const t of seen) expect(t).toMatch(/^(dispatch|explore|combat|hero|loot|world)\./);
  });
});
