/**
 * Internal simulation entity types.
 *
 * Single responsibility: the mutable per-fighter state the match loop pushes
 * around each tick. These never leave the engine — the outside world only sees
 * Frame/MatchResult from types.ts. No React, no randomness here (types only).
 */

import { CategoryScores, DownCause, FighterAction, FighterStat, Role, Side, SpecLevels } from '../types';

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
  /** The stable's specialization levels, applied conditionally in combat. */
  spec: SpecLevels;
  /** Stable per-fighter seed; combine with round seed + tick for fair rng. */
  seedBase: number;
  /** Which way it's pointing, for the renderer. Updated every tick. */
  facing: number;
  /** What it's visibly doing this tick, for the renderer. Updated every tick. */
  action: FighterAction;
  /** Running match tally for this fighter, extracted into MatchStats at round end. */
  stat: FighterStat;
  /** Who last damaged this entity and how — used to credit a down when it falls. */
  lastCredit: string | null;
  lastCause: DownCause | null;
}

/** Running score for one round, accumulated as the loop runs. */
export interface ScoreState {
  home: number;
  away: number;
}
