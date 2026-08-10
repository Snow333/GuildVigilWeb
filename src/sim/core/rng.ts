/**
 * String-seeded deterministic RNG — architecture constraint #5.
 *
 * Seeds are NAMESPACED STRINGS built from stable entity data, e.g.
 *   `loot_${dispatchId}_${roomId}`
 *   `forecast_${partySize}_${i}`
 * so any derived value is recomputable from facts rather than stored, and
 * concurrent teams' rolls can never perturb each other.
 *
 * Core generator ported from the Dungeons & Dynasties teardown (§3.4):
 * a 32-bit LCG-step + SplitMix-style scramble. One non-obvious detail kept
 * verbatim: a zero hash is remapped to 2654435769 so "" and hash-collisions
 * to zero still produce a working stream.
 */

function hashString(s: string): number {
  // FNV-1a, 32-bit.
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export class Rng {
  private state: number;

  constructor(seed: string | number) {
    this.state = (typeof seed === 'string' ? hashString(seed) : seed) >>> 0;
    if (this.state === 0) this.state = 2654435769;
  }

  /** Uniform float in [0, 1). */
  next(): number {
    this.state = (this.state + 1831565813) >>> 0;
    let e = this.state;
    e = Math.imul(e ^ (e >>> 15), e | 1);
    e ^= e + Math.imul(e ^ (e >>> 7), e | 61);
    return ((e ^ (e >>> 14)) >>> 0) / 4294967296;
  }

  /** Uniform float in [min, max). */
  float(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** Uniform integer in [min, max] (inclusive). */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** d20, d6, etc. */
  die(sides: number): number {
    return this.int(1, sides);
  }

  /** True with probability p (0..1). */
  chance(p: number): boolean {
    return this.next() < p;
  }

  pick<T>(arr: readonly T[]): T {
    if (arr.length === 0) throw new Error('Rng.pick on empty array');
    return arr[this.int(0, arr.length - 1)] as T;
  }

  /** Weighted pick; weights need not sum to anything in particular. */
  weightedPick<T>(items: readonly T[], weights: readonly number[]): T {
    if (items.length === 0 || items.length !== weights.length) {
      throw new Error('Rng.weightedPick: bad inputs');
    }
    let total = 0;
    for (const w of weights) total += w;
    let roll = this.next() * total;
    for (let i = 0; i < items.length; i++) {
      roll -= weights[i] as number;
      if (roll < 0) return items[i] as T;
    }
    return items[items.length - 1] as T;
  }

  /** Fisher–Yates; returns a NEW array, input untouched. */
  shuffle<T>(arr: readonly T[]): T[] {
    const out = arr.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      const tmp = out[i] as T;
      out[i] = out[j] as T;
      out[j] = tmp;
    }
    return out;
  }

  /** Box–Muller. */
  gaussian(mu = 0, sigma = 1): number {
    let u = 0;
    while (u === 0) u = this.next();
    const v = this.next();
    return mu + sigma * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  /** Derive a child stream: child seeds are stable given the parent seed string. */
  static child(parentSeed: string, ...parts: (string | number)[]): Rng {
    return new Rng(`${parentSeed}:${parts.join(':')}`);
  }
}
