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

/** Add the reward for downing an opponent to the attacker's side. */
export function awardDown(score: ScoreState, attackerSide: Side): void {
  if (attackerSide === 'home') score.home += SCORE_PER_DOWN;
  else score.away += SCORE_PER_DOWN;
}

function inZone(e: Entity, arena: Arena): boolean {
  const dx = e.x - arena.objective.x;
  const dy = e.y - arena.objective.y;
  return dx * dx + dy * dy <= arena.objective.r * arena.objective.r;
}

/**
 * Apply one tick of objective control. The side with strictly more alive
 * fighters inside the zone gains points; an equal count scores for no one.
 */
export function tickObjective(score: ScoreState, entities: Entity[], arena: Arena): void {
  let home = 0;
  let away = 0;
  for (const e of entities) {
    if (!e.alive || !inZone(e, arena)) continue;
    if (e.side === 'home') home++;
    else away++;
  }
  if (home > away) score.home += OBJECTIVE_SCORE_RATE * (home - away);
  else if (away > home) score.away += OBJECTIVE_SCORE_RATE * (away - home);
}

/** Final integer score for display. */
export function roundedScore(score: ScoreState): { home: number; away: number } {
  return { home: Math.round(score.home), away: Math.round(score.away) };
}
