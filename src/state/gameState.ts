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
import { chooseFacilityUpgrade, chooseSigning } from '../engine/ai';
import { contractSeasonsOf, isExpiring, renewalFee, RENEW_SEASONS } from '../engine/contracts';
import { confidenceAfter, objectiveFor, objectiveMet, patronBonus, SeasonObjective } from '../engine/patron';
import { Difficulty, difficultyInjuryMult } from '../engine/difficulty';
import { SQUAD_SIZE } from '../engine/constants';
import { computeTable, generateFixtures, seasonComplete } from '../engine/season';
import { applyInjuryOutcome, isInjured, recover, rollInjury } from '../engine/injury';
import { moraleAfterBenched, moraleAfterInjury, moraleAfterResult, moraleOf } from '../engine/morale';
import { prospectPotentialBoost, reputationGain } from '../engine/reputation';
import { payroll, placementPrize, prizeFor } from '../engine/finance';
import { deriveSeed, makeRng } from '../engine/rng';
import { canScout, scoutCost, scoutFighter } from '../engine/scouting';
import { trainRoster } from '../engine/training';
import { Category, FacilityKind, Fighter, Fixture, Lineup, Team } from '../engine/types';

export const SAVE_VERSION = 20;

export interface GameState {
  version: number;
  /** Master seed the whole game was generated from. */
  seed: number;
  /** Chosen difficulty preset for the career. */
  difficulty?: Difficulty;
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
  /** Reverse-chronological feed of notable events (newest first). */
  news: NewsItem[];
  /** The patron's objective for the current season. */
  objective: SeasonObjective;
  /** The patron's confidence in the manager (0..100). */
  patronConfidence: number;
  /** The player's departed greats, newest first (Tier 3 legacy). */
  hallOfFame: HallOfFamer[];
  /** League champions by season, for the history books. */
  champions: { season: number; name: string }[];
}

/** A snapshot of one of the player's fighters at the moment they left the game. */
export interface HallOfFamer {
  id: string;
  name: string;
  bodyType: string;
  apps: number;
  wins: number;
  season: number;
  cause: 'retired' | 'fell';
}

/** One entry in the news feed. */
export interface NewsItem {
  id: string;
  season: number;
  /** Fixture week the item refers to, or 0 for off-season news. */
  week: number;
  category: 'result' | 'injury' | 'season';
  text: string;
}

/** How many news items to keep before the oldest fall off. */
const NEWS_CAP = 80;

