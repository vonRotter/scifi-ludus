/**
 * Target selection and spacing: who a fighter goes for, and how squads spread.
 *
 * Single responsibility: the pure, deterministic decisions that make fighters
 * BEHAVE differently rather than just roll different numbers — utility-based
 * target scoring (focus fire, threat awareness, finishing the wounded), a
 * boids-style separation term (formations, not blobs), and a cover-seeking
 * offset for ranged roles. No randomness (ties break on the stable seedBase),
 * no React, no state ownership. Depends only on the tick state, so it is
 * side-neutral and the mirror-fairness invariant holds.
 */

import { Arena, Focus } from '../types';
import { RANGED_RANGE } from './combat';
import { dist, lineBlocked } from './geometry';
import { Entity } from './internal';
import { inZone } from './scoring';

// Utility weights. Distance dominates (fights are still mostly local), but the
// kill/threat/zone terms make mentals and the objective visible in behaviour.
const W_DIST = 1.0;
const W_KILL = 0.4;
const W_THREAT = 0.35;
const W_ZONE = 0.45;
/** Base hysteresis bonus for keeping the current target (scaled by discipline). */
const STICK = 0.18;

/** Offensive threat of a candidate, ~0..1 (its best attacking category). */
function threat(e: Entity): number {
  return Math.min(1, Math.max(e.scores.melee, e.scores.ranged) / 20);
}

/**
 * Pick the best enemy for `self` this tick by a weighted utility score:
 * closer, more-wounded, higher-threat and (under objective focus) in-zone
 * targets score higher. A high-awareness fighter leans harder on kill/threat
 * (it reads the fight); a low-discipline one clings to its current mark
 * (over-commits). Hysteresis keeps everyone from flapping every tick.
 * Deterministic: equal scores break on the id-derived seedBase, never order.
 */
export function chooseTarget(self: Entity, entities: Entity[], arena: Arena, focus: Focus): Entity | null {
  const awareFactor = 0.6 + (self.awareness / 20) * 0.8; // 0.64..1.4
  const wKill = W_KILL * awareFactor;
  const wThreat = W_THREAT * awareFactor;
  const wZone = focus === 'objective' ? W_ZONE : W_ZONE * 0.25;
  // Low discipline => stickier (over-commits); everyone gets some hysteresis.
  const stick = STICK * (1.5 - self.discipline / 20);

  let best: Entity | null = null;
  let bestScore = -Infinity;
  for (const e of entities) {
    if (!e.alive || e.side === self.side) continue;
    const d = dist(self.x, self.y, e.x, e.y);
    let score =
      W_DIST * (1 - d / RANGED_RANGE) +
      wKill * (1 - e.hp / e.maxHp) +
      wThreat * threat(e) +
      wZone * (inZone(e, arena) ? 1 : 0);
    if (e.id === self.targetId) score += stick;
    // Deterministic tie-break: prefer the lower seedBase, independent of order.
    if (
      score > bestScore + 1e-9 ||
      (Math.abs(score - bestScore) <= 1e-9 && best && e.seedBase < best.seedBase)
    ) {
      bestScore = score;
      best = e;
    }
  }
  return best;
}

const SEP_RADIUS = 15; // ~2 dot radii in field units
const SEP_STRENGTH = 9; // how hard allies push apart (field units of desired-point nudge)

/**
 * Boids separation: a small repulsion from living allies within SEP_RADIUS,
 * so a squad reads as a formation instead of stacking into one blob. Returns a
 * desired-point offset (already scaled). Symmetric and deterministic.
 */
export function separation(self: Entity, entities: Entity[]): { dx: number; dy: number } {
  let dx = 0;
  let dy = 0;
  for (const o of entities) {
    if (o === self || !o.alive || o.side !== self.side) continue;
    const ox = self.x - o.x;
    const oy = self.y - o.y;
    const d2 = ox * ox + oy * oy;
    if (d2 > SEP_RADIUS * SEP_RADIUS || d2 < 1e-6) continue;
    const d = Math.sqrt(d2);
    const push = (SEP_RADIUS - d) / SEP_RADIUS; // 1 when touching, 0 at the edge
    dx += (ox / d) * push;
    dy += (oy / d) * push;
  }
  return { dx: dx * SEP_STRENGTH, dy: dy * SEP_STRENGTH };
}

const COVER_SAMPLES = 8;
const COVER_OFFSET = 16; // how far to peek for cover (field units)

/**
 * Cover-seeking offset for ranged roles (skirmisher/holdback): sample a ring of
 * deterministic candidate points around `want` and prefer one that keeps line
 * of sight to the current target OPEN while breaking a second threat's line to
 * us (peeking round a pillar). Returns the chosen point, or `want` unchanged if
 * the arena has no obstacles or nothing improves on standing still.
 */
export function coverPoint(
  self: Entity,
  target: Entity,
  entities: Entity[],
  arena: Arena,
  want: { x: number; y: number },
): { x: number; y: number } {
  if (arena.obstacles.length === 0) return want;
  // The nearest OTHER threat whose fire we'd like a wall against.
  let other: Entity | null = null;
  let otherD = Infinity;
  for (const e of entities) {
    if (!e.alive || e.side === self.side || e === target) continue;
    const d = dist(self.x, self.y, e.x, e.y);
    if (d < otherD) { otherD = d; other = e; }
  }
  if (!other) return want;

  // Score a point by whether it hides us from the second threat, then by how far
  // it sits from that threat. BOTH terms are pure geometry, so they commute with
  // a left-right reflection — mirrored fighters pick mirrored points and the
  // fairness invariant is preserved. No directional/index tie-break.
  const coverScore = (px: number, py: number): number =>
    (lineBlocked(px, py, other!.x, other!.y, arena) ? 1 : 0) + 0.01 * dist(px, py, other!.x, other!.y);

  let best = want;
  let bestScore = coverScore(want.x, want.y);
  for (let i = 0; i < COVER_SAMPLES; i++) {
    const ang = (i / COVER_SAMPLES) * Math.PI * 2;
    const cx = want.x + Math.cos(ang) * COVER_OFFSET;
    const cy = want.y + Math.sin(ang) * COVER_OFFSET;
    if (lineBlocked(cx, cy, target.x, target.y, arena)) continue; // must keep our shot
    const score = coverScore(cx, cy);
    if (score > bestScore + 1e-9) { bestScore = score; best = { x: cx, y: cy }; }
  }
  return best;
}
