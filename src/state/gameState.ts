/**
 * The single game-state shape and its pure update functions.
 *
 * Single responsibility: define GameState and the named, pure transitions that
 * change it (record a result, set the lineup, sign a free agent). No React, no
 * store wiring, no I/O — those live in gameStore.ts and save.ts. Every function
 * returns a NEW state object rather than mutating in place.
 */

import { beastsUnlocked, canUpgrade, facilityUpgradeCost, rosterCap, stadiumGate, trainingBonus, upgradeFacility as upgradeFacilityLevel } from '../engine/facilities';
import { ARENAS } from '../data/arenas';
import { generateProspects } from '../data/seedFighters';
import { ageFighter, shouldRetire } from '../engine/aging';
import { chooseFacilityUpgrade } from '../engine/ai';
import { SQUAD_SIZE } from '../engine/constants';
import { computeTable, generateFixtures, seasonComplete } from '../engine/season';
import { applyInjuryOutcome, isInjured, recover, rollInjury } from '../engine/injury';
import { prospectPotentialBoost, reputationGain } from '../engine/reputation';
import { payroll, placementPrize, prizeFor } from '../engine/finance';
import { deriveSeed, makeRng } from '../engine/rng';
import { canScout, scoutCost, scoutFighter } from '../engine/scouting';
import { trainRoster } from '../engine/training';
import { Category, FacilityKind, Fighter, Fixture, Lineup, Team } from '../engine/types';

export const SAVE_VERSION = 14;

export interface GameState {
  version: number;
  /** Master seed the whole game was generated from. */
  seed: number;
  /** Which season this is (1-based); rolls over when one completes. */
  season: number;
  fighters: Record<string, Fighter>;
  teams: Team[];
  playerTeamId: string;
  fixtures: Fixture[];
  freeAgents: string[];
  /** Menagerie creatures not yet tamed by the player. */
  beasts: string[];
  /** The player's committed selection (always present once a game exists). */
  playerLineup: Lineup;
  /** Recap of the season that just ended, shown after a rollover. */
  lastReview?: SeasonReview;
}

