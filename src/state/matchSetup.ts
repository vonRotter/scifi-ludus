/**
 * Bridge game state to engine match inputs.
 *
 * Single responsibility: turn a Fixture + GameState into the two SquadInputs,
 * the arena, and the list of fielded fighters the engine needs. Pure: it reads
 * state and calls the engine's AI, but mutates nothing and renders nothing.
 */

import { arenaById } from '../data/arenas';
import { chooseLineup } from '../engine/ai';
import { deriveSeed, hashString, makeRng } from '../engine/rng';
import { Arena, Fixture, Lineup, Side, SquadInput } from '../engine/types';
import { GameState } from './gameState';

export interface MatchInputs {
  home: SquadInput;
  away: SquadInput;
  arena: Arena;
  /** Every fighter who took the field, for crediting match experience. */
  fieldedIds: string[];
}

function lineupToSquad(state: GameState, lineup: Lineup, side: Side): SquadInput {
  return {
    side,
    fighters: lineup.fighterIds.map((id) => state.fighters[id]),
    tactics: lineup.tactics,
  };
}

/** The lineup for one team in a fixture: the player's own, or an AI choice. */
export function lineupForTeam(state: GameState, teamId: string, seed: number): Lineup {
  if (teamId === state.playerTeamId) return state.playerLineup;
  const team = state.teams.find((t) => t.id === teamId)!;
  return chooseLineup(teamId, team.fighterIds, state.fighters, makeRng(seed));
}

/** Assemble both squads, the arena and the fielded list for a fixture. */
export function buildMatchInputs(state: GameState, fixture: Fixture): MatchInputs {
  const homeLineup = lineupForTeam(state, fixture.homeTeamId, deriveSeed(fixture.seed, 1));
  const awayLineup = lineupForTeam(state, fixture.awayTeamId, deriveSeed(fixture.seed, 2));
  return {
    home: lineupToSquad(state, homeLineup, 'home'),
    away: lineupToSquad(state, awayLineup, 'away'),
    arena: arenaById(fixture.arenaId),
    fieldedIds: [...homeLineup.fighterIds, ...awayLineup.fighterIds],
  };
}

/** A sensible default lineup for the player at new-game time (balanced posture). */
export function defaultPlayerLineup(
  teamId: string,
  fighterIds: string[],
  fightersById: GameState['fighters'],
): Lineup {
  const base = chooseLineup(teamId, fighterIds, fightersById, makeRng(hashString(teamId)));
  return { ...base, tactics: { ...base.tactics, posture: 'balanced' } };
}
