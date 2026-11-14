/** Deterministic pseudo-random helpers. The same inputs always give the same output,
 *  so any moment of the mission can be recomputed without stepping through time. */

/** Hash of (seed, index) to a number in [0, 1). */
export function hash01(seed: number, n: number): number {
  let h = Math.imul(seed | 0, 0x9e3779b1) ^ Math.imul(Math.floor(n) | 0, 0x85ebca6b)
  h ^= h >>> 15
  h = Math.imul(h, 0x2c1b3c6d)
  h ^= h >>> 12
  h = Math.imul(h, 0x297a2d39)
  h ^= h >>> 15
  return (h >>> 0) / 4294967296
}

/** Smooth noise in [-1, 1] that varies over roughly `period` units of t. */
export function smoothNoise(seed: number, t: number, period: number): number {
  const x = t / period
  const i = Math.floor(x)
  const f = x - i
  const u = f * f * (3 - 2 * f)
  const a = hash01(seed, i) * 2 - 1
  const b = hash01(seed, i + 1) * 2 - 1
  return a + (b - a) * u
}
