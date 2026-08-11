/**
 * FNV-1a — the house string hash. ONE implementation, because two would drift
 * and both are load-bearing: the save signature (platform/envelope) and the
 * deterministic hero-identity backfill (heroes/ancestry) must produce the same
 * number on every machine, forever. No Math.random anywhere near this file.
 *
 * 32-bit FNV-1a: offset basis 0x811c9dc5, prime 0x01000193, Math.imul for the
 * wrap-around multiply (plain * loses precision past 2^53).
 */

export function fnv1a32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Zero-padded 8-char hex — the save envelope's signature format. */
export function fnv1aHex(s: string): string {
  return fnv1a32(s).toString(16).padStart(8, '0');
}

/**
 * Avalanche finalizer (murmur3 fmix32) — REQUIRED before taking `hash % n`.
 *
 * FNV-1a's low bits are weak: the prime is odd, so multiplication preserves
 * parity and bit 0 of the digest is just the XOR-parity of the input bytes.
 * Two namespaced hashes of the same id ("ancestry:hero_7" / "gender:hero_7")
 * therefore have low bits that differ only by the constant the prefix
 * contributes — perfectly correlated, forever. Caught by the ancestry/gender
 * independence test, which found 6 of 12 possible pairs ever occurring.
 *
 * fnv1a32 itself stays untouched: signState's output is a persisted save
 * signature and must not move.
 */
export function mix32(h: number): number {
  let x = h >>> 0;
  x ^= x >>> 16;
  x = Math.imul(x, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return x >>> 0;
}

/** The pick-an-index primitive: namespaced, mixed, bounded. */
export function hashIndex(namespace: string, key: string, length: number): number {
  return length <= 0 ? 0 : mix32(fnv1a32(`${namespace}:${key}`)) % length;
}
