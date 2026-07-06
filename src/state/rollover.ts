/**
 * Season rollover: turn a finished season into the next one.
 *
 * Single responsibility: the off-season transitions — prize money and
 * reputation by placement, ageing/decline/retirement, contract expiry, youth
 * intake, the AI transfer window, the patron's verdict, and a fresh fixture
 * list, table, and cup. Orchestration over the engine's pure rules; returns a
 * new GameState. No-op until the current season is complete.
 */

import { ARENAS } from '../data/arenas';
import { generateProspects } from '../data/seedFighters';
import { ageFighter, shouldRetire } from '../engine/aging';
import { chooseContractToPursue, chooseSigning } from '../engine/ai';
import { corpByKey } from '../engine/corporations';
import { activateContract, generateOffers } from '../engine/procurement';
import { SQUAD_SIZE } from '../engine/constants';
import { contractSeasonsOf, isExpiring, isUnderpaid, RENEW_SEASONS, transferValue, wageDemand } from '../engine/contracts';
import { moraleOf } from '../engine/morale';
import { overall } from '../engine/attributes';
import { placementPrize } from '../engine/finance';
import { confidenceAfter, objectiveFor, objectiveMet, patronBonus } from '../engine/patron';
import { prospectPotentialBoost, reputationGain } from '../engine/reputation';
import { deriveSeed, makeRng } from '../engine/rng';
import { computeTable, generateFixtures, seasonComplete } from '../engine/season';
import { weakestCategory } from '../engine/training';
import { Fighter } from '../engine/types';
import { GameState, HallOfFamer, NewsItem, SeasonReview, TransferOffer, pushNews, startCup } from './gameState';

