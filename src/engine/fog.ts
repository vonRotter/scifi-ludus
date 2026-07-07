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
  CATEGORY_SUBSTATS,
  Fighter,
  FighterStat,
  SubStatKey,
  SubStats,
} from './types';

/** Matches needed before visible combat sub-stats fully reveal. */
const REVEAL_MATCHES = 6;

/** Scouting reports needed to fully reveal a fighter with zero matches played. */
const REVEAL_SCOUT_LEVEL = 4;

/** Category-matches of heavy use that, on their own, fully reveal a category. */
const REVEAL_USAGE = 4;

/** Sub-stats that never fully reveal (true hidden attributes). */
const HIDDEN: ReadonlySet<SubStatKey> = new Set<SubStatKey>(['temperament']);

/** Which category each sub-stat belongs to (reverse of CATEGORY_SUBSTATS). */
const CATEGORY_OF: Record<SubStatKey, Category> = (() => {
  const out = {} as Record<SubStatKey, Category>;
  for (const cat of CATEGORIES) for (const key of CATEGORY_SUBSTATS[cat]) out[key] = cat;
  return out;
})();

/**
 * Rough per-match amount of each usage signal — one bout of heavy work in that
 * category. Dividing by these turns a raw tally into 0..1 "category-matches",
 * so a single blowout can't over-count and the scale composes with match count.
 */
const USAGE_UNIT: Record<Category, number> = {
  melee: 12,   // melee attacks thrown
  ranged: 12,  // shots taken
  defence: 40, // damage absorbed
  speed: 60,   // ticks spent working the objective zone
  mental: 20,  // downs finished + ticks spent under broken nerve
};

/**
 * Turn one bout's tally into the category-matches it's worth — how much you
 * learned about each category by watching this fighter do what they did.
 * Pure; the state layer accumulates the result onto Fighter.usage.
 */
export function usageFromStat(stat: FighterStat): Record<Category, number> {
  return {
    melee: Math.min(1, stat.meleeAttempts / USAGE_UNIT.melee),
    ranged: Math.min(1, stat.rangedAttempts / USAGE_UNIT.ranged),
    defence: Math.min(1, stat.damageTaken / USAGE_UNIT.defence),
    speed: Math.min(1, stat.zoneTicks / USAGE_UNIT.speed),
    mental: Math.min(1, (stat.downsScored * 6 + stat.shakenTicks) / USAGE_UNIT.mental),
  };
}

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

/**
 * Reveal progress 0..1 from matches played, scouting reports, and how much the
 * fighter has exercised this particular category (hidden stats are capped).
 * Usage only accelerates: with no usage it reduces to the old match+scout curve,
 * so old saves and never-fielded fighters read exactly as before.
 */
function progress(matchesPlayed: number, hidden: boolean, scoutLevel: number, usageCat = 0): number {
  const raw = Math.min(1, matchesPlayed / REVEAL_MATCHES + scoutLevel / REVEAL_SCOUT_LEVEL + usageCat / REVEAL_USAGE);
  return hidden ? raw * 0.4 : raw;
}

/** Category-matches this fighter has banked exercising the given category. */
function usageFor(fighter: Fighter, cat: Category): number {
  return fighter.usage?.[cat] ?? 0;
}

/**
 * Estimate one sub-stat for one fighter. The band always contains the truth;
 * the point estimate (`mid`) may sit anywhere inside it.
 */
export function estimateSubStat(fighter: Fighter, key: SubStatKey): Estimate {
  const trueVal = fighter.subStats[key];
  const hidden = HIDDEN.has(key);
  const p = progress(fighter.matchesPlayed, hidden, fighter.scoutLevel, usageFor(fighter, CATEGORY_OF[key]));

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
  const out = {} as Record<Category, Estimate>;
  for (const cat of CATEGORIES) {
    out[cat] = {
      mid: Math.round(mids[cat]),
      low: Math.round(lows[cat]),
      high: Math.round(highs[cat]),
      // A category reads as fully known once match count, scouting, or heavy use
      // of that category has collapsed its band.
      revealed: progress(fighter.matchesPlayed, false, fighter.scoutLevel, usageFor(fighter, cat)) >= 1,
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
