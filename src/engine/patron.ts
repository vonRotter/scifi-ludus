/**
 * The patron: the backer who bankrolls the ludus and expects results.
 *
 * Single responsibility: the pure rules for the season objective a patron sets,
 * whether it was met, and how that swings their confidence. No React, no
 * randomness, no state ownership — the state layer stores the current objective
 * and confidence and calls these at each season turn.
 */

import { reputationTier } from './reputation';

export interface SeasonObjective {
  /** Finish at least this high in the table (1 = win the league). */
  targetRank: number;
  /** Human phrasing for the UI. */
  text: string;
}

/** Starting patron confidence, and the band it lives in. */
export const START_CONFIDENCE = 60;

/**
 * The objective a patron sets given the ludus's standing: unknown schools are
 * only asked to avoid the wooden spoon, established ones to reach the top half,
 * and renowned ones to win the whole thing.
 */
export function objectiveFor(reputation: number, leagueSize: number): SeasonObjective {
  const tier = reputationTier(reputation);
  let targetRank: number;
  if (tier === 'Unknown' || tier === 'Local') targetRank = Math.max(1, leagueSize - 1);
  else if (tier === 'Regional') targetRank = Math.ceil(leagueSize / 2);
  else targetRank = 1;

  const text =
    targetRank === 1
      ? 'Win the league.'
      : targetRank >= leagueSize - 1
        ? `Avoid finishing last (${targetRank}${ordinalSuffix(targetRank)} or better).`
        : `Finish in the top ${targetRank}.`;
  return { targetRank, text };
}

/** Whether a final placement met the objective. */
export function objectiveMet(playerRank: number, objective: SeasonObjective): boolean {
  return playerRank <= objective.targetRank;
}

/** Patron confidence after a season, given whether the objective was met. */
export function confidenceAfter(current: number, met: boolean): number {
  const delta = met ? 12 : -18;
  return Math.max(0, Math.min(100, current + delta));
}

/** Credits the patron hands over for a season's objective met (0 if missed). */
export function patronBonus(met: boolean): number {
  return met ? 400 : 0;
}

/** A short label for a confidence level. */
export function confidenceLabel(confidence: number): string {
  if (confidence < 20) return 'Precarious';
  if (confidence < 40) return 'Uneasy';
  if (confidence < 60) return 'Watching';
  if (confidence < 80) return 'Content';
  return 'Delighted';
}

function ordinalSuffix(n: number): string {
  const v = n % 100;
  if (v >= 11 && v <= 13) return 'th';
  return ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th';
}
