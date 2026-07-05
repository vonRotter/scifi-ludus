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
  Fighter,
  Frame,
  FighterFrame,
  MatchEvent,
  MatchResult,
  MatchStats,
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
import { mergeStats } from './events';
import { dist, hazardDamageAt, lineBlocked } from './geometry';
import { Entity, ScoreState } from './internal';
import { desiredPoint, isGuarding, nextStep } from './movement';
import { computeRatings } from './ratings';
import { awardDown, inZone, roundedScore, tickObjective } from './scoring';
import { buildEntities, postureMods } from './setup';
import { updateEnergy } from './stamina';
import { chooseTarget, coverPoint, separation } from './targeting';

/** A round's public result plus the internal end-of-round energy snapshot. */
interface RoundRun {
  round: RoundResult;
  /** Each fighter's remaining energy, to carry into the next round. */
  endEnergy: Record<string, number>;
}

interface SquadTactics {
  home: Tactics;
  away: Tactics;
}

/** Half-time overrides for round two: new tactics and/or substituted squads. */
interface RoundTwoOverrides {
  /** Replacement tactics per side (defaults to each side's round-one tactics). */
  round2?: SquadTactics;
  /** Replacement fighter lists per side for substitutions (defaults to round one).
   *  Fresh legs not present in round one enter at full energy. */
  round2Fighters?: { home?: Fighter[]; away?: Fighter[] };
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
    energy: Math.round(e.energy * 100) / 100,
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
  attacker: Entity;
  target: Entity;
  kind: AttackKind;
  dmg: number;
}

/** Run a single round from a fresh seed and full squads. `energyIn` seeds each
 *  fighter's starting fatigue (round two carries round one's end-state). */
