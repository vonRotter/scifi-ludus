/**
 * Morale: how buoyant or dejected a fighter feels, and what it does to them.
 *
 * Single responsibility: the pure rules for how results and setbacks move a
 * fighter's morale, the small edge (or drag) it lends in a bout, and its
 * human label. No React, no randomness, no state ownership — the state layer
 * holds each fighter's `morale` and calls these when a result is recorded.
 */

import { Fighter } from './types';

/** Neutral morale a fighter sits at with nothing pulling either way. */
export const NEUTRAL_MORALE = 60;

const clamp = (v: number) => Math.max(0, Math.min(100, v));

/** A fighter's morale, tolerating the field being absent (old saves / stubs). */
export function moraleOf(fighter: Fighter): number {
  return fighter.morale ?? NEUTRAL_MORALE;
}

/** Morale after a match result for a fighter who took the field. */
export function moraleAfterResult(current: number, outcome: 'win' | 'draw' | 'loss'): number {
  const delta = outcome === 'win' ? 6 : outcome === 'draw' ? 1 : -5;
  return clamp(current + delta);
}

/** Extra morale hit from picking up a serious injury. */
export function moraleAfterInjury(current: number): number {
  return clamp(current - 8);
}

/** A fit fighter left on the bench chafes a little. */
export function moraleAfterBenched(current: number): number {
  return clamp(current - 1);
}

/**
 * Apply morale's match-time edge: a confident fighter reads the bout a touch
 * better (awareness/steadiness), a dejected one worse. Bounded to ±2 so it
 * flavours a match without deciding it. Returns a new Fighter; the stored
 * record is untouched, exactly like the trait and facility loadouts.
 */
export function applyMorale(fighter: Fighter): Fighter {
  const shift = Math.max(-2, Math.min(2, Math.round((moraleOf(fighter) - NEUTRAL_MORALE) / 12)));
  if (shift === 0) return fighter;
  const subStats = {
    ...fighter.subStats,
    awareness: fighter.subStats.awareness + shift,
    steadiness: fighter.subStats.steadiness + shift,
  };
  return { ...fighter, subStats };
}

/** A short human label for a morale value. */
export function moraleLabel(morale: number): string {
  if (morale < 30) return 'Dejected';
  if (morale < 45) return 'Low';
  if (morale < 62) return 'Steady';
  if (morale < 80) return 'Good';
  return 'Buoyant';
}
