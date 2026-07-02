/**
 * Scouting: spend credits to narrow the fog on a free-agent prospect.
 *
 * Single responsibility: the cost curve and the pure update to a fighter's
 * scoutLevel. fog.ts is what actually turns scoutLevel into tighter estimate
 * bands — this module only owns "can we afford it" and "what happens to the
 * fighter record." No React, no DOM, no Math.random.
 */

import { applyScoutingDiscount } from './facilities';
import { Fighter } from './types';

/** Beyond this many scouting reports, a prospect is about as known as it gets. */
export const MAX_SCOUT_LEVEL = 4;

/**
 * Credits to commission the next scouting report on a fighter (rises each
 * time). `facilityLevel` is the ludus's scouting network level, which
 * discounts the price.
 */
export function scoutCost(fighter: Fighter, facilityLevel = 0): number {
  const base = 80 + fighter.scoutLevel * 60;
  return applyScoutingDiscount(base, facilityLevel);
}

export function canScout(fighter: Fighter): boolean {
  return fighter.scoutLevel < MAX_SCOUT_LEVEL;
}

/** Commission one scouting report: ratchets the fighter's scoutLevel up by one. */
export function scoutFighter(fighter: Fighter): Fighter {
  if (!canScout(fighter)) return fighter;
  return { ...fighter, scoutLevel: fighter.scoutLevel + 1 };
}
