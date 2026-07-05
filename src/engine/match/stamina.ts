/**
 * Fatigue model: an energy pool that drains with effort and recovers with rest.
 *
 * Single responsibility: the pure per-tick energy maths — how far a fighter ran
 * and whether it swung this tick turn into drain, stillness into recovery, and
 * low energy into a soft (never crippling) penalty. No randomness, no state
 * ownership, no React. Every input is the entity's OWN motion and stats, so the
 * rules are side-neutral and the mirror-fairness invariant is untouched.
 */

import { Posture } from '../types';
import { Entity } from './internal';

/** Drain per field unit actually moved (sprinting costs). */
const MOVE_DRAIN = 0.00045;
/** Flat surcharge for throwing an attack this tick. */
const ATTACK_DRAIN = 0.0035;
/** Recovery per tick while standing still and out of combat. */
const RECOVER = 0.0022;
/** The soft penalty floor: even spent, a fighter keeps this fraction of output. */
const FLOOR = 0.6;

/**
 * Effective-output multiplier for a given energy level: a gradual fade from
 * 1.0 (fresh) down to FLOOR (spent), never zero. Applied to both move speed and
 * attack power, so a tiring fighter visibly slows AND hits softer — a smooth
 * curve rather than a degenerate all-or-nothing cliff.
 */
export function energyFactor(energy: number): number {
  return FLOOR + (1 - FLOOR) * energy;
}

/** Posture is a price: pressing hard burns more, sitting back burns less. */
function postureDrain(posture: Posture): number {
  return posture === 'aggressive' ? 1.3 : posture === 'defensive' ? 0.8 : 1.0;
}

/** Higher stamina drains slower (0.64×..1.4× the drain divisor). */
function staminaScale(stamina: number): number {
  return 0.6 + (stamina / 20) * 0.8;
}

/**
 * Advance one entity's energy for a tick. `moved` is the distance it actually
 * covered this tick; `attacked` whether it threw a strike. Mutates `e.energy`,
 * clamped to 0..1. Deterministic — no rng.
 */
export function updateEnergy(e: Entity, moved: number, attacked: boolean, posture: Posture): void {
  const drain =
    ((MOVE_DRAIN * moved + (attacked ? ATTACK_DRAIN : 0)) * postureDrain(posture)) /
    staminaScale(e.stamina);
  const recover = moved < 0.3 && !attacked ? RECOVER : 0;
  e.energy = Math.max(0, Math.min(1, e.energy - drain + recover));
}
