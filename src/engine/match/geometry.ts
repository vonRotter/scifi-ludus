/**
 * Geometry helpers for the match field.
 *
 * Single responsibility: pure 2D math (distance, obstacle blocking, clamping).
 * No state, no randomness, no React.
 */

import { Arena, Hazard, Obstacle } from '../types';

export function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}

/**
 * Whether a hazard is live at a given tick. A hazard with a duty cycle is on for
 * `duty` ticks out of every `period` and off the rest, phase-locked to the
 * global tick counter — so it's deterministic, and both members of a symmetric
 * pair (same period/duty) pulse in lockstep, keeping the field side-fair. A
 * hazard with no cycle is always live.
 */
export function hazardActiveAt(h: Hazard, tick: number): boolean {
  if (!h.period || h.duty === undefined) return true;
  return tick % h.period < h.duty;
}

/**
 * Total plasma-hazard damage a point suffers this tick — the sum of the
 * intensities of every live `plasma` hazard whose radius contains the point.
 * Zero when the point is clear or the arena has no hazards. Position-only (plus
 * the tick, for duty-cycled vents), so it's order-independent and side-fair for
 * symmetrically-placed hazards.
 */
export function hazardDamageAt(x: number, y: number, arena: Arena, tick = 0): number {
  let dmg = 0;
  for (const h of arena.hazards ?? []) {
    if (h.kind === 'plasma' && hazardActiveAt(h, tick) && dist(x, y, h.x, h.y) <= h.r) dmg += h.intensity;
  }
  return dmg;
}

/**
 * Movement-speed multiplier at a point — the product of the intensities of
 * every live `gravwell` hazard containing it (1 when clear). Position-only (plus
 * the tick, for duty-cycled wells), so it's order-independent and side-fair for
 * symmetrically-placed hazards.
 */
export function speedFactorAt(x: number, y: number, arena: Arena, tick = 0): number {
  let factor = 1;
  for (const h of arena.hazards ?? []) {
    if (h.kind === 'gravwell' && hazardActiveAt(h, tick) && dist(x, y, h.x, h.y) <= h.r) factor *= h.intensity;
  }
  return factor;
}

/** Is point (x,y) inside (or touching) an obstacle rectangle? */
export function pointInObstacle(x: number, y: number, o: Obstacle): boolean {
  return x >= o.x && x <= o.x + o.w && y >= o.y && y <= o.y + o.h;
}

/** Is (x,y) blocked by any obstacle in the arena? */
export function blocked(x: number, y: number, arena: Arena): boolean {
  return arena.obstacles.some((o) => pointInObstacle(x, y, o));
}

/** Keep a point inside the arena bounds with a small margin. */
export function clampToField(x: number, y: number, arena: Arena): [number, number] {
  const m = 4;
  return [
    Math.max(m, Math.min(arena.width - m, x)),
    Math.max(m, Math.min(arena.height - m, y)),
  ];
}

/**
 * Crude line-of-sight test: sample points along the segment and check whether
 * any lands inside an obstacle. Good enough for ranged-shot blocking, cheap and
 * deterministic.
 */
export function lineBlocked(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  arena: Arena,
): boolean {
  const steps = Math.max(4, Math.floor(dist(ax, ay, bx, by) / 6));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const px = ax + (bx - ax) * t;
    const py = ay + (by - ay) * t;
    if (blocked(px, py, arena)) return true;
  }
  return false;
}