function simulateRound(
  home: SquadInput,
  away: SquadInput,
  arena: Arena,
  seed: number,
  energyIn?: Record<string, number>,
): RoundRun {
  const entities = [
    ...buildEntities(home, arena, seed, energyIn),
    ...buildEntities(away, arena, seed, energyIn),
  ];
  const byId: Record<string, Entity> = {};
  for (const e of entities) byId[e.id] = e;
  const mods = {
    home: postureMods(home.tactics.posture),
    away: postureMods(away.tactics.posture),
  };
  const focus = { home: home.tactics.focus, away: away.tactics.focus };
  const score: ScoreState = { home: 0, away: 0 };
  const frames: Frame[] = [snapshot(entities, score, 0)];
  const postures = { home: home.tactics.posture, away: away.tactics.posture };

  // Coarse commentary events + objective-control tracking for flip detection.
  const events: MatchEvent[] = [];
  let firstBlood = false;
  let controller: Side | null = null;

  for (let t = 1; t <= TICKS_PER_ROUND; t++) {
    // Positions at the start of the tick, to measure distance actually moved
    // (which drives fatigue drain) once the step is applied.
    const before = entities.map((e) => [e.x, e.y] as const);
    const attackedIds = new Set<string>();

    // 1. MOVEMENT — decided from the start-of-tick state and applied together,
    //    so movement order never advantages a side.
    const moves = entities.map((self) => {
      if (!self.alive) return null;
      if (self.cooldown > 0) self.cooldown--;
      // Utility-based target choice: closer/wounded/high-threat/in-zone enemies
      // score higher, weighted by this fighter's mentals. Remembered for combat
      // this tick and for next tick's hysteresis.
      const target = chooseTarget(self, entities, arena, focus[self.side]);
      self.targetId = target ? target.id : null;
      let want = desiredPoint(self, target, arena, focus[self.side], postures[self.side]);
      // Ranged roles peek from cover when they have a mark and the arena offers it.
      if (target && (self.role === 'skirmisher' || self.role === 'holdback')) {
        want = coverPoint(self, target, entities, arena, want);
      }
      // Boids separation so a squad spreads into a formation, not a blob.
      const sep = separation(self, entities);
      // Small per-fighter, per-tick wobble (own rng stream, independent of the
      // combat draws) so paths aren't perfectly straight and identical lineups
      // don't retrace the same line every round — still fully seeded/deterministic.
      const wobble = makeRng(deriveSeed(self.seedBase ^ seed ^ 0x5151, t));
      const wx = want.x + sep.dx + wobble.float(-7, 7);
      const wy = want.y + sep.dy + wobble.float(-7, 7);
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
      // Re-evaluate the target from POST-move positions for the attack step.
      const target = chooseTarget(self, entities, arena, focus[self.side]);
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
      self.stat.attempts++;
      attackedIds.add(self.id);
      if (dmg > 0) {
        self.stat.hitsLanded++;
        self.stat.damageDealt += dmg;
        hits.push({ attacker: self, target, kind, dmg });
      }
    }
    for (const h of hits) {
      h.target.hp -= h.dmg;
      h.target.stat.damageTaken += h.dmg;
      // Remember the last blow, so a fatal one can be credited when we resolve
      // downs below. Simultaneous hits resolve in deterministic entity order.
      h.target.lastCredit = h.attacker.id;
      h.target.lastCause = h.kind;
    }
    // Environmental hazards burn anyone standing in them. Applied from each
    // entity's own post-move position, so it's order-independent; hazards are
    // mirror-placed, so it stays side-fair.
    for (const e of entities) {
      if (!e.alive) continue;
      const burn = hazardDamageAt(e.x, e.y, arena);
      if (burn > 0) {
        e.hp -= burn;
        e.stat.damageTaken += burn;
        e.stat.hazardDamage += burn;
        e.lastCredit = null;
        e.lastCause = 'hazard';
      }
    }
    for (const e of entities) {
      if (e.alive && e.hp <= 0) {
        e.alive = false;
        e.stat.timesDowned++;
        // A fighter can only be hit by its opponents (or the arena), so the down
        // scores for the other side — order-independent credit.
        const creditSide: Side = e.side === 'home' ? 'away' : 'home';
        awardDown(score, creditSide);
        const cause = e.lastCause ?? 'melee';
        if (e.lastCredit && byId[e.lastCredit]) byId[e.lastCredit].stat.downsScored++;
        if (!firstBlood) {
          firstBlood = true;
          events.push({ t, kind: 'first-blood', side: creditSide });
        }
        events.push({ t, kind: 'down', victim: e.id, credit: e.lastCredit, cause });
      }
    }

    // Fatigue: drain by distance actually moved + any attack, recover if still.
    // Side-neutral (own motion/stats only), so mirror-fairness is untouched.
    for (let i = 0; i < entities.length; i++) {
      const e = entities[i];
      if (!e.alive) continue;
      const moved = Math.hypot(e.x - before[i][0], e.y - before[i][1]);
      updateEnergy(e, moved, attackedIds.has(e.id), postures[e.side]);
    }

    // Objective: tally zone presence for stats, score control, and note flips.
    for (const e of entities) {
      if (e.alive && inZone(e, arena)) e.stat.zoneTicks++;
    }
    const held = tickObjective(score, entities, arena);
    if (held && held !== controller) {
      controller = held;
      events.push({ t, kind: 'objective-flip', side: held });
    }
    if (t % FRAME_EVERY === 0) frames.push(snapshot(entities, score, t));
    if (!sideAlive(entities, 'home') || !sideAlive(entities, 'away')) {
      frames.push(snapshot(entities, score, t));
      break;
    }
  }

  const final = roundedScore(score);
  const stats: MatchStats = {};
  const endEnergy: Record<string, number> = {};
  for (const e of entities) {
    stats[e.id] = e.stat;
    endEnergy[e.id] = e.energy;
  }
  return {
    round: { homeScore: final.home, awayScore: final.away, frames, events, stats },
    endEnergy,
  };
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
  opts?: RoundTwoOverrides,
): MatchResult {
  const run1 = simulateRound(home, away, arena, deriveSeed(seed, 1));

  const home2: SquadInput = {
    ...home,
    tactics: opts?.round2?.home ?? home.tactics,
    fighters: opts?.round2Fighters?.home ?? home.fighters,
  };
  const away2: SquadInput = {
    ...away,
    tactics: opts?.round2?.away ?? away.tactics,
    fighters: opts?.round2Fighters?.away ?? away.fighters,
  };
  // Round two carries round one's end-of-round fatigue, so blitzing round one
  // has a visible second-round cost. Round one is frozen, so re-running only
  // round two at half-time still holds exactly.
  const run2 = simulateRound(home2, away2, arena, deriveSeed(seed, 2), run1.endEnergy);

  const r1 = run1.round;
  const r2 = run2.round;
  const homeScore = r1.homeScore + r2.homeScore;
  const awayScore = r1.awayScore + r2.awayScore;
  const winner: Side | 'draw' =
    homeScore > awayScore ? 'home' : awayScore > homeScore ? 'away' : 'draw';

  const stats = mergeStats(r1.stats, r2.stats);
  const ratings = computeRatings(stats);
  return { homeScore, awayScore, winner, rounds: [r1, r2], stats, ratings };
}
