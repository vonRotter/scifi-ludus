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
import { STAT_MIN } from './constants';
import { Rng } from './rng';
import { traitInjuryMult } from './traits';
import { Fighter, SubStatKey } from './types';

/** Base odds a fielded fighter picks up an injury in a bout, before toughness. */
const BASE_INJURY_CHANCE = 0.1;

/** Physical sub-stats a serious injury can permanently shave. */
const PHYSICAL: readonly SubStatKey[] = [
  'strength', 'agility', 'acceleration', 'stamina', 'manoeuvre', 'reflexes', 'toughness',
];

/**
 * The graded result of a bout's harm. A knock just sidelines; a serious injury
 * also permanently shaves a physical stat; a career-ending one takes the
 * fighter out of the game entirely (retirement or death in the arena).
 */
export type InjuryOutcome =
  | { kind: 'none' }
  | { kind: 'knock'; weeks: number }
  | { kind: 'serious'; weeks: number; statLoss: SubStatKey }
  | { kind: 'ending' };

/** A fighter is fit to field only when fully recovered. */
export function isInjured(fighter: Fighter): boolean {
  return fighter.injuryWeeks > 0;
}

/**
 * Roll a fielded fighter's harm from a bout. Tougher fighters (higher defence)
 * are hurt less often and less badly; Fragile/Iron-hide traits swing both the
 * odds and the severity. Most injuries are knocks, a minority serious, and only
 * a rare few career-ending. Deterministic in `rng`.
 */
export function rollInjury(fighter: Fighter, rng: Rng): InjuryOutcome {
  const defence = categoryScores(fighter.subStats).defence;
  const chance = Math.max(0.02, BASE_INJURY_CHANCE * (1 - defence * 0.03) * traitInjuryMult(fighter));
  if (!rng.chance(chance)) return { kind: 'none' };

  // Severity 0..1, nudged milder for the tough and hardy, worse for the frail.
  let severity = rng.next() + (traitInjuryMult(fighter) - 1) * 0.3 - defence * 0.006;
  if (severity < 0.7) return { kind: 'knock', weeks: rng.int(1, 3) };
  if (severity < 0.94) return { kind: 'serious', weeks: rng.int(3, 6), statLoss: rng.pick(PHYSICAL) };
  return { kind: 'ending' };
}

/**
 * Apply a knock or serious injury to a fighter's stored record: sets the
 * recovery countdown and, for a serious injury, permanently docks a point off
 * the hurt stat. `none` and `ending` are handled by the caller (the latter
 * removes the fighter from the game), so they pass through unchanged.
 */
export function applyInjuryOutcome(fighter: Fighter, outcome: InjuryOutcome): Fighter {
  if (outcome.kind === 'knock') return { ...fighter, injuryWeeks: outcome.weeks };
  if (outcome.kind === 'serious') {
    const subStats = {
      ...fighter.subStats,
      [outcome.statLoss]: Math.max(STAT_MIN, fighter.subStats[outcome.statLoss] - 1),
    };
    return { ...fighter, injuryWeeks: outcome.weeks, subStats };
  }
  return fighter;
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
