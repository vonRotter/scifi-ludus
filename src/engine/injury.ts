/**
 * Injuries: fighters can be hurt in a bout and miss match weeks while they heal.
 *
 * Single responsibility: the pure rules for whether a fighter is fit, how long
 * a fresh injury sidelines them, and how fast they recover. All randomness
 * flows through an injected Rng (seeded) — never Math.random. No React, no
 * state ownership; the state layer rolls these once per fixture and stores the
 * resulting `injuryWeeks` countdown on each fighter.
 */

import { categoryScores } from './attributes';
import { Rng } from './rng';
import { Fighter } from './types';

/** Base odds a fielded fighter picks up an injury in a bout, before toughness. */
const BASE_INJURY_CHANCE = 0.1;

/** Shortest and longest a fresh injury keeps a fighter out, in match weeks. */
const MIN_INJURY_WEEKS = 1;
const MAX_INJURY_WEEKS = 4;

/** A fighter is fit to field only when fully recovered. */
export function isInjured(fighter: Fighter): boolean {
  return fighter.injuryWeeks > 0;
}

/**
 * Roll whether a fielded fighter is hurt this bout and, if so, for how many
 * match weeks. Tougher fighters (higher defence) are hurt less often. Returns
 * the injury duration to assign, or 0 for no injury. Deterministic in `rng`.
 */
export function rollInjuryWeeks(fighter: Fighter, rng: Rng): number {
  const defence = categoryScores(fighter.subStats).defence;
  const chance = Math.max(0.02, BASE_INJURY_CHANCE * (1 - defence * 0.03));
  if (!rng.chance(chance)) return 0;
  return rng.int(MIN_INJURY_WEEKS, MAX_INJURY_WEEKS);
}

/**
 * Match weeks of healing a fighter gets when a week passes. A medical bay
 * speeds this up, so a higher level clears injuries faster.
 */
export function recoveryStep(medbayLevel: number): number {
  return 1 + medbayLevel;
}

/** Apply one week's recovery to a fighter, clamped at fully healed. */
export function recover(fighter: Fighter, medbayLevel: number): Fighter {
  if (fighter.injuryWeeks <= 0) return fighter;
  const injuryWeeks = Math.max(0, fighter.injuryWeeks - recoveryStep(medbayLevel));
  return { ...fighter, injuryWeeks };
}
