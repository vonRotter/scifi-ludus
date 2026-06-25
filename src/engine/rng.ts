/**
 * Seedable pseudo-random number generator (mulberry32).
 *
 * Single responsibility: provide deterministic randomness for the engine.
 * MUST NOT: call Math.random(), touch the DOM, or hold game state.
 *
 * The whole simulation's determinism rests on this file. Every random draw
 * in the engine flows through an Rng instance created from an integer seed.
 */

export interface Rng {
  /** Next float in [0, 1). */
  next(): number;
  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number;
  /** Float in [min, max). */
  float(min: number, max: number): number;
  /** True with the given probability (0..1). */
  chance(p: number): boolean;
  /** Pick one element from a non-empty array. */
  pick<T>(items: readonly T[]): T;
}

/**
 * Create an Rng from a 32-bit integer seed.
 * Given the same seed it always yields the same sequence of draws.
 */
export function makeRng(seed: number): Rng {
  let state = seed >>> 0;

  const next = (): number => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    next,
    int: (min, max) => Math.floor(next() * (max - min + 1)) + min,
    float: (min, max) => next() * (max - min) + min,
    chance: (p) => next() < p,
    pick: (items) => items[Math.floor(next() * items.length)],
  };
}

/**
 * Deterministically derive a fresh integer seed from a seed plus a salt.
 * Used to re-seed round two from the match seed, and to seed per-fighter fog.
 */
export function deriveSeed(seed: number, salt: number): number {
  let h = (seed ^ Math.imul(salt + 0x9e3779b9, 0x85ebca6b)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

/** Hash an arbitrary string into a 32-bit integer seed (stable across runs). */
export function hashString(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
