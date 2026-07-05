/**
 * Bridge game state to engine match inputs.
 *
 * Single responsibility: turn a Fixture + GameState into the two SquadInputs,
 * the arena, and the list of fielded fighters the engine needs. Pure: it reads
 * state and calls the engine's AI, but mutates nothing and renders nothing.
 */

import { arenaById } from '../data/arenas';
import { chooseLineup, personalityOf } from '../engine/ai';
import { applyArmoury, applyHousing, applyWeaponsmith } from '../engine/facilities';
import { applyMorale } from '../engine/morale';
import { applyTraits } from '../engine/traits';
import { deriveSeed, hashString, makeRng } from '../engine/rng';
import { Arena, Facilities, Fighter, Fixture, Lineup, Side, SquadInput } from '../engine/types';
import { GameState, teamById } from './gameState';

/**
 * The match-time loadout chain applied to every fighter before a bout: innate
 * traits, the stable's armoury/weaponsmith/housing kit, then morale. The stored
 * fighter is never mutated. Contract specializations ride separately (`spec`).
 */
function loadout(f: Fighter, fac: Facilities): Fighter {
  return applyMorale(
    applyHousing(applyWeaponsmith(applyArmoury(applyTraits(f), fac.armoury), fac.weaponsmith), fac.housing),
  );
}

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
  const team = teamById(state, lineup.teamId);
  const roster = lineup.fighterIds.map((id) => state.fighters[id]).filter(Boolean) as Fighter[];
  return {
    side,
    fighters: roster.map((f) => loadout(f, team.facilities)),
    tactics: lineup.tactics,
    spec: team.specializations,
  };
}

/**
 * A team's loadout-applied bench for half-time substitutions: fit roster
 * fighters (not injured) who did not start, ready to bring on fresh. Same
 * loadout chain as the starters, so a sub is directly comparable.
 */
export function benchSquad(state: GameState, teamId: string, fieldedIds: string[]): Fighter[] {
  const team = teamById(state, teamId);
  const fielded = new Set(fieldedIds);
  return team.fighterIds
    .map((id) => state.fighters[id])
    .filter((f): f is Fighter => !!f && !fielded.has(f.id) && f.injuryWeeks <= 0)
    .map((f) => loadout(f, team.facilities));
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
  return chooseLineup(teamId, team.fighterIds, state.fighters, makeRng(seed), likelySquad(state, oppId), personalityOf(team));
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
