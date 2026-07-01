/**
 * The Cup: a single-elimination knockout that runs alongside the league.
 *
 * Single responsibility: the pure bracket rules — pairing a round's ties,
 * deciding a tie (a draw goes to a seeded coin-flip so knockouts always
 * resolve), and the champion's rewards. No React, no state ownership; the state
 * layer simulates the ties and stores the bracket.
 */

import { deriveSeed, makeRng } from './rng';
import { Fixture } from './types';

/** Prize money and reputation for lifting the Cup. */
export const CUP_WIN_PRIZE = 600;
export const CUP_WIN_REP = 20;

/**
 * Pair a list of still-standing teams into knockout ties for one round
 * (0v1, 2v3, …). Each tie gets a fixed seed and an arena, so results are
 * reproducible. Assumes an even number of teams.
 */
export function pairRound(teamIds: string[], seed: number, round: number, arenaIds: string[]): Fixture[] {
  const ties: Fixture[] = [];
  for (let i = 0; i + 1 < teamIds.length; i += 2) {
    ties.push({
      id: `cup-r${round}-${i / 2}`,
      week: 0,
      homeTeamId: teamIds[i],
      awayTeamId: teamIds[i + 1],
      arenaId: arenaIds[(round + i) % arenaIds.length],
      seed: deriveSeed(seed, 5000 + round * 16 + i),
      played: false,
    });
  }
  return ties;
}

/**
 * The winner of a cup tie. A clear scoreline decides it; a draw is broken by a
 * deterministic coin-flip seeded from the tie, so a knockout never stalls.
 */
export function cupWinner(tie: Fixture, homeScore: number, awayScore: number): string {
  if (homeScore > awayScore) return tie.homeTeamId;
  if (awayScore > homeScore) return tie.awayTeamId;
  return makeRng(deriveSeed(tie.seed, 0x7b1e)).chance(0.5) ? tie.homeTeamId : tie.awayTeamId;
}
