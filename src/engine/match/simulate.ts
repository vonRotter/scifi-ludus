/**
 * Match orchestration: run two rounds and produce a MatchResult + timeline.
 *
 * Single responsibility: drive the tick loop, wiring together movement, combat,
 * and scoring, and record render frames. The ONLY source of randomness is the
 * rng built from the per-match seed — never Math.random. No React, no DOM.
 *
 * Determinism contract: simulateMatch(squads, arena, seed) is a pure function.
 * Same inputs -> identical MatchResult. Round two is re-seeded from the match
 * seed so a half-time tactics change re-runs only the second round.
 */

import { FRAME_EVERY, TICKS_PER_ROUND } from '../constants';
import { deriveSeed, makeRng, Rng } from '../rng';
import {
  Arena,
  Frame,
  FighterFrame,
  MatchResult,
  RoundResult,
  Side,
  SquadInput,
  Tactics,
} from '../types';
import {
  AttackKind,
  MELEE_RANGE,
  RANGED_RANGE,
  attackCooldown,
  resolveAttack,
} from './combat';
import { dist, lineBlocked } from './geometry';
import { Entity, ScoreState } from './internal';
import { desiredPoint, isGuarding, nearestEnemy, nextStep } from './movement';
import { awardDown, roundedScore, tickObjective } from './scoring';
import { buildEntities, postureMods } from './setup';

interface SquadTactics {
  home: Tactics;
  away: Tactics;
}

function snapshot(entities: Entity[], score: ScoreState, t: number): Frame {
  const rounded = roundedScore(score);
  const fighters: FighterFrame[] = entities.map((e) => ({
    id: e.id,
    side: e.side,
    x: Math.round(e.x * 10) / 10,
    y: Math.round(e.y * 10) / 10,
    hp: Math.max(0, e.hp / e.maxHp),
    alive: e.alive,
    facing: Math.round(e.facing * 100) / 100,
    action: e.action,
  }));
  return { t, fighters, homeScore: rounded.home, awayScore: rounded.away };
}

/** Decide which attack kind an entity uses against a target at a distance. */
function chooseAttack(self: Entity, d: number, blockedLos: boolean): AttackKind | null {
  if (d <= MELEE_RANGE) return 'melee';
  if (d <= RANGED_RANGE && !blockedLos && self.scores.ranged >= self.scores.melee * 0.6) {
    return 'ranged';
  }
  return null;
}

function sideAlive(entities: Entity[], side: Side): boolean {
  return entities.some((e) => e.alive && e.side === side);
}

interface PendingHit {
  target: Entity;
  dmg: number;
}

/** Run a single round from a fresh seed and full squads. */
function simulateRound(
  home: SquadInput,
  away: SquadInput,
  arena: Arena,
  seed: number,
): RoundResult {
  const entities = [...buildEntities(home, arena, seed), ...buildEntities(away, arena, seed)];
  const mods = {
    home: postureMods(home.tactics.posture),
    away: postureMods(away.tactics.posture),
  };
  const focus = { home: home.tactics.focus, away: away.tactics.focus };
  const score: ScoreState = { home: 0, away: 0 };
  const frames: Frame[] = [snapshot(entities, score, 0)];
  const postures = { home: home.tactics.posture, away: away.tactics.posture };

  for (let t = 1; t <= TICKS_PER_ROUND; t++) {
    // 1. MOVEMENT — decided from the start-of-tick state and applied together,
    //    so movement order never advantages a side.
    const moves = entities.map((self) => {
      if (!self.alive) return null;
      if (self.cooldown > 0) self.cooldown--;
      const target = nearestEnemy(self, entities);
      const want = desiredPoint(self, target, arena, focus[self.side], postures[self.side]);
      // Small per-fighter, per-tick wobble (own rng stream, independent of the
      // combat draws) so paths aren't perfectly straight and identical lineups
      // don't retrace the same line every round — still fully seeded/deterministic.
      const wobble = makeRng(deriveSeed(self.seedBase ^ seed ^ 0x5151, t));
      const wx = want.x + wobble.float(-7, 7);
      const wy = want.y + wobble.float(-7, 7);
      // Default action/facing for this tick; combat below may override to
      // melee/ranged, and movement reaching its target keeps it at guard/chase.
      if (target) self.facing = Math.atan2(target.y - self.y, target.x - self.x);
      self.action = isGuarding(self, focus[self.side]) ? 'guarding' : target ? 'chasing' : 'idle';
      return nextStep(self, wx, wy, arena);
    });
    moves.forEach((m, i) => {
      if (m) [entities[i].x, entities[i].y] = m;
    });

    // 2. COMBAT — every attack is computed from post-move positions, then all
    //    damage is applied SIMULTANEOUSLY. No fighter gets a free first strike,
    //    which is what kept biasing the result toward whoever acted earlier.
    const hits: PendingHit[] = [];
    for (const self of entities) {
      if (!self.alive || self.cooldown > 0) continue;
      const target = nearestEnemy(self, entities);
      if (!target) continue;
      const d = dist(self.x, self.y, target.x, target.y);
      const los = d > MELEE_RANGE && lineBlocked(self.x, self.y, target.x, target.y, arena);
      const kind = chooseAttack(self, d, los);
      if (!kind) continue;
      self.action = kind;
      self.facing = Math.atan2(target.y - self.y, target.x - self.x);
      // Each fighter rolls from its OWN stream (seed ⊕ fighter ⊕ tick), so the
      // randomness is independent of iteration order — no side draws "first".
      const arng: Rng = makeRng(deriveSeed(self.seedBase ^ seed, t));
      const dmg = resolveAttack(self, target, kind, mods[self.side], mods[target.side], arng);
      self.cooldown = attackCooldown(self, kind);
      if (dmg > 0) hits.push({ target, dmg });
    }
    for (const h of hits) h.target.hp -= h.dmg;
    for (const e of entities) {
      if (e.alive && e.hp <= 0) {
        e.alive = false;
        // A fighter can only be hit by its opponents, so the down scores for
        // the other side — order-independent credit.
        awardDown(score, e.side === 'home' ? 'away' : 'home');
      }
    }

    tickObjective(score, entities, arena);
    if (t % FRAME_EVERY === 0) frames.push(snapshot(entities, score, t));
    if (!sideAlive(entities, 'home') || !sideAlive(entities, 'away')) {
      frames.push(snapshot(entities, score, t));
      break;
    }
  }

  const final = roundedScore(score);
  return { homeScore: final.home, awayScore: final.away, frames };
}

/**
 * Resolve a full two-round match. `seed` is the per-match seed; round two is
 * re-seeded deterministically from it so half-time changes affect only round 2.
 */
export function simulateMatch(
  home: SquadInput,
  away: SquadInput,
  arena: Arena,
  seed: number,
  tacticsByRound?: { round2?: SquadTactics },
): MatchResult {
  const r1 = simulateRound(home, away, arena, deriveSeed(seed, 1));

  const home2: SquadInput = { ...home, tactics: tacticsByRound?.round2?.home ?? home.tactics };
  const away2: SquadInput = { ...away, tactics: tacticsByRound?.round2?.away ?? away.tactics };
  const r2 = simulateRound(home2, away2, arena, deriveSeed(seed, 2));

  const homeScore = r1.homeScore + r2.homeScore;
  const awayScore = r1.awayScore + r2.awayScore;
  const winner: Side | 'draw' =
    homeScore > awayScore ? 'home' : awayScore > homeScore ? 'away' : 'draw';

  return { homeScore, awayScore, winner, rounds: [r1, r2] };
}
