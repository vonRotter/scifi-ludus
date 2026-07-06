/**
 * Scoring model: how a bout earns points.
 *
 * Single responsibility: convert match events (downs, objective control) into
 * score. Pure helpers, no state ownership, no randomness, no React.
 *
 * Model (per the design doc's "downs and/or objective" suggestion — we use
 * both): downing an opponent is worth SCORE_PER_DOWN; holding the objective
 * zone with more fighters than the enemy accrues OBJECTIVE_SCORE_RATE per tick.
 */

import { OBJECTIVE_SCORE_RATE, SCORE_PER_DOWN } from '../constants';
import { Arena, Side } from '../types';
import { Entity, ScoreState } from './internal';

/** Add the reward for downing an opponent to the attacker's side (tracked in
 *  the down bucket too, so the scorebar can split downs from zone control). */
export function awardDown(score: ScoreState, attackerSide: Side): void {
  if (attackerSide === 'home') { score.home += SCORE_PER_DOWN; score.homeDowns += SCORE_PER_DOWN; }
  else { score.away += SCORE_PER_DOWN; score.awayDowns += SCORE_PER_DOWN; }
}

/** True when an alive entity stands inside the arena's objective zone. */
export function inZone(e: Entity, arena: Arena): boolean {
  const dx = e.x - arena.objective.x;
  const dy = e.y - arena.objective.y;
  return dx * dx + dy * dy <= arena.objective.r * arena.objective.r;
}

/**
 * Apply one tick of objective control. The side with strictly more alive
 * fighters inside the zone gains points; an equal count scores for no one.
 * Returns the controlling side (or null for a contested/empty zone) so the
 * caller can detect when control changes hands.
 */
export function tickObjective(score: ScoreState, entities: Entity[], arena: Arena): Side | null {
  let home = 0;
  let away = 0;
  for (const e of entities) {
    if (!e.alive || !inZone(e, arena)) continue;
    if (e.side === 'home') home++;
    else away++;
  }
  if (home > away) {
    score.home += OBJECTIVE_SCORE_RATE * (home - away);
    return 'home';
  }
  if (away > home) {
    score.away += OBJECTIVE_SCORE_RATE * (away - home);
    return 'away';
  }
  return null;
}

/** Integer score for display, split into its down- and zone-derived parts. */
export function roundedScore(score: ScoreState): {
  home: number; away: number; homeDowns: number; awayDowns: number;
} {
  return {
    home: Math.round(score.home),
    away: Math.round(score.away),
    homeDowns: Math.round(score.homeDowns),
    awayDowns: Math.round(score.awayDowns),
  };
}