/** Prepend fresh items to the feed (newest first) and trim to the cap. */
function pushNews(feed: NewsItem[], items: NewsItem[]): NewsItem[] {
  if (items.length === 0) return feed;
  return [...items, ...feed].slice(0, NEWS_CAP);
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
  const injuryMult = difficultyInjuryMult(state.difficulty);
  const ended = new Set<string>();
  const injuryNews: NewsItem[] = [];
  const noteInjury = (id: string, kind: 'serious' | 'ending') => {
    const owner = ownerOf[id];
    const mine = owner === state.playerTeamId;
    // Report the player's own serious setbacks, and every career-ender (an
    // arena death is league-wide news); rivals' lesser knocks stay quiet.
    if (kind === 'ending' || mine) {
      injuryNews.push({
        id: `${fixture.id}:inj:${id}`,
        season: state.season,
        week: fixture.week,
        category: 'injury',
        text: kind === 'ending'
          ? `${fighters[id].name} fell in the arena and will fight no more.`
          : `${fighters[id].name} picked up a serious injury.`,
      });
    }
  };
  const seriouslyHurt = new Set<string>();
  const fallen: HallOfFamer[] = [];
  for (const id of fieldedIds) {
    const f = fighters[id];
    if (!f || isInjured(f)) continue;
    const outcome = rollInjury(f, injuryRng, injuryMult);
    if (outcome.kind === 'ending') {
      const owner = ownerOf[id];
      // A career-ender that would leave a team unable to field six is downgraded
      // to a long serious injury instead of removing the fighter mid-season.
      if (owner && headcount[owner] <= SQUAD_SIZE) {
        fighters[id] = applyInjuryOutcome(f, { kind: 'serious', weeks: 6, statLoss: 'stamina' });
        seriouslyHurt.add(id);
        noteInjury(id, 'serious');
      } else {
        ended.add(id);
        if (owner) headcount[owner]--;
        noteInjury(id, 'ending');
        if (owner === state.playerTeamId) {
          fallen.push({
            id, name: f.name, bodyType: f.bodyType, apps: f.matchesPlayed,
            wins: f.wins ?? 0, season: state.season, cause: 'fell',
          });
        }
      }
    } else {
      fighters[id] = applyInjuryOutcome(f, outcome);
      if (outcome.kind === 'serious') {
        seriouslyHurt.add(id);
        noteInjury(id, 'serious');
      }
    }
  }

  const homeOutcome = homeScore > awayScore ? 'win' : homeScore < awayScore ? 'loss' : 'draw';
  const awayOutcome = homeScore > awayScore ? 'loss' : homeScore < awayScore ? 'win' : 'draw';

  // Morale: fielded fighters ride the result (and drop further if hurt); fit
  // fighters left on the bench chafe a little for want of action.
  const fieldedSet = new Set(fieldedIds);
  for (const teamId of [fixture.homeTeamId, fixture.awayTeamId]) {
    const team = state.teams.find((t) => t.id === teamId);
    if (!team) continue;
    const outcome = teamId === fixture.homeTeamId ? homeOutcome : awayOutcome;
    for (const id of team.fighterIds) {
      const f = fighters[id];
      if (!f) continue;
      if (fieldedSet.has(id)) {
        let m = moraleAfterResult(moraleOf(f), outcome);
        if (seriouslyHurt.has(id)) m = moraleAfterInjury(m);
        const wins = (f.wins ?? 0) + (outcome === 'win' ? 1 : 0);
        fighters[id] = { ...f, morale: m, wins };
      } else if (!isInjured(f)) {
        fighters[id] = { ...f, morale: moraleAfterBenched(moraleOf(f)) };
      }
    }
  }

  // A result item whenever the player's own team took the field.
  const resultNews: NewsItem[] = [];
  const playerHome = fixture.homeTeamId === state.playerTeamId;
  const playerAway = fixture.awayTeamId === state.playerTeamId;
  if (playerHome || playerAway) {
    const oppId = playerHome ? fixture.awayTeamId : fixture.homeTeamId;
    const opp = state.teams.find((t) => t.id === oppId)?.name ?? 'a rival';
    const forScore = playerHome ? homeScore : awayScore;
    const against = playerHome ? awayScore : homeScore;
    const verb = forScore > against ? 'beat' : forScore < against ? 'lost to' : 'drew with';
    resultNews.push({
      id: `${fixture.id}:result`,
      season: state.season,
      week: fixture.week,
      category: 'result',
      text: `You ${verb} ${opp} ${forScore}–${against}.`,
    });
  }
  const news = pushNews(state.news, [...resultNews, ...injuryNews]);

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

  const hallOfFame = fallen.length > 0 ? [...fallen, ...state.hallOfFame] : state.hallOfFame;

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
    return { ...state, fixtures, fighters, teams: prunedTeams, playerLineup, news, hallOfFame };
  }

  return { ...state, fixtures, fighters, teams, news, hallOfFame };
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

  // Capture the player's retirees before the records are removed — names for
  // the news, and a snapshot for the hall of fame.
  const playerRetirees = [...retired].filter((id) => teamOf[id] === state.playerTeamId);
  const retiredNames = playerRetirees.map((id) => fighters[id].name);
  const retiredLegends: HallOfFamer[] = playerRetirees.map((id) => {
    const f = fighters[id];
    return {
      id, name: f.name, bodyType: f.bodyType, apps: f.matchesPlayed,
      wins: f.wins ?? 0, season: state.season, cause: 'retired' as const,
    };
  });
  for (const id of retired) delete fighters[id];
  teams = teams.map((t) => ({ ...t, fighterIds: t.fighterIds.filter((id) => !retired.has(id)) }));
  const freeAgents = state.freeAgents.filter((id) => !retired.has(id));
  const beasts = state.beasts.filter((id) => !retired.has(id));

  // Contracts tick down a season. AI schools re-sign their own; the player's
  // deals that lapse walk to free agency — unless letting one go would leave an
  // unfieldable squad, in which case they're held on a short forced extension.
  const head2: Record<string, number> = {};
  for (const t of teams) head2[t.id] = t.fighterIds.length;
  const departed = new Set<string>();
  const departedNames: string[] = [];
  for (const t of teams) {
    for (const id of t.fighterIds) {
      const left = contractSeasonsOf(fighters[id]) - 1;
      if (left > 0) {
        fighters[id] = { ...fighters[id], contractSeasons: left };
      } else if (t.id !== state.playerTeamId) {
        fighters[id] = { ...fighters[id], contractSeasons: RENEW_SEASONS }; // AI keeps its own
      } else if (head2[t.id] <= SQUAD_SIZE) {
        fighters[id] = { ...fighters[id], contractSeasons: 1 }; // forced to keep a fieldable six
      } else {
        departed.add(id);
        departedNames.push(fighters[id].name);
        head2[t.id]--;
        fighters[id] = { ...fighters[id], contractSeasons: 1 }; // now a free agent, short asking deal
      }
    }
  }
  if (departed.size > 0) {
    teams = teams.map((t) =>
      t.id === state.playerTeamId ? { ...t, fighterIds: t.fighterIds.filter((id) => !departed.has(id)) } : t,
    );
    for (const id of departed) freeAgents.push(id);
  }

  // Youth intake: a fresh crop of prospects joins the free-agent pool — a more
  // renowned ludus attracts better youngsters.
  const playerRep = teams.find((t) => t.id === state.playerTeamId)?.reputation ?? 0;
  const prospects = generateProspects(state.seed, season, 4, prospectPotentialBoost(playerRep));
  for (const p of prospects) {
    fighters[p.id] = p;
    freeAgents.push(p.id);
  }

  // Off-season transfer window: AI schools recruit from the pool, competing
  // with the player for the same free agents so rival rosters stay alive.
  const signRng = makeRng(deriveSeed(state.seed, 0x519 + season));
  let pool = freeAgents;
  let aiSignings = 0;
  teams = teams.map((t) => {
    if (t.id === state.playerTeamId) return t;
    const pick = chooseSigning(t, pool.map((id) => fighters[id]), signRng);
    if (!pick) return t;
    pool = pool.filter((id) => id !== pick);
    aiSignings++;
    return { ...t, fighterIds: [...t.fighterIds, pick] };
  });

  // Keep the player's saved lineup valid by dropping anyone who left the squad.
  const gone = (id: string) => retired.has(id) || departed.has(id);
  const playerLineup = {
    ...state.playerLineup,
    fighterIds: state.playerLineup.fighterIds.filter((id) => !gone(id)),
    tactics: {
      ...state.playerLineup.tactics,
      roles: Object.fromEntries(
        Object.entries(state.playerLineup.tactics.roles).filter(([id]) => !gone(id)),
      ),
    },
  };

  const fixtures = generateFixtures(teams, deriveSeed(state.seed, 7000 + season), ARENAS.map((a) => a.id));

  const playerRank = rankOf[state.playerTeamId];
  const championName = state.teams.find((t) => t.id === table[0].teamId)!.name;

  // Patron verdict on the season's objective: a bonus and confidence for hitting
  // it, a confidence hit for missing. Then set next season's objective from the
  // ludus's new standing.
  const objMet = objectiveMet(playerRank, state.objective);
  const patronConfidence = confidenceAfter(state.patronConfidence, objMet);
  const bonus = patronBonus(objMet);
  if (bonus > 0) {
    teams = teams.map((t) => (t.id === state.playerTeamId ? { ...t, budget: t.budget + bonus } : t));
  }
  const playerReputation = teams.find((t) => t.id === state.playerTeamId)?.reputation ?? 0;
  const objective = objectiveFor(playerReputation, state.teams.length);

  const lastReview: SeasonReview = {
    season: state.season,
    championName,
    playerRank,
    playerPrize: placementPrize(playerRank, state.teams.length),
    playerRepGain: reputationGain(playerRank, state.teams.length),
    retiredNames,
    intakeCount: prospects.length,
  };

  // Season-turn headlines for the feed.
  const seasonNews: NewsItem[] = [
    {
      id: `s${state.season}:champ`,
      season: state.season, week: 0, category: 'season',
      text: `Season ${state.season} ended — champions: ${championName}. You finished ${playerRank}${ordinalSuffix(playerRank)}.`,
    },
  ];
  if (retiredNames.length > 0) {
    seasonNews.push({
      id: `s${state.season}:retire`,
      season: state.season, week: 0, category: 'season',
      text: `Retired from your ludus: ${retiredNames.join(', ')}.`,
    });
  }
  seasonNews.push({
    id: `s${state.season}:patron`,
    season: state.season, week: 0, category: 'season',
    text: objMet
      ? `The patron is pleased — objective met (${state.objective.text})${bonus > 0 ? ` Bonus paid: ${bonus}c.` : ''}`
      : `The patron is disappointed — objective missed (${state.objective.text}) Their patience wears thin.`,
  });
  if (departedNames.length > 0) {
    seasonNews.push({
      id: `s${state.season}:departed`,
      season: state.season, week: 0, category: 'season',
      text: `Left at contract's end: ${departedNames.join(', ')}. Re-sign your fighters before their deals lapse.`,
    });
  }
  if (aiSignings > 0) {
    seasonNews.push({
      id: `s${state.season}:transfers`,
      season: state.season, week: 0, category: 'season',
      text: `Rival schools signed ${aiSignings} free ${aiSignings === 1 ? 'agent' : 'agents'} in the off-season.`,
    });
  }
  const news = pushNews(state.news, seasonNews);

  const hallOfFame = retiredLegends.length > 0 ? [...retiredLegends, ...state.hallOfFame] : state.hallOfFame;
  const champions = [{ season: state.season, name: championName }, ...state.champions];

  return {
    ...state, season, teams, fighters, freeAgents: pool, beasts, fixtures,
    playerLineup, lastReview, news, objective, patronConfidence, hallOfFame, champions,
  };
}

