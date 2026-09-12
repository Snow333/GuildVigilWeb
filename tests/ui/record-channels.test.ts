/**
 * THE RECORD'S COLOUR CHANNELS (brief #24).
 *
 * ⚠ THE RISK HERE IS SILENT DECORATION. A tone that never gets assigned, or a
 * CSS rule whose token does not exist, produces a record that looks exactly
 * like the old flat one — no error, no failing test, just an unchanged screen.
 * So these tests assert that real events carry the CHANNEL they should, and
 * that every channel a beat can emit actually has a rule keyed to it.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { interpretEvent, type BeatTone } from '../../src/ui/beats/interpret';
import { spellsById } from '@sim/registry';
import type { SimEvent } from '@sim/core/events/types';

const ev = <T extends SimEvent['type']>(type: T, data: unknown, tick = 1): SimEvent =>
  ({ type, data, tick, seq: 1 }) as unknown as SimEvent;

const roll = (degree: string, d20 = 10, modifier = 5, dc = 12) =>
  ({ d20, modifier, total: d20 + modifier, dc, degree }) as never;

describe('⚠ the spell-name bug — the record must not print database ids', () => {
  it('names the spell instead of its id', () => {
    const line = interpretEvent(ev('combat.spell_cast', {
      casterId: 'h1', spellId: '14', resource: 'slot', cost: 1, tier: 1,
    }));
    expect(line?.text).not.toMatch(/spell 14/);
    const real = spellsById.get(14)?.name as string;
    expect(line?.text).toContain(real);
  });

  /**
   * ⚠ THE CASE THAT MOTIVATED THIS. Brief #23 routed every consumable through
   * the casting path, so a potion emitted `combat.spell_cast` and the record
   * printed "casts spell 208" — the whole consumables feature was invisible in
   * the log it exists to appear in.
   */
  it('names a POTION\u2019s spell too, so M3 consumables are visible', () => {
    const potionSpellId = 208;
    const line = interpretEvent(ev('combat.spell_cast', {
      casterId: 'h1', spellId: String(potionSpellId), resource: 'atWill', cost: 0, tier: 0,
    }));
    expect(line?.text).not.toMatch(/spell 208/);
    expect(line?.text).toContain(spellsById.get(potionSpellId)?.name as string);
  });

  it('degrades to a readable form for an unknown id rather than throwing', () => {
    const line = interpretEvent(ev('combat.spell_cast', {
      casterId: 'h1', spellId: '999999', resource: 'slot', cost: 1, tier: 1,
    }));
    expect(line?.text).toContain('spell 999999');
  });
});

describe('⚠ the double-sign bug', () => {
  it('a NEGATIVE modifier reads as a subtraction, not "+-"', () => {
    const line = interpretEvent(ev('combat.attack_resolved', {
      attackerId: 'e1', targetId: 'h1', roll: roll('failure', 3, -3, 15),
    }));
    expect(line?.text, 'the old form printed 3+-3=0').not.toContain('+-');
    expect(line?.text).toContain('3 − 3 = 0');
  });

  it('a positive modifier still reads as an addition', () => {
    const line = interpretEvent(ev('combat.attack_resolved', {
      attackerId: 'h1', targetId: 'e1', roll: roll('success', 12, 8, 15),
    }));
    expect(line?.text).toContain('12 + 8 = 20');
  });
});

describe('⚠ EXPOSURE — attack outcomes carry their own channel', () => {
  const attack = (degree: string) => interpretEvent(ev('combat.attack_resolved', {
    attackerId: 'h1', targetId: 'e1', roll: roll(degree),
  }));

  it('a CRITICAL is "exceptional" — its own channel, not a louder hit', () => {
    expect(attack('critSuccess')?.tone).toBe('exceptional');
  });

  it('a hit is "harm"', () => {
    expect(attack('success')?.tone).toBe('harm');
  });

  /**
   * ⚠ The point of the grey channel: a miss is the ONLY thing in a fight that
   * changed nothing, so it must be visually skippable. In the measured sample
   * fight, misses were 24% of all lines.
   */
  it('a miss is "inert" — nothing happened, the eye may skip it', () => {
    expect(attack('failure')?.tone).toBe('inert');
    expect(attack('critFailure')?.tone).toBe('inert');
  });

  it('the four degrees do NOT all share one tone', () => {
    const tones = new Set(['critSuccess', 'success', 'failure', 'critFailure'].map((d) => attack(d)?.tone));
    expect(tones.size, 'every attack line would look identical').toBeGreaterThan(2);
  });
});

