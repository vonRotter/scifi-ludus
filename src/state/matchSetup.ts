/**
 * Bridge game state to engine match inputs.
 *
 * Single responsibility: turn a Fixture + GameState into the two SquadInputs,
 * the arena, and the list of fielded fighters the engine needs. Pure: it reads
 * state and calls the engine's AI, but mutates nothing and renders nothing.
 */

import { arenaById } from '../data/arenas';
import { chooseLineup } from '../engine/ai';
import { applyArmoury, applyHousing, applyWeaponsmith } from '../engine/facilities';
import { applyMorale } from '../engine/morale';
import { applyTraits } from '../engine/traits';
import { deriveSeed, hashString, makeRng } from '../engine/rng';
import { Arena, Fighter, Fixture, Lineup, Side, SquadInput } from '../engine/types';
import { GameState, teamById } from './gameState';

export interface MatchInputs {
  home: SquadInput;
  away: SquadInput;
  arena: Arena;
  /** Every fighter who took the field, for crediting match experience. */
  fieldedIds: string[];
}

/**
 * Loadout-only fighters for one side: the true roster plus the ludus's
 * match-time facility bonuses. Any lineup id with no live fighter (a stale
 * saved lineup) is skipped rather than crashing the bout.
 */
function lineupToSquad(state: GameState, lineup: Lineup, side: Side): SquadInput {
  const { armoury, weaponsmith, housing } = teamById(state, lineup.teamId).facilities;
  const roster = lineup.fighterIds.map((id) => state.fighters[id]).filter(Boolean) as Fighter[];
  return {
    side,
    fighters: roster.map((f) =>
      applyMorale(applyHousing(applyWeaponsmith(applyArmoury(applyTraits(f), armoury), weaponsmith), housing)),
    ),
    tactics: lineup.tactics,
  };
}

/** The fighters a team is likely to field, for an opponent to read and counter. */
function likelySquad(state: GameState, teamId: string): Fighter[] {
  if (teamId === state.playerTeamId) {
    return state.playerLineup.fighterIds.map((id) => state.fighters[id]).filter(Boolean);
  }
  const team = state.teams.find((t) => t.id === teamId)!;
  return team.fighterIds.map((id) => state.fighters[id]).filter(Boolean);
}

/**
 * The lineup for one team in a fixture: the player's own, or an AI choice that
 * counters the opponent it can see across the sand.
 */
export function lineupForTeam(state: GameState, teamId: string, oppId: string, seed: number): Lineup {
  if (teamId === state.playerTeamId) return state.playerLineup;
  const team = state.teams.find((t) => t.id === teamId)!;
  return chooseLineup(teamId, team.fighterIds, state.fighters, makeRng(seed), likelySquad(state, oppId));
}

/** Assemble both squads, the arena and the fielded list for a fixture. */
export function buildMatchInputs(state: GameState, fixture: Fixture): MatchInputs {
  const homeLineup = lineupForTeam(state, fixture.homeTeamId, fixture.awayTeamId, deriveSeed(fixture.seed, 1));
  const awayLineup = lineupForTeam(state, fixture.awayTeamId, fixture.homeTeamId, deriveSeed(fixture.seed, 2));
  const home = lineupToSquad(state, homeLineup, 'home');
  const away = lineupToSquad(state, awayLineup, 'away');
  return {
    home,
    away,
    arena: arenaById(fixture.arenaId),
    // Credit only the fighters actually fielded (a stale id was skipped above).
    fieldedIds: [...home.fighters, ...away.fighters].map((f) => f.id),
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
