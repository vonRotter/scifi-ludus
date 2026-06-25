/**
 * Attribute math: turn fifteen sub-stats into five effective category scores.
 *
 * Single responsibility: the category-blend and diminishing-returns curve.
 * MUST NOT: read game state, use randomness, or touch React/DOM. Pure functions.
 *
 * Design target ("different bodies, equal effectiveness"): a balanced 12/12/12
 * fighter and a lopsided 18/14/4 fighter should land near each other in a
 * category, while a single maxed sub-stat cannot carry a category alone. We get
 * this by applying a concave (square-root-ish) curve to each sub-stat before a
 * weighted blend, so high values give diminishing marginal return.
 */

import {
  Category,
  CATEGORIES,
  CATEGORY_SUBSTATS,
  CategoryScores,
  Fighter,
  SubStats,
} from './types';
import { STAT_MAX } from './constants';

/** Per-category weights for [sub1, sub2, sub3]. They sum to 1. */
const WEIGHTS: Record<Category, [number, number, number]> = {
  melee: [0.4, 0.4, 0.2],
  ranged: [0.4, 0.35, 0.25],
  defence: [0.4, 0.3, 0.3],
  mental: [0.34, 0.33, 0.33],
  speed: [0.35, 0.35, 0.3],
};

/**
 * Concave response curve. Maps a sub-stat (1..20) onto a 0..1 effectiveness
 * with diminishing returns, then we rescale the blend back to the 1..20 space.
 * Exponent < 1 gives diminishing returns; 0.7 is tuned for the brute/duellist
 * equivalence target.
 */
const CURVE_EXP = 0.7;

function response(value: number): number {
  const clamped = Math.max(0, Math.min(STAT_MAX, value));
  return Math.pow(clamped / STAT_MAX, CURVE_EXP);
}

/** Inverse of `response`, used to map a blended 0..1 back to the 1..20 scale. */
function unresponse(unit: number): number {
  return Math.pow(Math.max(0, Math.min(1, unit)), 1 / CURVE_EXP) * STAT_MAX;
}

/**
 * Effective score for one category given a fighter's sub-stats.
 * Returns a value on the familiar 1..20 scale.
 */
export function categoryScore(subStats: SubStats, category: Category): number {
  const [a, b, c] = CATEGORY_SUBSTATS[category];
  const [wa, wb, wc] = WEIGHTS[category];
  const blended = response(subStats[a]) * wa + response(subStats[b]) * wb + response(subStats[c]) * wc;
  return Math.round(unresponse(blended) * 10) / 10;
}

/** All five effective category scores for a fighter. */
export function categoryScores(subStats: SubStats): CategoryScores {
  const out = {} as CategoryScores;
  for (const cat of CATEGORIES) out[cat] = categoryScore(subStats, cat);
  return out;
}

/**
 * A single overall combat rating (1..20-ish) for ranking and AI selection.
 * Weighted toward the offensive and defensive categories.
 */
export function overall(fighter: Fighter): number {
  const s = categoryScores(fighter.subStats);
  const r = s.melee * 0.3 + s.ranged * 0.2 + s.defence * 0.25 + s.speed * 0.15 + s.mental * 0.1;
  return Math.round(r * 10) / 10;
}