describe('EXPOSURE — the other channels', () => {
  it('damage is harm, healing is resource', () => {
    expect(interpretEvent(ev('combat.damage_applied',
      { targetId: 'e1', amount: 5, kind: 'weapon', hpAfter: 3 }))?.tone).toBe('harm');
    expect(interpretEvent(ev('combat.healing_applied',
      { targetId: 'h1', amount: 5, hpAfter: 18 }))?.tone).toBe('resource');
  });

  it('a death is its own channel, distinct from ordinary damage', () => {
    const died = interpretEvent(ev('combat.unit_died', { unitId: 'e1' }))?.tone;
    const hurt = interpretEvent(ev('combat.damage_applied',
      { targetId: 'e1', amount: 5, kind: 'weapon', hpAfter: 3 }))?.tone;
    expect(died).toBe('slain');
    expect(died).not.toBe(hurt);
  });

  it('spells and conditions are magic; reactions are defence', () => {
    expect(interpretEvent(ev('combat.spell_cast',
      { casterId: 'h1', spellId: '14', resource: 'slot', cost: 1, tier: 1 }))?.tone).toBe('magic');
    expect(interpretEvent(ev('combat.condition_applied',
      { targetId: 'e1', conditionId: 'frightened', value: 1 }))?.tone).toBe('magic');
    expect(interpretEvent(ev('combat.reaction_triggered',
      { unitId: 'h1', reactionId: 'attackOfOpportunity', againstId: 'e1' }))?.tone).toBe('defence');
  });
});

/**
 * ⚠ THE DECORATION GUARD. A tone with no CSS rule renders as an unstyled row —
 * the feature silently does nothing, which is the failure this project keeps
 * hitting. This test reaches the real stylesheet and the real token file.
 */
describe('⚠ every channel is actually wired to a style', () => {
  const css = readFileSync(join(process.cwd(), 'src', 'ui', 'styles', 'screens.css'), 'utf8');
  const tokens = readFileSync(join(process.cwd(), 'src', 'ui', 'styles', 'tokens.css'), 'utf8');

  const CHANNELS: BeatTone[] = ['defence', 'harm', 'magic', 'resource', 'exceptional', 'inert', 'slain'];

  it('each channel has a data-tone rule in screens.css', () => {
    for (const c of CHANNELS) {
      expect(css, `no rule for data-tone='${c}' — beats of that tone render unstyled`)
        .toContain(`data-tone='${c}'`);
    }
  });

  it('each channel token is declared in tokens.css', () => {
    for (const c of CHANNELS) {
      expect(tokens, `--gv-ch-${c} is missing, so its var() resolves to nothing`)
        .toMatch(new RegExp(`--gv-ch-${c}:\\s*#[0-9a-f]{6};`, 'i'));
    }
  });

  /**
   * ⚠ COLOUR IS NEVER THE ONLY CARRIER (WCAG 1.4.1). `inert` is the channel a
   * reader is meant to skip, so it must differ from the others by more than
   * hue — it is dashed AND dimmed.
   */
  it('the inert channel is distinguishable without colour', () => {
    const rule = css.slice(css.indexOf("data-tone='inert'"));
    const body = rule.slice(0, rule.indexOf('}'));
    expect(body, 'inert must not rely on hue alone').toContain('dashed');
  });

  it('the channel palette is NOT the frozen status ramp', () => {
    // Brief #8 froze --gv-s0..s3 as SEVERITY. These channels mean CATEGORY;
    // conflating them would make a critical hit read as "more severe".
    for (const c of ['defence', 'harm', 'magic', 'resource']) {
      const m = new RegExp(`--gv-ch-${c}:\\s*(#[0-9a-f]{6});`, 'i').exec(tokens);
      expect(m, `--gv-ch-${c} not found`).toBeTruthy();
      expect(['#0ca30c', '#fab219', '#ec835a', '#d03b3b']).not.toContain(m![1]!.toLowerCase());
    }
  });
});
