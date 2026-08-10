import { describe, expect, it } from 'vitest';
import { countDice, decayFlurry, determineDegree, flurryPenalty, rollDice, rollFlatCheck } from '@sim/combat/dice';
import { Rng } from '@sim/core/rng';

describe('dice parsing (ported from combat_dice.gd)', () => {
  it('composite strings roll within bounds, deterministically', () => {
    const a = new Rng('dice_1');
    const b = new Rng('dice_1');
    for (let i = 0; i < 200; i++) {
      const v = rollDice(a, '2d6+1d4+2');
      expect(v).toBeGreaterThanOrEqual(5);
      expect(v).toBeLessThanOrEqual(18);
      expect(v).toBe(rollDice(b, '2d6+1d4+2'));
    }
  });

  it('flat bonus only, empty string, bare "d8"', () => {
    const r = new Rng('dice_2');
    expect(rollDice(r, '3')).toBe(3);
    expect(rollDice(r, '')).toBe(0);
    const v = rollDice(r, 'd8');
    expect(v).toBeGreaterThanOrEqual(1);
    expect(v).toBeLessThanOrEqual(8);
  });

  it('countDice: "1d10+1d4" → 2, "2d10" → 2, "3" → 1 (floor)', () => {
    expect(countDice('1d10+1d4')).toBe(2);
    expect(countDice('2d10')).toBe(2);
    expect(countDice('3')).toBe(1);
  });
});

describe('PF2E degree of success — the rules table', () => {
  it('crit at DC+10, hit at DC, miss below', () => {
    expect(determineDegree(25, 15, 10).degree).toBe('critSuccess');
    expect(determineDegree(24, 15, 10).degree).toBe('success');
    expect(determineDegree(15, 15, 10).degree).toBe('success');
    expect(determineDegree(14, 15, 10).degree).toBe('failure');
  });

  it('nat 20 STEPS, never forces: vs unreachable AC it is only a hit', () => {
    const r = determineDegree(20 + 5, 40, 20); // total 25 vs AC 40 → failure → stepped to success
    expect(r.degree).toBe('success');
    expect(r.natStep).toBe(1);
    // Already critting: stays crit.
    expect(determineDegree(50, 15, 20).degree).toBe('critSuccess');
  });

  it('nat 1 STEPS down: on an easy target it is only a miss', () => {
    const r = determineDegree(1 + 20, 10, 1); // total 21 ≥ 10+10 → crit → stepped to success? No: crit→success
    expect(r.degree).toBe('success');
    expect(r.natStep).toBe(-1);
    expect(determineDegree(1 + 10, 10, 1).degree).toBe('failure'); // success → failure
    expect(determineDegree(1 + 2, 10, 1).degree).toBe('critFailure'); // failure → critFailure
  });

  it('flat checks: crit fail at nat 1 or DC−10', () => {
    const rng = new Rng('flat');
    for (let i = 0; i < 100; i++) {
      const r = rollFlatCheck(rng, 15);
      if (r.roll >= 25) expect(r.degree).toBe('critSuccess');
      else if (r.roll >= 15) expect(r.degree).toBe('success');
      else if (r.roll === 1 || r.roll <= 5) expect(r.degree).toBe('critFailure');
      else expect(r.degree).toBe('failure');
    }
  });
});

describe('flurry decay — the continuous-time MAP', () => {
  it('penalty ladder matches MAP: 0 / −5 / −10, agile 0 / −4 / −8', () => {
    expect(flurryPenalty(0, false)).toBe(0);
    expect(flurryPenalty(1, false)).toBe(-5);
    expect(flurryPenalty(2, false)).toBe(-10);
    expect(flurryPenalty(5, false)).toBe(-10); // caps
    expect(flurryPenalty(1, true)).toBe(-4);
    expect(flurryPenalty(2, true)).toBe(-8);
  });

  it('decays one step per 30 ticks without swinging', () => {
    expect(decayFlurry(2, 0)).toBe(2);
    expect(decayFlurry(2, 29)).toBe(2);
    expect(decayFlurry(2, 30)).toBe(1);
    expect(decayFlurry(2, 60)).toBe(0);
    expect(decayFlurry(1, 900)).toBe(0); // floors at 0
  });
});
