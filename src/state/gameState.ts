/**
 * The single game-state shape and its pure update functions.
 *
 * Single responsibility: define GameState and the named, pure transitions that
 * change it (record a result, set the lineup, sign a free agent). No React, no
 * store wiring, no I/O — those live in gameStore.ts and save.ts. Every function
 * returns a NEW state object rather than mutating in place.
 */

import { beastsUnlocked, canUpgrade, facilityBuildTime, facilityUpgradeCost, rosterCap } from '../engine/facilities';
import { ARENAS } from '../data/arenas';
import { isExpiring, renewalFee, RENEW_SEASONS, wageDemand } from '../engine/contracts';
import { SeasonObjective } from '../engine/patron';
import { Difficulty } from '../engine/difficulty';
import { pairRound } from '../engine/cup';
import { deriveSeed, hashString, makeRng } from '../engine/rng';
import { canScout, scoutCost, scoutFighter, scoutSearchTime } from '../engine/scouting';
import {
  activateContract, addContractResearch, bidScore, canUpgradeLab, ContractTick,
  contractBounty, FUND_COST, FUND_STEP, grantSpecialization, labUpgradeCost,
  STANDING_ON_FORFEIT, STANDING_ON_FULFIL, STANDING_RIVAL_SPILLOVER,
} from '../engine/procurement';
import { corpByKey, mayBidOn, tradeMultiplier } from '../engine/corporations';
import { chooseContractBid } from '../engine/ai';
import { Category, ContractOffer, FacilityKind, Fighter, Fixture, Lineup, Team } from '../engine/types';

export const SAVE_VERSION = 22;

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
  /** Free-agent ids the player's scout has turned up (only these are signable).
   *  Absent on older saves, where the whole pool is treated as already known. */
  discoveredAgents?: string[];
  /** An active scouting search: match weeks until it turns up a free agent. */
  scoutSearch?: { weeksLeft: number };
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
  /** The current season's knockout cup. */
  cup: CupState;
  /** Procurement contracts on the market for stables to bid on this season. */
  contractOffers: ContractOffer[];
  /** Set once the sponsor sacks the manager — the career is over (Phase 5). */
  careerOver?: { reason: 'fired'; season: number; message: string };
  /** True once the player has dismissed the first-run intro. */
  introSeen?: boolean;
  /** True while this is the guided tutorial game (shows the coach overlay). */
  tutorial?: boolean;
}

