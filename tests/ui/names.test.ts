import { describe, expect, it } from 'vitest';
import { EventStream } from '@sim/core/events/stream';
import { buildFixtureDispatch } from '@sim/fixtures/dispatchFixture';
import { interpretStream } from '../../src/ui/beats/interpret';
import { nameResolver, namesFromStream } from '../../src/ui/beats/names';

const spawn = (s: EventStream, unitId: string, name: string, side: 'heroes' | 'enemies' = 'enemies'): void => {
  s.emit(0, 'combat.unit_spawned', { unitId, side, baseId: '1', name, maxHp: 8, x: 12, y: 5 });
};

describe('namesFromStream — the beat feed stops printing instance ids (brief #12)', () => {
  it('THE BUG: an enemy id resolves to its name, not disp_1:e0', () => {
    const stream = buildFixtureDispatch();
    const names = namesFromStream(stream);
    expect(names.get('disp_1:e2')).toBe('Orc Warrior');
    // Before brief #12 this line read "disp_1:e2", which is what shipped.
    const feed = interpretStream(stream, nameResolver(names));
    const slain = feed.lines.filter((l) => l.text.includes('is slain.'));
    expect(slain.some((l) => l.text.startsWith('Orc Warrior'))).toBe(true);
    expect(feed.lines.some((l) => l.text.includes('disp_1:e'))).toBe(false);
  });

  it('repeats are numbered by SPAWN ORDER; unique names pass through untouched', () => {
    const s = new EventStream('dispatch', 'd');
    s.emit(0, 'combat.started', { combatId: 'c', roomId: 'r', sideA: [], sideB: ['a', 'b', 'c', 'd'] });
    spawn(s, 'a', 'Goblin');
    spawn(s, 'b', 'Goblin');
    spawn(s, 'c', 'Goblin');
    spawn(s, 'd', 'Orc Warrior');
    const names = namesFromStream(s);
    expect(names.get('a')).toBe('Goblin ɪ');
    expect(names.get('b')).toBe('Goblin ɪɪ');
    expect(names.get('c')).toBe('Goblin ɪɪɪ');
    expect(names.get('d')).toBe('Orc Warrior');
  });

  it('is deterministic: the same stream always yields the same labels', () => {
    const build = (): EventStream => {
      const s = new EventStream('dispatch', 'd');
      spawn(s, 'a', 'Goblin');
      spawn(s, 'b', 'Goblin');
      return s;
    };
    expect([...namesFromStream(build())]).toEqual([...namesFromStream(build())]);
  });

  it('the roster layers OVER spawn facts — the player sees the name they gave', () => {
    const s = new EventStream('dispatch', 'd');
    s.emit(0, 'combat.unit_spawned', { unitId: 'hero_1', side: 'heroes', baseId: 'hero_1', name: 'Placeholder', maxHp: 30, x: 2, y: 5 });
    const names = namesFromStream(s, new Map([['hero_1', 'Torvald']]));
    expect(names.get('hero_1')).toBe('Torvald');
  });

  it('unknown ids pass through the resolver unchanged (forward tolerance)', () => {
    const resolve = nameResolver(namesFromStream(new EventStream('dispatch', 'd')));
    expect(resolve('who_is_this')).toBe('who_is_this');
  });

  it('a stream with no spawn facts yields an empty map, never a crash', () => {
    const s = new EventStream('dispatch', 'd');
    s.emit(0, 'combat.started', { combatId: 'c', roomId: 'r', sideA: ['h1'], sideB: ['e1'] });
    expect(namesFromStream(s).size).toBe(0);
  });
});
