/**
 * THE RECORD'S LAYOUT MODEL (brief #24).
 *
 * ⚠ THE REGRESSION THIS GUARDS IS A SILENT FLATTENING. Every failure this
 * module has had so far looked fine to the type checker and left the prose
 * beats untouched, so nothing else in the suite moved:
 *
 *   - keying maxHp off the raw spawn name missed every DUPLICATE unit, because
 *     beats carry disambiguated display names ('Goblin ɪᴠ'), so the hp bar
 *     simply never drew
 *   - grouping damage under the wrong entry loses the blow's outcome
 *   - mutating the input beats made the same array render differently twice
 */
import { describe, it, expect } from 'vitest';
import { buildRecord, TICKS_PER_ROUND, channelFor } from '../../src/ui/beats/record';
import type { BeatLine } from '../../src/ui/beats/interpret';
import type { SpawnFact } from '../../src/ui/screens/fieldReading';

const spawn = (unitId: string, name: string, side: 'heroes' | 'enemies', maxHp: number): SpawnFact =>
  ({ unitId, name, side, baseId: 'b', maxHp, x: 0, y: 0 });

/** Two goblins with the SAME base name — the case that broke the hp bar. */
const SPAWNS: SpawnFact[] = [
  spawn('h1', 'Mira', 'heroes', 18),
  spawn('e1', 'Goblin', 'enemies', 8),
  spawn('e2', 'Goblin', 'enemies', 8),
];

/** The disambiguating resolver, exactly as namesFromStream produces. */
const nameFor = (id: string): string =>
  ({ h1: 'Mira', e1: 'Goblin ɪ', e2: 'Goblin ɪɪ' }[id] ?? id);

const strike = (tick: number, who: string, target: string): BeatLine => ({
  tick, text: `${who} → ${target}: hit`, tone: 'harm',
  parts: { who, pill: 'hit', pillTone: 'harm', verb: 'strikes', target, math: '17 + 2 = 19 vs 15' },
});

const damage = (tick: number, target: string, amount: number, hpAfter: number): BeatLine => ({
  tick, text: `${target} takes ${amount} weapon (${hpAfter} hp left).`, tone: 'harm',
  parts: { effect: { amount, kind: 'weapon', target, hpAfter, tone: 'harm' } },
});

describe('buildRecord', () => {
  it('groups beats into rounds by tick', () => {
    const lines = [strike(0, 'Mira', 'Goblin ɪ'), strike(TICKS_PER_ROUND + 1, 'Mira', 'Goblin ɪɪ')];
    const { rounds } = buildRecord(lines, SPAWNS, nameFor);
    expect(rounds.map((r) => r.n)).toEqual([1, 2]);
  });

  it('⚠ folds a damage beat UNDER the blow that caused it', () => {
    const lines = [strike(1, 'Mira', 'Goblin ɪ'), damage(1, 'Goblin ɪ', 2, 6)];
    const { rounds } = buildRecord(lines, SPAWNS, nameFor);
    expect(rounds[0]!.entries, 'damage became its own top-level row').toHaveLength(1);
    expect(rounds[0]!.entries[0]!.children).toHaveLength(1);
  });

  /**
   * ⚠ THE BUG THAT SHIPPED. Display names are disambiguated per spawn order;
   * spawn facts are not. Keying maxHp off `spawn.name` found 'Goblin' while
   * the beat said 'Goblin ɪ', so hpMax stayed undefined and the bar vanished
   * — with no error, no failing test, and correct-looking numbers beside it.
   */
  it('⚠ resolves hp denominators for DUPLICATE unit names', () => {
    const lines = [damage(1, 'Goblin ɪɪ', 2, 6)];
    const { rounds } = buildRecord(lines, SPAWNS, nameFor);
    const effect = rounds[0]!.entries[0]!.line.parts!.effect!;
    expect(effect.hpMax, 'the hp bar has no denominator for a numbered duplicate').toBe(8);
    expect(effect.hpAfter).toBe(6);
  });

  it('⚠ does not mutate the input beats', () => {
    const lines = [damage(1, 'Goblin ɪ', 2, 6)];
    const before = JSON.stringify(lines);
    buildRecord(lines, SPAWNS, nameFor);
    expect(JSON.stringify(lines), 'buildRecord wrote through to its caller').toBe(before);
  });

  describe('round tallies', () => {
    it('counts damage DEALT and TAKEN from the party point of view', () => {
      const lines = [
        damage(1, 'Goblin ɪ', 5, 3),   // enemy hurt -> dealt
        damage(2, 'Mira', 4, 14),      // hero hurt  -> taken
      ];
      const { rounds } = buildRecord(lines, SPAWNS, nameFor);
      expect(rounds[0]!.tally).toContain('5 damage dealt');
      expect(rounds[0]!.tally).toContain('4 damage taken');
    });

    it('counts kills', () => {
      const lines = [
        strike(1, 'Mira', 'Goblin ɪ'),
        damage(1, 'Goblin ɪ', 8, 0),
        { tick: 1, text: 'Goblin ɪ is slain.', tone: 'slain', parts: { who: 'Goblin ɪ', pill: 'slain' } } as BeatLine,
      ];
      const { rounds } = buildRecord(lines, SPAWNS, nameFor);
      expect(rounds[0]!.tally).toContain('1 kill');
    });
  });

  it('tags the actor with a side, so the column can colour it', () => {
    const { rounds } = buildRecord([strike(1, 'Mira', 'Goblin ɪ')], SPAWNS, nameFor);
    expect(rounds[0]!.entries[0]!.line.parts!.side).toBe('heroes');
  });

  it('keeps prose beats that have no structured parts', () => {
    const plain: BeatLine = { tick: 1, text: 'The party sets out.', tone: 'system' };
    const { rounds } = buildRecord([plain], SPAWNS, nameFor);
    expect(rounds[0]!.entries[0]!.line.text).toBe('The party sets out.');
    expect(rounds[0]!.entries[0]!.line.parts).toBeUndefined();
  });

  /** ⚠ Derived from the engine's tick rate, never a magic number. */
  it('derives a round from the sim tick rate', () => {
    expect(TICKS_PER_ROUND).toBe(60);
  });

  it('maps tones onto stable css channels', () => {
    expect(channelFor('exceptional')).toBe('exceptional');
    expect(channelFor('inert')).toBe('inert');
    expect(channelFor('bad')).toBe('harm');
  });
});
