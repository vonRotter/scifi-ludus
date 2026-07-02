/**
 * Fog of imperfect information: estimate a fighter's hidden true values.
 *
 * Single responsibility: turn true sub-stats into player-visible estimates
 * (bands + a possibly-wrong point estimate) that narrow with experience.
 * MUST NOT: mutate fighters, use Math.random, or touch React/DOM.
 *
 * Determinism: the estimate for a given fighter+stat is stable (seeded from the
 * fighter id), so the UI shows the same numbers every render until the fighter
 * plays more matches. The player should be regularly surprised but never blind.
 */

import { categoryScores } from './attributes';
import { STAT_MAX, STAT_MIN } from './constants';
import { makeRng, hashString, deriveSeed } from './rng';
import {
  Category,
  CATEGORIES,
  Fighter,
  SubStatKey,
  SubStats,
} from './types';

/** Matches needed before visible combat sub-stats fully reveal. */
const REVEAL_MATCHES = 6;

/** Scouting reports needed to fully reveal a fighter with zero matches played. */
const REVEAL_SCOUT_LEVEL = 4;

/** Sub-stats that never fully reveal (true hidden attributes). */
const HIDDEN: ReadonlySet<SubStatKey> = new Set<SubStatKey>(['temperament']);

export interface Estimate {
  /** Possibly-wrong point estimate to display. */
  mid: number;
  /** Band guaranteed to contain the true value. */
  low: number;
  high: number;
  /** True once the band has collapsed to the real value. */
  revealed: boolean;
}

const clamp = (v: number) => Math.max(STAT_MIN, Math.min(STAT_MAX, Math.round(v)));

/** Reveal progress 0..1 from matches played and scouting reports (hidden stats are capped). */
function progress(matchesPlayed: number, hidden: boolean, scoutLevel: number): number {
  const raw = Math.min(1, matchesPlayed / REVEAL_MATCHES + scoutLevel / REVEAL_SCOUT_LEVEL);
  return hidden ? raw * 0.4 : raw;
}

/**
 * Estimate one sub-stat for one fighter. The band always contains the truth;
 * the point estimate (`mid`) may sit anywhere inside it.
 */
export function estimateSubStat(fighter: Fighter, key: SubStatKey): Estimate {
  const trueVal = fighter.subStats[key];
  const hidden = HIDDEN.has(key);
  const p = progress(fighter.matchesPlayed, hidden, fighter.scoutLevel);

  if (!hidden && p >= 1) {
    return { mid: trueVal, low: trueVal, high: trueVal, revealed: true };
  }

  const baseHalf = hidden ? 7 : 5;
  const half = Math.max(hidden ? 3 : 1, baseHalf * (1 - p));
  const rng = makeRng(deriveSeed(hashString(fighter.id), hashString(key)));
  const bias = rng.float(-half * 0.7, half * 0.7);

  return {
    mid: clamp(trueVal + bias),
    low: clamp(trueVal - half),
    high: clamp(trueVal + half),
    revealed: false,
  };
}

/** Estimates for all fifteen sub-stats. */
export function estimateAll(fighter: Fighter): Record<SubStatKey, Estimate> {
  const out = {} as Record<SubStatKey, Estimate>;
  for (const key of Object.keys(fighter.subStats) as SubStatKey[]) {
    out[key] = estimateSubStat(fighter, key);
  }
  return out;
}

/** Estimated effective score per category, derived from the `mid` estimates. */
export function estimateCategories(fighter: Fighter): Record<Category, Estimate> {
  const est = estimateAll(fighter);
  const midStats = {} as SubStats;
  const lowStats = {} as SubStats;
  const highStats = {} as SubStats;
  for (const key of Object.keys(est) as SubStatKey[]) {
    midStats[key] = est[key].mid;
    lowStats[key] = est[key].low;
    highStats[key] = est[key].high;
  }
  const mids = categoryScores(midStats);
  const lows = categoryScores(lowStats);
  const highs = categoryScores(highStats);
  const revealed = progress(fighter.matchesPlayed, false, fighter.scoutLevel) >= 1;
  const out = {} as Record<Category, Estimate>;
  for (const cat of CATEGORIES) {
    out[cat] = {
      mid: Math.round(mids[cat]),
      low: Math.round(lows[cat]),
      high: Math.round(highs[cat]),
      revealed,
    };
  }
  return out;
}

/** Coarse, never-exact label for the hidden Potential value (Phase 2 growth). */
export function potentialBand(fighter: Fighter): string {
  const rng = makeRng(deriveSeed(hashString(fighter.id), hashString('potential')));
  const noisy = fighter.potential + rng.float(-3, 3);
  if (noisy < 7) return '★☆☆☆☆ — limited';
  if (noisy < 10) return '★★☆☆☆ — modest';
  if (noisy < 13) return '★★★☆☆ — promising';
  if (noisy < 16) return '★★★★☆ — high';
  return '★★★★★ — exceptional';
}