export function advanceSeason(state: GameState): GameState {
  if (!seasonComplete(state.fixtures)) return state;

  const table = computeTable(state.teams, state.fixtures);
  const rankOf: Record<string, number> = {};
  table.forEach((row, i) => (rankOf[row.teamId] = i + 1));

  // The sponsor's verdict comes first: if this season's result drains their
  // confidence to nothing, they sack the manager and the career ends here —
  // no next season is generated. This is the fail half of the career arc.
  const finishRank = rankOf[state.playerTeamId];
  if (confidenceAfter(state.patronConfidence, objectiveMet(finishRank, state.objective)) <= 0) {
    const message =
      `Season ${state.season} finished ${finishRank}${ordinalSuffix(finishRank)}, missing the board's target (${state.objective.text}). ` +
      `Your sponsor has run out of patience and terminated your contract. Your career at ${state.teams.find((t) => t.isPlayer)!.name} is over.`;
    return {
      ...state,
      patronConfidence: 0,
      careerOver: { reason: 'fired', season: state.season, message },
      news: pushNews(state.news, [{
        id: `fired:${state.season}`,
        season: state.season,
        week: 0,
        category: 'season',
        text: 'Sacked — the sponsor has terminated your contract. Your career is over.',
      }]),
    };
  }

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

  // Wage demands: a proven fighter who's outgrown their pay gets restless in the
  // final season of their deal — a morale knock and a nudge to re-sign them (at
  // their new, higher wage) before they walk to free agency.
  const wageNews: NewsItem[] = [];
  const playerNow = teams.find((t) => t.id === state.playerTeamId);
  if (playerNow) {
    for (const id of playerNow.fighterIds) {
      const f = fighters[id];
      if (!f || !isExpiring(f) || !isUnderpaid(f, playerNow.reputation)) continue;
      fighters[id] = { ...f, morale: Math.max(0, moraleOf(f) - 6) };
      wageNews.push({
        id: `wage:${season}:${id}`, season, week: 0, category: 'season',
        text: `${f.name} wants a new deal — now commands ${wageDemand(f, playerNow.reputation)}c/week. Re-sign before their contract lapses or they'll walk.`,
      });
    }
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

  // Rival poaching: a rich AI stable may lodge a standing bid for one of the
  // player's better fighters (weighted toward quality and expiring/unhappy ones).
  // The player accepts the credits or refuses in the transfer window. Capped so
  // the market never strips the squad in one go.
  const bidRng = makeRng(deriveSeed(state.seed, 0xb1d + season));
  const transferOffers: TransferOffer[] = [];
  const playerSquad = teams.find((t) => t.id === state.playerTeamId);
  if (playerSquad && playerSquad.fighterIds.length > SQUAD_SIZE) {
    const buyers = teams.filter((t) => !t.isPlayer && t.budget > 1200);
    const targets = [...playerSquad.fighterIds]
      .map((id) => fighters[id])
      .filter((f): f is Fighter => !!f)
      .sort((a, b) => overall(b) - overall(a))
      .slice(0, 4);
    for (const f of targets) {
      if (transferOffers.length >= 2 || buyers.length === 0) break;
      // Better, expiring or unhappy fighters draw interest more often.
      const appeal = 0.18 + Math.min(0.35, overall(f) / 60) + (isExpiring(f) ? 0.15 : 0) + (moraleOf(f) < 40 ? 0.12 : 0);
      if (!bidRng.chance(appeal)) continue;
      const buyer = bidRng.pick(buyers);
      const amount = Math.min(buyer.budget, Math.round(transferValue(f) * bidRng.float(0.85, 1.15)));
      if (amount < 200) continue;
      transferOffers.push({ id: `bid:${season}:${f.id}`, fighterId: f.id, fromTeamId: buyer.id, amount });
    }
  }
  const bidNews: NewsItem[] = transferOffers.map((o) => ({
    id: `bidnews:${o.id}`, season, week: 0, category: 'season',
    text: `${teams.find((t) => t.id === o.fromTeamId)?.name ?? 'A rival'} bid ${o.amount}c for ${fighters[o.fighterId]?.name ?? 'one of your fighters'}. Sell or refuse in Recruit.`,
  }));

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

  const news = pushNews(state.news, buildSeasonNews(state, {
    championName, playerRank, objMet, bonus, retiredNames, departedNames, aiSignings,
  }));

  const hallOfFame = retiredLegends.length > 0 ? [...retiredLegends, ...state.hallOfFame] : state.hallOfFame;
  const champions = [{ season: state.season, name: championName }, ...state.champions];
  const cup = startCup(state.seed, season, teams.map((t) => t.id));

  // AI stables retarget their training each off-season at their roster's
  // weakest category, so rivals shore up their gaps over a career instead of
  // drilling the same thing forever. The player still sets their own by hand.
  teams = teams.map((t) =>
    t.isPlayer ? t : { ...t, trainingFocus: weakestCategory(t.fighterIds.map((id) => fighters[id]).filter(Boolean)) },
  );

  // A fresh procurement market for the new season; then AI stables without a
  // contract may each claim an eligible, affordable offer, so rivals keep
  // specializing over a career and the market feels contested. Each claim is
  // filed to the news so the player sees rivals arming up.
  let contractOffers = generateOffers(state.seed, season);
  const acqRng = makeRng(deriveSeed(state.seed, 0xacc0 + season));
  const acquisitions: NewsItem[] = [];
  for (const t of teams) {
    if (t.isPlayer || t.contract) continue;
    const pick = chooseContractToPursue(t, contractOffers, acqRng);
    if (!pick) continue;
    const offer = contractOffers.find((o) => o.id === pick)!;
    teams = teams.map((x) => (x.id === t.id ? { ...x, budget: x.budget - offer.acquisitionCost, contract: activateContract(offer) } : x));
    contractOffers = contractOffers.filter((o) => o.id !== pick);
    acquisitions.push({
      id: `acq:${season}:${t.id}`,
      season,
      week: 0,
      category: 'season',
      text: `${t.name} landed the ${offer.name} contract from ${corpByKey(offer.sponsorCorp).name}.`,
    });
  }

  return {
    ...state, season, teams, fighters, freeAgents: pool, beasts, fixtures, transferOffers,
    playerLineup, lastReview, news: pushNews(pushNews(pushNews(news, acquisitions), wageNews), bidNews), objective,
    patronConfidence, hallOfFame, champions, cup, contractOffers,
  };
}

/** Assemble the season-turn headlines for the news feed. */
function buildSeasonNews(
  state: GameState,
  d: {
    championName: string; playerRank: number; objMet: boolean; bonus: number;
    retiredNames: string[]; departedNames: string[]; aiSignings: number;
  },
): NewsItem[] {
  const s = state.season;
  const item = (tag: string, text: string): NewsItem => ({ id: `s${s}:${tag}`, season: s, week: 0, category: 'season', text });
  const news: NewsItem[] = [
    item('champ', `Season ${s} ended — champions: ${d.championName}. You finished ${d.playerRank}${ordinalSuffix(d.playerRank)}.`),
  ];
  if (d.retiredNames.length > 0) news.push(item('retire', `Retired from your stable: ${d.retiredNames.join(', ')}.`));
  news.push(item('patron', d.objMet
    ? `The sponsor is pleased — objective met (${state.objective.text})${d.bonus > 0 ? ` Bonus paid: ${d.bonus}c.` : ''}`
    : `The sponsor is disappointed — objective missed (${state.objective.text}) Their patience wears thin.`));
  if (d.departedNames.length > 0) {
    news.push(item('departed', `Left at contract's end: ${d.departedNames.join(', ')}. Re-sign your fighters before their deals lapse.`));
  }
  if (d.aiSignings > 0) {
    news.push(item('transfers', `Rival syndicates signed ${d.aiSignings} free ${d.aiSignings === 1 ? 'agent' : 'agents'} in the off-season.`));
  }
  return news;
}

/** 1 -> "st", 2 -> "nd", 3 -> "rd", else "th". */
function ordinalSuffix(n: number): string {
  const v = n % 100;
  if (v >= 11 && v <= 13) return 'th';
  return ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th';
}