/** The season's single-elimination cup bracket. */
export interface CupState {
  /** Current round index: 0 = first round, up to the final. */
  round: number;
  /** The current round's ties (played flags/scores fill in as they resolve). */
  ties: Fixture[];
  /** Set once the final is decided. */
  championId: string | null;
  /** Human results of resolved rounds, newest first, for the Cup screen. */
  log: { round: number; text: string }[];
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
export function pushNews(feed: NewsItem[], items: NewsItem[]): NewsItem[] {
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
  // You can only sign a fighter your scout has actually turned up.
  if (!discoveredAgentIds(state).includes(fighterId)) return state;
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
  // Re-signing ratchets their ongoing wage up to what they now command, so
  // holding onto a squad of proven fighters gets steadily more expensive.
  const wage = wageDemand(fighter, team.reputation);
  return {
    ...state,
    fighters: { ...state.fighters, [fighterId]: { ...fighter, contractSeasons: RENEW_SEASONS, wage } },
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
  // A Logistics-Network corp gets its intel cheaper on top of the scouting facility.
  const cost = Math.round(scoutCost(fighter, team.facilities.scouting) * tradeMultiplier(corpByKey(team.corpKey).perk));
  if (team.budget < cost) return state;

  return {
    ...state,
    fighters: { ...state.fighters, [fighterId]: scoutFighter(fighter) },
    teams: state.teams.map((t) =>
      t.id === team.id ? { ...t, budget: t.budget - cost } : t,
    ),
  };
}

/** Free agents the player's scout has turned up (backward-compatible: on saves
 *  from before scouting-over-time, the whole pool counts as known). */
export function discoveredAgentIds(state: GameState): string[] {
  const known = state.discoveredAgents ?? state.freeAgents;
  return state.freeAgents.filter((id) => known.includes(id));
}

/**
 * Send the scout into the field to track down a free agent. It takes a few match
 * weeks (faster with a better Recon Network) and turns up one prospect. Only one
 * search runs at a time. No-op if a search is already out or the pool is dry.
 */
export function sendScout(state: GameState): GameState {
  if (state.scoutSearch) return state;
  const undiscovered = state.freeAgents.filter((id) => !discoveredAgentIds(state).includes(id));
  if (undiscovered.length === 0) return state;
  const level = playerTeam(state).facilities.scouting;
  return { ...state, scoutSearch: { weeksLeft: scoutSearchTime(level) } };
}

/**
 * Advance an active scout search by one match week. On completion it reveals one
 * undiscovered free agent (deterministically, from the given seed) and files a
 * news item. Pure; returns the state unchanged when no search is running.
 */
export function tickScoutSearch(state: GameState, seed: number): GameState {
  if (!state.scoutSearch) return state;
  const weeksLeft = state.scoutSearch.weeksLeft - 1;
  if (weeksLeft > 0) return { ...state, scoutSearch: { weeksLeft } };

  const known = discoveredAgentIds(state);
  const undiscovered = state.freeAgents.filter((id) => !known.includes(id));
  if (undiscovered.length === 0) return { ...state, scoutSearch: undefined };
  const found = makeRng(seed).pick(undiscovered);
  const name = state.fighters[found]?.name ?? 'a free agent';
  return {
    ...state,
    scoutSearch: undefined,
    discoveredAgents: [...known, found],
    news: pushNews(state.news, [{
      id: `scout-${state.season}-${found}`,
      season: state.season, week: 0, category: 'season',
      text: `Your scout tracked down ${name} — now available to sign in Recruit.`,
    }]),
  };
}

/**
 * Commission the next level of one of the player's ludus facilities. The crew
 * can only build one thing at a time and it takes several match weeks, so this
 * charges the cost up front and queues the build; it completes later, as match
 * weeks are played. No-op if a build is already under way, the facility is
 * maxed, or the team can't afford it.
 */
export function upgradeFacility(state: GameState, teamId: string, kind: FacilityKind): GameState {
  const team = teamById(state, teamId);
  if (team.facilityBuild) return state; // one build at a time
  if (!canUpgrade(team.facilities, kind)) return state;
  const cost = facilityUpgradeCost(team.facilities, kind);
  if (team.budget < cost) return state;

  return {
    ...state,
    teams: state.teams.map((t) =>
      t.id === teamId
        ? { ...t, budget: t.budget - cost, facilityBuild: { kind, weeksLeft: facilityBuildTime(t.facilities[kind]) } }
        : t,
    ),
  };
}

/** Build a fresh knockout cup for a season: pair the teams into the first round. */
export function startCup(seed: number, season: number, teamIds: string[]): CupState {
  const arenaIds = ARENAS.map((a) => a.id);
  return {
    round: 0,
    ties: pairRound(teamIds, deriveSeed(seed, 8000 + season), 0, arenaIds),
    championId: null,
    log: [],
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

/** Immutably map one team in the state. */
function mapTeam(state: GameState, teamId: string, fn: (t: Team) => Team): GameState {
  return { ...state, teams: state.teams.map((t) => (t.id === teamId ? fn(t) : t)) };
}

/** A team's relationship with one corporation, defaulting to neutral. */
export function teamStanding(team: Team, corpKey: string): number {
  return team.corpStanding?.[corpKey] ?? 0;
}

/** Apply a set of standing changes to a team, immutably. */
function bumpStanding(team: Team, changes: Array<[string, number]>): Team {
  const corpStanding = { ...(team.corpStanding ?? {}) };
  for (const [corp, delta] of changes) corpStanding[corp] = (corpStanding[corp] ?? 0) + delta;
  return { ...team, corpStanding };
}

/** The outcome of a contract tick, for the caller to file news on. */
export type ContractEvent = 'fulfilled' | 'forfeited' | null;

/**
 * Settle a contract tick for one team: on fulfilment, bank the military bounty
 * and add the permanent specialization, then clear the contract; on forfeit,
 * clear it; otherwise write the advanced contract back. The single place a
 * contract ever resolves, so rewards can't double-count. Applies to any team
 * (player or AI), so specialization is earned the same way league-wide.
 */
export function resolveContractTick(
  state: GameState,
  teamId: string,
  tick: ContractTick,
): { state: GameState; event: ContractEvent } {
  const { contract, fulfilled, forfeited } = tick;
  if (fulfilled) {
    // Delivering for a corp warms it to you — and cools its rivals, who don't
    // like seeing their enemy armed.
    const rivals = corpByKey(contract.sponsorCorp).rivals;
    const standingChanges: Array<[string, number]> = [
      [contract.sponsorCorp, STANDING_ON_FULFIL],
      ...rivals.map((r) => [r, STANDING_RIVAL_SPILLOVER] as [string, number]),
    ];
    return {
      state: mapTeam(state, teamId, (t) => bumpStanding({
        ...t,
        contract: null,
        budget: t.budget + contractBounty(contract.reward),
        specializations: grantSpecialization(t.specializations, contract.domain, contract.reward),
      }, standingChanges)),
      event: 'fulfilled',
    };
  }
  if (forfeited) {
    return {
      state: mapTeam(state, teamId, (t) => bumpStanding({ ...t, contract: null }, [[contract.sponsorCorp, STANDING_ON_FORFEIT]])),
      event: 'forfeited',
    };
  }
  return { state: mapTeam(state, teamId, (t) => ({ ...t, contract })), event: null };
}

/** Spend credits to build the next R&D Lab level, raising the weekly research
 *  rate toward the active contract. No-op if maxed or unaffordable. */
export function upgradeLab(state: GameState): GameState {
  const team = playerTeam(state);
  if (!canUpgradeLab(team.labLevel)) return state;
  const cost = labUpgradeCost(team.labLevel);
  if (team.budget < cost) return state;
  return mapTeam(state, team.id, (t) => ({ ...t, budget: t.budget - cost, labLevel: t.labLevel + 1 }));
}

/** Commission a prototype: pay credits to add a research step to the active
 *  contract now (and fulfil it if that completes both goals). No-op with no
 *  active contract or too little budget. */
export function fundContract(state: GameState): GameState {
  const team = playerTeam(state);
  if (!team.contract || team.budget < FUND_COST) return state;
  const paid = mapTeam(state, team.id, (t) => ({ ...t, budget: t.budget - FUND_COST }));
  return resolveContractTick(paid, team.id, addContractResearch(team.contract, FUND_STEP)).state;
}

/**
 * Place the player's sealed bid on a contract offer. Eligible rivals bid too;
 * the highest hybrid score (credits + standing + corp favour + noise) wins and
 * pays their bid — only the winner pays. The offer leaves the market either way.
 * No-op if the player already holds a contract, is barred by rivalry, or the bid
 * is below the floor / unaffordable.
 */
export function bidOnContract(state: GameState, offerId: string, bidAmount: number): GameState {
  const offer = state.contractOffers.find((o) => o.id === offerId);
  if (!offer) return state;
  const player = playerTeam(state);
  if (player.contract) return state;
  if (!mayBidOn(player.corpKey, offer.sponsorCorp)) return state;
  if (bidAmount < offer.acquisitionCost || player.budget < bidAmount) return state;

  const rng = makeRng(deriveSeed(state.seed, hashString(offerId) ^ state.season));
  interface Bid { teamId: string; credits: number; corpKey: string; rep: number; standing: number }
  const bidderOf = (t: Team, credits: number): Bid =>
    ({ teamId: t.id, credits, corpKey: t.corpKey, rep: t.reputation, standing: teamStanding(t, offer.sponsorCorp) });
  const bidders: Bid[] = [bidderOf(player, bidAmount)];
  for (const t of state.teams) {
    if (t.isPlayer) continue;
    const ai = chooseContractBid(t, offer, rng);
    if (ai > 0) bidders.push(bidderOf(t, ai));
  }
  const score = (b: Bid): number =>
    bidScore({
      credits: b.credits,
      reputation: b.rep,
      standing: b.standing,
      perk: corpByKey(b.corpKey).perk,
      sameCorp: b.corpKey === offer.sponsorCorp,
      specialtyMatch: corpByKey(b.corpKey).specialty === offer.domain,
      noise: rng.next(),
    });
  let winner = bidders[0];
  let best = score(winner);
  for (const b of bidders.slice(1)) {
    const s = score(b);
    if (s > best) { best = s; winner = b; }
  }

  const contract = activateContract(offer);
  const teams = state.teams.map((t) =>
    t.id === winner.teamId ? { ...t, budget: t.budget - winner.credits, contract } : t,
  );
  const wonByPlayer = winner.teamId === player.id;
  const rivals = bidders.length - 1; // stables that also bid against the player
  const contested = rivals > 0 ? ` — saw off ${rivals} rival bid${rivals === 1 ? '' : 's'}` : '';
  const news = pushNews(state.news, [{
    id: `bid:${offer.id}`,
    season: state.season,
    week: 0,
    category: 'season',
    text: wonByPlayer
      ? `Contract secured: ${offer.name} for ${corpByKey(offer.sponsorCorp).name}${contested}. Fulfil it before the deadline to earn a ${offer.domain} specialization.`
      : `Outbid on ${offer.name} — ${teamById(state, winner.teamId).name} took the ${corpByKey(offer.sponsorCorp).name} contract.`,
  }]);
  return { ...state, teams, contractOffers: state.contractOffers.filter((o) => o.id !== offerId), news };
}
