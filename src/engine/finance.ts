/**
 * Finance formulas: wages and prize money.
 *
 * Single responsibility: pure data-in/data-out economics. No React, no DOM,
 * no Math.random, no state ownership — the state layer holds the budget
 * number and calls these to know how it changes.
 */

import { overall } from './attributes';
import { Fighter } from './types';

/** Starting credits for every team at the start of a season. */
export const STARTING_BUDGET = 5000;

/** Prize money paid to each side after a match, by outcome. */
export const PRIZE_WIN = 460;
export const PRIZE_DRAW = 210;
export const PRIZE_LOSS = 90;

/** A fighter's per-fixture wage, scaled by their overall rating. */
export function wageFor(fighter: Fighter): number {
  return 12 + Math.round(overall(fighter) * 2.5);
}

/** Total wage bill for a full roster, paid once per fixture week. */
export function payroll(fighters: Fighter[]): number {
  return fighters.reduce((sum, f) => sum + f.wage, 0);
}

/** End-of-season prize money by final league placement (1-based rank). */
export function placementPrize(rank: number, leagueSize: number): number {
  // Top of the table earns most; it tapers linearly to a small bottom payout.
  const top = 1500;
  const bottom = 220;
  if (leagueSize <= 1) return top;
  const frac = (rank - 1) / (leagueSize - 1); // 0 at 1st, 1 at last
  return Math.round(top - frac * (top - bottom));
}

/** Prize money for one side of a result. */
export function prizeFor(outcome: 'win' | 'draw' | 'loss'): number {
  switch (outcome) {
    case 'win':
      return PRIZE_WIN;
    case 'draw':
      return PRIZE_DRAW;
    case 'loss':
      return PRIZE_LOSS;
  }
}