/** A player-facing summary of the season that just rolled over. */
export interface SeasonReview {
  /** The season number that just finished. */
  season: number;
  championName: string;
  playerRank: number;
  playerPrize: number;
  playerRepGain: number;
  /** Names of the player's fighters who retired in the off-season. */
  retiredNames: string[];
  /** How many new prospects joined the free-agent pool. */
  intakeCount: number;
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
  const ownerOf: Record<string, string> = {};
  const headcount: Record<string, number> = {};
  for (const t of state.teams) {
    headcount[t.id] = t.fighterIds.length;
    for (const id of t.fighterIds) {
      medbayByFighter[id] = t.facilities.medbay;
      ownerOf[id] = t.id;
    }
  }
  for (const id of Object.keys(fighters)) {
    fighters[id] = recover(fighters[id], medbayByFighter[id] ?? 0);
  }
  const injuryRng = makeRng(deriveSeed(fixture.seed, 0x1273));
  const ended = new Set<string>();
  for (const id of fieldedIds) {
    const f = fighters[id];
    if (!f || isInjured(f)) continue;
    const outcome = rollInjury(f, injuryRng);
    if (outcome.kind === 'ending') {
      const owner = ownerOf[id];
      // A career-ender that would leave a team unable to field six is downgraded
      // to a long serious injury instead of removing the fighter mid-season.
      if (owner && headcount[owner] <= SQUAD_SIZE) {
        fighters[id] = applyInjuryOutcome(f, { kind: 'serious', weeks: 6, statLoss: 'stamina' });
      } else {
        ended.add(id);
        if (owner) headcount[owner]--;
      }
    } else {
      fighters[id] = applyInjuryOutcome(f, outcome);
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

  // Career-ending injuries take the fighter out of the game: remove them from
  // their squad, the player's saved lineup, and the fighter pool. (Wages above
  // were already settled for the roster that took the field this week.)
  if (ended.size > 0) {
    for (const id of ended) delete fighters[id];
    const prunedTeams = teams.map((t) => ({
      ...t,
      fighterIds: t.fighterIds.filter((id) => !ended.has(id)),
    }));
    const playerLineup = {
      ...state.playerLineup,
      fighterIds: state.playerLineup.fighterIds.filter((id) => !ended.has(id)),
      tactics: {
        ...state.playerLineup.tactics,
        roles: Object.fromEntries(
          Object.entries(state.playerLineup.tactics.roles).filter(([id]) => !ended.has(id)),
        ),
      },
    };
    return { ...state, fixtures, fighters, teams: prunedTeams, playerLineup };
  }

  return { ...state, fixtures, fighters, teams };
}

/**
 * Roll the finished season over into the next one: pay end-of-season prize
 * money by final placement, heal everyone over the off-season, then generate a
 * fresh fixture list (new seeds) and reset the table. Rosters, budgets, and
 * facilities all carry forward. No-op until the current season is complete.
 */
export function advanceSeason(state: GameState): GameState {
  if (!seasonComplete(state.fixtures)) return state;

  const table = computeTable(state.teams, state.fixtures);
  const rankOf: Record<string, number> = {};
  table.forEach((row, i) => (rankOf[row.teamId] = i + 1));

  let teams = state.teams.map((t) => ({
    ...t,
    budget: t.budget + placementPrize(rankOf[t.id], state.teams.length),
    reputation: t.reputation + reputationGain(rankOf[t.id], state.teams.length),
  }));

  const season = state.season + 1;
  const rng = makeRng(deriveSeed(state.seed, 0xa6e + season));

  // Off-season: everyone heals, ages a year (and may decline), then veterans
  // may retire. A roster can't be retired below a fieldable squad.
  const fighters: Record<string, Fighter> = {};
  for (const [id, f] of Object.entries(state.fighters)) {
    const healed = f.injuryWeeks > 0 ? { ...f, injuryWeeks: 0 } : f;
    fighters[id] = ageFighter(healed, rng);
  }

  const teamOf: Record<string, string> = {};
  for (const t of teams) for (const id of t.fighterIds) teamOf[id] = t.id;
  const headcount: Record<string, number> = {};
  for (const t of teams) headcount[t.id] = t.fighterIds.length;

  const retired = new Set<string>();
  for (const id of Object.keys(fighters)) {
    if (!shouldRetire(fighters[id], rng)) continue;
    const owner = teamOf[id];
    // A squad must keep enough bodies to field a match; free agents/beasts have no floor.
    if (owner && headcount[owner] <= SQUAD_SIZE) continue;
    retired.add(id);
    if (owner) headcount[owner]--;
  }

  // Capture the player's retirees (by name) before the records are removed.
  const retiredNames = [...retired]
    .filter((id) => teamOf[id] === state.playerTeamId)
    .map((id) => fighters[id].name);
  for (const id of retired) delete fighters[id];
  teams = teams.map((t) => ({ ...t, fighterIds: t.fighterIds.filter((id) => !retired.has(id)) }));
  const freeAgents = state.freeAgents.filter((id) => !retired.has(id));
  const beasts = state.beasts.filter((id) => !retired.has(id));

  // Youth intake: a fresh crop of prospects joins the free-agent pool — a more
  // renowned ludus attracts better youngsters.
  const playerRep = teams.find((t) => t.id === state.playerTeamId)?.reputation ?? 0;
  const prospects = generateProspects(state.seed, season, 4, prospectPotentialBoost(playerRep));
  for (const p of prospects) {
    fighters[p.id] = p;
    freeAgents.push(p.id);
  }

  // Keep the player's saved lineup valid by dropping anyone who retired.
  const playerLineup = {
    ...state.playerLineup,
    fighterIds: state.playerLineup.fighterIds.filter((id) => !retired.has(id)),
    tactics: {
      ...state.playerLineup.tactics,
      roles: Object.fromEntries(
        Object.entries(state.playerLineup.tactics.roles).filter(([id]) => !retired.has(id)),
      ),
    },
  };

  const fixtures = generateFixtures(teams, deriveSeed(state.seed, 7000 + season), ARENAS.map((a) => a.id));

  const playerRank = rankOf[state.playerTeamId];
  const lastReview: SeasonReview = {
    season: state.season,
    championName: state.teams.find((t) => t.id === table[0].teamId)!.name,
    playerRank,
    playerPrize: placementPrize(playerRank, state.teams.length),
    playerRepGain: reputationGain(playerRank, state.teams.length),
    retiredNames,
    intakeCount: prospects.length,
  };

  return { ...state, season, teams, fighters, freeAgents, beasts, fixtures, playerLineup, lastReview };
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

/** Credits to tame a wild creature from the menagerie pool. */
export const BEAST_TAME_FEE = 350;

/**
 * Tame a beast onto the player's roster. Requires a menagerie that unlocks it,
 * a free bed (housing cap), and the taming fee in the budget. No-op otherwise.
 */
export function tameBeast(state: GameState, beastId: string): GameState {
  const index = state.beasts.indexOf(beastId);
  if (index < 0) return state;
  const team = playerTeam(state);
  if (index >= beastsUnlocked(team.facilities.menagerie)) return state; // still caged
  if (team.fighterIds.length >= rosterCap(team.facilities.housing)) return state;
  if (team.budget < BEAST_TAME_FEE) return state;

  return {
    ...state,
    teams: state.teams.map((t) =>
      t.id === team.id
        ? { ...t, budget: t.budget - BEAST_TAME_FEE, fighterIds: [...t.fighterIds, beastId] }
        : t,
    ),
    beasts: state.beasts.filter((id) => id !== beastId),
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
