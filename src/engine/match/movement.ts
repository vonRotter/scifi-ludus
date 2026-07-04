/**
 * Movement: targeting and per-tick repositioning.
 *
 * Single responsibility: decide where each fighter wants to be (from its role,
 * the team focus and posture) and step it there, avoiding obstacles. Pure and
 * deterministic — no randomness, no React, no state ownership.
 */

import { Arena, Focus, Posture } from '../types';
import { MELEE_RANGE, RANGED_RANGE } from './combat';
import { blocked, clampToField, dist, speedFactorAt } from './geometry';
import { SPEC_SPEED_STEP, specLevel } from '../procurement';
import { Entity } from './internal';

/** Nearest living enemy, or null if none remain. */
export function nearestEnemy(self: Entity, entities: Entity[]): Entity | null {
  let best: Entity | null = null;
  let bestD = Infinity;
  for (const e of entities) {
    if (!e.alive || e.side === self.side) continue;
    const d = dist(self.x, self.y, e.x, e.y);
    // Tie-break on the id-derived seed (NOT array index), so neither side is
    // structurally preferred as a target when distances are equal.
    if (d < bestD - 1e-9 || (Math.abs(d - bestD) <= 1e-9 && best && e.seedBase < best.seedBase)) {
      bestD = d;
      best = e;
    }
  }
  return best;
}

/** Preferred standoff distance from the target for this fighter. */
function preferredRange(self: Entity, focus: Focus, posture: Posture): number {
  let base: number;
  switch (self.role) {
    case 'frontline':
      base = MELEE_RANGE * 0.5;
      break;
    case 'skirmisher':
      base = RANGED_RANGE * 0.6;
      break;
    case 'holdback':
    default:
      base = RANGED_RANGE * 0.85;
      break;
  }
  if (focus === 'melee') base *= 0.7;
  if (posture === 'aggressive') base *= 0.6;
  if (posture === 'defensive') base *= 1.35;
  return base;
}

/**
 * Whether this fighter's role/focus sends it to guard the objective zone
 * rather than chase the nearest enemy. Shared by movement and by the frame
 * snapshot, which reports it to the UI as the fighter's current "action".
 */
export function isGuarding(self: Entity, focus: Focus): boolean {
  return self.role === 'holdback' || (focus === 'objective' && self.role === 'skirmisher');
}

/**
 * The point this fighter is trying to reach this tick. Objective-focused
 * fighters (and all holdbacks under that focus) gravitate to the zone; everyone
 * else holds their preferred range from the nearest enemy.
 */
export function desiredPoint(
  self: Entity,
  target: Entity | null,
  arena: Arena,
  focus: Focus,
  posture: Posture,
): { x: number; y: number } {
  // Holdbacks always guard the zone (so no team concedes it for free);
  // objective focus additionally commits the skirmishers to it.
  const goToObjective = isGuarding(self, focus);
  if (goToObjective || !target) {
    // Spread objective-seekers around a ring instead of stacking them on the
    // exact centre. This avoids degenerate exact-overlap (which amplified
    // tie-break bias) and reads better on screen as a held zone, not a blob.
    // The x-offset flips by side so the two sides' target patterns are left-
    // right mirror images — keeping the zone contest side-fair.
    const ang = (self.seedBase % 360) * (Math.PI / 180);
    const r = arena.objective.r * 0.55;
    const sign = self.side === 'home' ? 1 : -1;
    return {
      x: arena.objective.x + sign * Math.cos(ang) * r,
      y: arena.objective.y + Math.sin(ang) * r,
    };
  }
  const want = preferredRange(self, focus, posture);
  const dx = self.x - target.x;
  const dy = self.y - target.y;
  const d = Math.hypot(dx, dy) || 1;
  return { x: target.x + (dx / d) * want, y: target.y + (dy / d) * want };
}

/** Movement speed in field units per tick, from the speed category — lifted by a
 *  speed-domain specialization (the one spec that always applies, since a faster
 *  fighter is faster whatever they're doing). */
export function moveSpeed(self: Entity): number {
  return (1.1 + self.scores.speed * 0.13) * (1 + specLevel(self.spec, 'speed') * SPEC_SPEED_STEP);
}

/**
 * Step the entity toward (tx,ty) by up to its move speed, trying the straight
 * line first and a few angled detours if an obstacle is in the way. Mutates the
 * entity's position. Deterministic: candidate angles are tried in fixed order.
 */
export function nextStep(self: Entity, tx: number, ty: number, arena: Arena): [number, number] {
  const dx = tx - self.x;
  const dy = ty - self.y;
  const d = Math.hypot(dx, dy);
  if (d < 0.5) return [self.x, self.y];
  // A gravity-shear hazard at the fighter's current position drags on its step.
  const speed = Math.min(moveSpeed(self) * speedFactorAt(self.x, self.y, arena), d);
  const baseAng = Math.atan2(dy, dx);

  // Try the straight line plus symmetric angled detours, and take whichever
  // unblocked step lands CLOSEST to the target. Choosing by distance (instead
  // of "first clockwise option") is reflection-invariant, so mirrored fighters
  // on opposite sides behave as mirror images — no side gets a movement edge.
  const detours = [0, 0.4, -0.4, 0.9, -0.9, 1.4, -1.4];
  let bestX = self.x;
  let bestY = self.y;
  let bestD = Infinity;
  for (const off of detours) {
    const ang = baseAng + off;
    const [cx, cy] = clampToField(
      self.x + Math.cos(ang) * speed,
      self.y + Math.sin(ang) * speed,
      arena,
    );
    if (blocked(cx, cy, arena)) continue;
    const nd = Math.hypot(tx - cx, ty - cy);
    if (nd < bestD - 1e-9) {
      bestD = nd;
      bestX = cx;
      bestY = cy;
    }
  }
  return [bestX, bestY];
}
