/**
 * Aging: how fighters mature, decline, and retire between seasons.
 *
 * Single responsibility: the pure, seeded rules for a fighter growing a year
 * older — losing a little off their physical sub-stats once past their prime,
 * and eventually hanging up the blade. All randomness flows through an injected
 * Rng; no React, no state ownership. The state layer calls these once per
 * season rollover.
 */

import { Rng } from './rng';
import { STAT_MIN } from './constants';
import { Fighter, SubStatKey } from './types';

/** Past this age, physical sub-stats start to slip. */
export const DECLINE_AGE = 30;
/** Age at which retirement becomes possible, and rises each year after. */
export const RETIRE_AGE = 34;

/** The physical sub-stats that fade with age (mind and aim hold up better). */
const PHYSICAL: readonly SubStatKey[] = [
  'strength', 'agility', 'acceleration', 'stamina', 'manoeuvre', 'reflexes',
];

/**
 * Age a fighter by one year. Once past `DECLINE_AGE`, each physical sub-stat
 * has a growing chance to drop a point — steeper the older they get. Returns a
 * new Fighter; never mutates. Deterministic in `rng`.
 */
export function ageFighter(fighter: Fighter, rng: Rng): Fighter {
  const age = fighter.age + 1;
  if (age <= DECLINE_AGE) return { ...fighter, age };

  const severity = Math.min(0.5, (age - DECLINE_AGE) * 0.08);
  const subStats = { ...fighter.subStats };
  for (const key of PHYSICAL) {
    if (subStats[key] > STAT_MIN && rng.chance(severity)) subStats[key] -= 1;
  }
  return { ...fighter, age, subStats };
}

/**
 * Whether a fighter retires this off-season. Impossible before `RETIRE_AGE`,
 * then climbs each year so careers wind down rather than ending abruptly.
 * Deterministic in `rng`.
 */
export function shouldRetire(fighter: Fighter, rng: Rng): boolean {
  if (fighter.age < RETIRE_AGE) return false;
  const chance = Math.min(0.9, 0.2 + (fighter.age - RETIRE_AGE) * 0.18);
  return rng.chance(chance);
}
