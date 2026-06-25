/**
 * Internal simulation entity types.
 *
 * Single responsibility: the mutable per-fighter state the match loop pushes
 * around each tick. These never leave the engine — the outside world only sees
 * Frame/MatchResult from types.ts. No React, no randomness here (types only).
 */

import { CategoryScores, Role, Side } from '../types';

export interface Entity {
  id: string;
  side: Side;
  role: Role;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  /** Ticks until this entity may attack again. */
  cooldown: number;
  /** Precomputed effective category scores (fog-free; this is the truth). */
  scores: CategoryScores;
  /** Stable per-fighter seed; combine with round seed + tick for fair rng. */
  seedBase: number;
}

/** Running score for one round, accumulated as the loop runs. */
export interface ScoreState {
  home: number;
  away: number;
}
