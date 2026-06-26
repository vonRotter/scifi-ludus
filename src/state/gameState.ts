/**
 * The single game-state shape and its pure update functions.
 *
 * Single responsibility: define GameState and the named, pure transitions that
 * change it (record a result, set the lineup, sign a free agent). No React, no
 * store wiring, no I/O — those live in gameStore.ts and save.ts. Every function
 * returns a NEW state object rather than mutating in place.
 */

import { canUpgrade, facilityUpgradeCost, rosterCap, stadiumGate, trainingBonus, upgradeFacility as upgradeFacilityLevel } from '../engine/facilities';
import { chooseFacilityUpgrade } from '../engine/ai';
import { isInjured, recover, rollInjuryWeeks } from '../engine/injury';
import { payroll, prizeFor } from '../engine/finance';
import { deriveSeed, makeRng } from '../engine/rng';
import { canScout, scoutCost, scoutFighter } from '../engine/scouting';
import { trainRoster } from '../engine/training';
import { Category, FacilityKind, Fighter, Fixture, Lineup, Team } from '../engine/types';

export const SAVE_VERSION = 9;

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

/**
 * Record a played fixture's score, credit a match to the fielded fighters, and
 * settle both teams' finances for the week: each pays its full roster's wages
 * and banks prize money for the result.
 */
export function recordResult(
  state: GameState,
  fixtureId: string,
  homeScore: number,
  awayScore: number,
  fieldedIds: string[],
): GameState {
  const fixture = state.fixtures.find((f) => f.id === fixtureId);
  if (!fixture) return state;

  const fixtures = state.fixtures.map((f) =>
    f.id === fixtureId ? { ...f, played: true, homeScore, awayScore } : f,
  );
  let fighters = { ...state.fighters };
  for (const id of fieldedIds) {
    const f = fighters[id];
    if (f) fighters[id] = { ...f, matchesPlayed: f.matchesPlayed + 1 };
  }

  // Both rosters train for the week, toward their team's chosen focus.
  const homeTeam = state.teams.find((t) => t.id === fixture.homeTeamId);
  const awayTeam = state.teams.find((t) => t.id === fixture.awayTeamId);
  const trainingRng = makeRng(deriveSeed(fixture.seed, 0x7a17));
  if (homeTeam) {
    fighters = trainRoster(
      fighters, homeTeam.fighterIds, homeTeam.trainingFocus, trainingRng,
      trainingBonus(homeTeam.facilities.training),
    );
  }
  if (awayTeam) {
    fighters = trainRoster(
      fighters, awayTeam.fighterIds, awayTeam.trainingFocus, trainingRng,
      trainingBonus(awayTeam.facilities.training),
    );
  }

  // A match week passes: every injured fighter heals (faster with a medbay),
  // then this bout's fielded fighters risk a fresh injury. Recovering first
  // means a fighter hurt this week sits out starting next week, not instantly.
  const medbayByFighter: Record<string, number> = {};
  for (const t of state.teams) for (const id of t.fighterIds) medbayByFighter[id] = t.facilities.medbay;
  for (const id of Object.keys(fighters)) {
    fighters[id] = recover(fighters[id], medbayByFighter[id] ?? 0);
  }
  const injuryRng = makeRng(deriveSeed(fixture.seed, 0x1273));
  for (const id of fieldedIds) {
    const f = fighters[id];
    if (f && !isInjured(f)) {
      const weeks = rollInjuryWeeks(f, injuryRng);
      if (weeks > 0) fighters[id] = { ...f, injuryWeeks: weeks };
    }
  }

  const homeOutcome = homeScore > awayScore ? 'win' : homeScore < awayScore ? 'loss' : 'draw';
  const awayOutcome = homeScore > awayScore ? 'loss' : homeScore < awayScore ? 'win' : 'draw';
  const investRng = makeRng(deriveSeed(fixture.seed, 0xfac1));
  const teams = state.teams.map((t) => {
    if (t.id !== fixture.homeTeamId && t.id !== fixture.awayTeamId) return t;
    const outcome = t.id === fixture.homeTeamId ? homeOutcome : awayOutcome;
    const wages = payroll(t.fighterIds.map((id) => fighters[id]));
    const gate = t.id === fixture.homeTeamId ? stadiumGate(t.facilities.stadium) : 0;
    const budget = t.budget - wages + prizeFor(outcome) + gate;

    // AI schools reinvest prize money in facilities so rivals improve over a
    // season; the player spends their own budget by hand.
    if (t.id === state.playerTeamId) return { ...t, budget };
    const buy = chooseFacilityUpgrade(t.facilities, budget, investRng);
    if (!buy) return { ...t, budget };
    return {
      ...t,
      budget: budget - facilityUpgradeCost(t.facilities, buy),
      facilities: upgradeFacilityLevel(t.facilities, buy),
    };
  });

  return { ...state, fixtures, fighters, teams };
}

/** Replace the player's lineup/tactics. */
export function setPlayerLineup(state: GameState, lineup: Lineup): GameState {
  return { ...state, playerLineup: lineup };
}

/** Change a team's weekly training focus (player-facing; AI teams keep theirs). */
export function setTrainingFocus(state: GameState, teamId: string, focus: Category): GameState {
  return {
    ...state,
    teams: state.teams.map((t) => (t.id === teamId ? { ...t, trainingFocus: focus } : t)),
  };
}

/** Move a free agent onto the player's roster, if there's a free bed for them. */
export function signFreeAgent(state: GameState, fighterId: string): GameState {
  if (!state.freeAgents.includes(fighterId)) return state;
  const team = playerTeam(state);
  if (team.fighterIds.length >= rosterCap(team.facilities.housing)) return state;
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

/**
 * Commission a scouting report on a free agent: deducts the report's credit
 * cost from the player's budget and narrows that fighter's fog a notch. No-op
 * if the fighter isn't a free agent, is already fully scouted, or the team
 * can't afford the report.
 */
export function scoutFreeAgent(state: GameState, fighterId: string): GameState {
  if (!state.freeAgents.includes(fighterId)) return state;
  const fighter = state.fighters[fighterId];
  if (!fighter || !canScout(fighter)) return state;
  const team = playerTeam(state);
  const cost = scoutCost(fighter, team.facilities.scouting);
  if (team.budget < cost) return state;

  return {
    ...state,
    fighters: { ...state.fighters, [fighterId]: scoutFighter(fighter) },
    teams: state.teams.map((t) =>
      t.id === team.id ? { ...t, budget: t.budget - cost } : t,
    ),
  };
}

/**
 * Spend credits to build the next level of one of the player's ludus
 * facilities. No-op if it's already maxed or the team can't afford it.
 */
export function upgradeFacility(state: GameState, teamId: string, kind: FacilityKind): GameState {
  const team = teamById(state, teamId);
  if (!canUpgrade(team.facilities, kind)) return state;
  const cost = facilityUpgradeCost(team.facilities, kind);
  if (team.budget < cost) return state;

  return {
    ...state,
    teams: state.teams.map((t) =>
      t.id === teamId
        ? { ...t, budget: t.budget - cost, facilities: upgradeFacilityLevel(t.facilities, kind) }
        : t,
    ),
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
