import { describe, expect, it } from 'vitest';
import { Rng } from '@sim/core/rng';

describe('Rng (string-seeded, constraint #5)', () => {
  it('same seed → identical stream', () => {
    const a = new Rng('forecast_4_17');
    const b = new Rng('forecast_4_17');
    for (let i = 0; i < 1000; i++) expect(a.next()).toBe(b.next());
  });

  it('different namespaces → different streams', () => {
    const a = new Rng('loot_disp_1_r1');
    const b = new Rng('loot_disp_1_r2');
    const same = Array.from({ length: 100 }, () => a.next() === b.next()).filter(Boolean).length;
    expect(same).toBeLessThan(5);
  });

  it('zero-hash seed remaps and still produces a stream', () => {
    const r = new Rng(0);
    const v = r.next();
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThan(1);
    expect(r.next()).not.toBe(v);
  });

  it('golden values are stable across builds (replay contract)', () => {
    // If this test ever fails, replay/derivation of every seeded value breaks.
    // Changing the generator is a save-format-level event, not a refactor.
    const r = new Rng('golden_contract');
    const got = Array.from({ length: 4 }, () => r.next());
    expect(got).toMatchSnapshot();
  });

  it('int() covers bounds inclusively and uniformly-ish', () => {
    const r = new Rng('bounds');
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) seen.add(r.int(1, 20));
    expect([...seen].sort((x, y) => x - y)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
  });

  it('weightedPick respects weights within tolerance', () => {
    const r = new Rng('weights');
    let heavy = 0;
    const N = 10_000;
    for (let i = 0; i < N; i++) if (r.weightedPick(['heavy', 'light'], [90, 10]) === 'heavy') heavy++;
    expect(heavy / N).toBeGreaterThan(0.87);
    expect(heavy / N).toBeLessThan(0.93);
  });

  it('shuffle is a permutation and does not mutate input', () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8];
    const r = new Rng('shuffle');
    const out = r.shuffle(input);
    expect(input).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect([...out].sort((a, b) => a - b)).toEqual(input);
  });

  it('child streams are stable and namespaced', () => {
    const a = Rng.child('dispatch_disp_1', 'room', 3);
    const b = Rng.child('dispatch_disp_1', 'room', 3);
    const c = Rng.child('dispatch_disp_1', 'room', 4);
    expect(a.next()).toBe(b.next());
    expect(a.next()).not.toBe(c.next());
  });
});