/** 1 -> "st", 2 -> "nd", 3 -> "rd", else "th". */
function ordinalSuffix(n: number): string {
  const v = n % 100;
  if (v >= 11 && v <= 13) return 'th';
  return ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th';
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
    // Sign them to a fresh deal.
    fighters: { ...state.fighters, [fighterId]: { ...state.fighters[fighterId], contractSeasons: RENEW_SEASONS } },
    freeAgents: state.freeAgents.filter((id) => id !== fighterId),
  };
}

/**
 * Re-sign one of the player's expiring fighters to a fresh multi-season deal
 * for a fee (steeper the unhappier they are). No-op if they aren't the
 * player's, aren't expiring, or the team can't afford the fee.
 */
export function renewContract(state: GameState, fighterId: string): GameState {
  const team = playerTeam(state);
  if (!team.fighterIds.includes(fighterId)) return state;
  const fighter = state.fighters[fighterId];
  if (!fighter || !isExpiring(fighter)) return state;
  const fee = renewalFee(fighter);
  if (team.budget < fee) return state;
  return {
    ...state,
    fighters: { ...state.fighters, [fighterId]: { ...fighter, contractSeasons: RENEW_SEASONS } },
    teams: state.teams.map((t) => (t.id === team.id ? { ...t, budget: t.budget - fee } : t)),
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
    fighters: { ...state.fighters, [beastId]: { ...state.fighters[beastId], contractSeasons: RENEW_SEASONS } },
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
