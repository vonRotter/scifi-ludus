/**
 * Contracts: how long a fighter is tied to a ludus, and what it costs to keep
 * them. A deal runs down a season at a time; let it lapse and the fighter walks
 * to free agency. Unhappy fighters demand more to re-sign — the point where
 * morale, money, and squad-building meet.
 *
 * Single responsibility: the pure contract rules (default length, when a deal
 * is expiring, the renewal fee). No React, no randomness, no state ownership —
 * the state layer holds each fighter's `contractSeasons` and calls these.
 */

import { overall } from './attributes';
import { moraleOf, NEUTRAL_MORALE } from './morale';
import { Fighter } from './types';

/** Seasons a fresh signing (or a renewal) is tied down for. */
export const RENEW_SEASONS = 3;

/** A fighter's seasons remaining, tolerating the field being absent (old saves). */
export function contractSeasonsOf(fighter: Fighter): number {
  return fighter.contractSeasons ?? 2;
}

/** A deal is "expiring" once it's down to its final season — time to decide. */
export function isExpiring(fighter: Fighter): boolean {
  return contractSeasonsOf(fighter) <= 1;
}

/**
 * The fee to re-sign a fighter, scaled by their quality and — crucially — their
 * morale: a disgruntled fighter wants far more to stay, while a happy one comes
 * cheap. This is what makes keeping an unhappy star a real decision.
 */
export function renewalFee(fighter: Fighter): number {
  const base = 120 + overall(fighter) * 22;
  // Morale 100 -> ~0.7x, neutral -> 1x, 0 -> ~1.6x.
  const moraleFactor = 1 + (NEUTRAL_MORALE - moraleOf(fighter)) / 100;
  return Math.max(50, Math.round(base * moraleFactor));
}

/**
 * The ongoing weekly wage a fighter now commands, from their quality and the
 * career wins they've racked up, nudged by the ludus's reputation (bigger clubs
 * pay more). This is what makes a cheap early signing get expensive once they
 * prove themselves — re-signing ratchets their wage up to it. Never below their
 * current wage: a fighter doesn't ask for a pay cut.
 */
export function wageDemand(fighter: Fighter, teamReputation = 0): number {
  const base = 20 + overall(fighter) * 4 + (fighter.wins ?? 0) * 3;
  const repFactor = 1 + Math.min(0.5, teamReputation / 200);
  return Math.max(fighter.wage, Math.round(base * repFactor));
}

/** Whether a fighter is being paid clearly under what they now command. */
export function isUnderpaid(fighter: Fighter, teamReputation = 0): boolean {
  return wageDemand(fighter, teamReputation) > fighter.wage * 1.15;
}
