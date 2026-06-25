/**
 * The single game-state shape and its pure update functions.
 *
 * Single responsibility: define GameState and the named, pure transitions that
 * change it (record a result, set the lineup, sign a free agent). No React, no
 * store wiring, no I/O — those live in gameStore.ts and save.ts. Every function
 * returns a NEW state object rather than mutating in place.
 */

import { Fighter, Fixture, Lineup, Team } from '../engine/types';

export const SAVE_VERSION = 1;

export interface GameState {
  version: number;
  /** Master seed the whole game was generated from. */
  seed: number;
  fighters: Record<string, Fighter>;
  teams: Team[];
  playerTeamId: string;
  fixtures: Fixture[];
  freeAgents: string[];
  /** The player's committed selection (always present once a game exists). */
  playerLineup: Lineup;
}

/** Record a played fixture's score and credit a match to the fielded fighters. */
export function recordResult(
  state: GameState,
  fixtureId: string,
  homeScore: number,
  awayScore: number,
  fieldedIds: string[],
): GameState {
  const fixtures = state.fixtures.map((f) =>
    f.id === fixtureId ? { ...f, played: true, homeScore, awayScore } : f,
  );
  const fighters = { ...state.fighters };
  for (const id of fieldedIds) {
    const f = fighters[id];
    if (f) fighters[id] = { ...f, matchesPlayed: f.matchesPlayed + 1 };
  }
  return { ...state, fixtures, fighters };
}

/** Replace the player's lineup/tactics. */
export function setPlayerLineup(state: GameState, lineup: Lineup): GameState {
  return { ...state, playerLineup: lineup };
}

/** Move a free agent onto the player's roster. */
export function signFreeAgent(state: GameState, fighterId: string): GameState {
  if (!state.freeAgents.includes(fighterId)) return state;
  const teams = state.teams.map((t) =>
    t.id === state.playerTeamId
      ? { ...t, fighterIds: [...t.fighterIds, fighterId] }
      : t,
  );
  return {
    ...state,
    teams,
    freeAgents: state.freeAgents.filter((id) => id !== fighterId),
  };
}

/** Convenience: the player's Team object. */
export function playerTeam(state: GameState): Team {
  const t = state.teams.find((x) => x.id === state.playerTeamId);
  if (!t) throw new Error('Player team missing from state');
  return t;
}

/** Convenience: look up a Team by id. */
export function teamById(state: GameState, id: string): Team {
  const t = state.teams.find((x) => x.id === id);
  if (!t) throw new Error(`Unknown team: ${id}`);
  return t;
}
