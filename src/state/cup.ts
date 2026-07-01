/**
 * Cup resolution: play out the current knockout round and advance the bracket.
 *
 * Single responsibility: simulate the current round's ties (deterministically,
 * with the same engine the league uses), apply their stakes through the shared
 * bout logic (injuries, morale, career wins, career-enders), then crown a
 * champion or pair the winners into the next round. Orchestration only.
 */

import { ARENAS } from '../data/arenas';
import { pairRound, cupWinner, CUP_WIN_PRIZE, CUP_WIN_REP } from '../engine/cup';
import { deriveSeed } from '../engine/rng';
import { simulateMatch } from '../engine/match/simulate';
import { Fixture } from '../engine/types';
import { GameState, HallOfFamer, NewsItem, pushNews, teamById } from './gameState';
import { applyBoutEffects, pruneEnded } from './bout';
import { buildMatchInputs } from './matchSetup';

/** A label for a round based on how many ties it holds (1 = the Final). */
function roundLabel(tieCount: number): string {
  if (tieCount <= 1) return 'the Final';
  if (tieCount === 2) return 'the Semi-finals';
  if (tieCount === 4) return 'the Quarter-finals';
  return `Cup Round ${tieCount}`;
}

/**
 * Resolve the cup's current round. No-op once a champion is crowned. Returns a
 * new GameState with the round played, its stakes applied, and the bracket
 * advanced (or the trophy lifted).
 */
export function resolveCupRound(state: GameState): GameState {
  const cup = state.cup;
  if (cup.championId || cup.ties.length === 0) return state;

  const label = roundLabel(cup.ties.length);
  let fighters = state.fighters;
  let teams = state.teams;
  let playerLineup = state.playerLineup;
  const news: NewsItem[] = [];
  const fallen: HallOfFamer[] = [];
  const winners: string[] = [];
  const played: Fixture[] = [];

  for (const tie of cup.ties) {
    const inputs = buildMatchInputs({ ...state, fighters }, tie);
    const { homeScore, awayScore } = simulateMatch(inputs.home, inputs.away, inputs.arena, tie.seed);
    played.push({ ...tie, played: true, homeScore, awayScore });
    winners.push(cupWinner(tie, homeScore, awayScore));

    const bout = applyBoutEffects(state, {
      seed: tie.seed,
      homeTeamId: tie.homeTeamId,
      awayTeamId: tie.awayTeamId,
      homeScore, awayScore,
      fieldedIds: inputs.fieldedIds,
      heal: false,
      baseFighters: fighters,
    });
    fighters = bout.fighters;
    fallen.push(...bout.fallen);
    for (const inj of bout.injuries) {
      if (inj.kind === 'ending' || inj.isPlayer) news.push(cupInjuryItem(state, tie.id, inj));
    }
    // Prune this tie's career-enders before the next tie reads the roster.
    ({ teams, playerLineup } = pruneEnded(fighters, teams, playerLineup, bout.ended));
  }

  news.push(...playerTieNews(state, played, winners, label));

  const log = [
    { round: cup.round, text: `${capitalize(label)}: ${played.map((t) => `${teamById(state, t.homeTeamId).name} ${t.homeScore}–${t.awayScore} ${teamById(state, t.awayTeamId).name}`).join('; ')}` },
    ...cup.log,
  ];

  let nextCup;
  if (winners.length === 1) {
    const championId = winners[0];
    teams = teams.map((t) => (t.id === championId ? { ...t, budget: t.budget + CUP_WIN_PRIZE, reputation: t.reputation + CUP_WIN_REP } : t));
    news.push({
      id: `cup-champ-s${state.season}`, season: state.season, week: 0, category: 'season',
      text: `${teamById(state, championId).name} lifted the Cup${championId === state.playerTeamId ? ' — glory is yours!' : '.'}`,
    });
    nextCup = { ...cup, ties: played, championId, log };
  } else {
    const nextTies = pairRound(winners, deriveSeed(state.seed, 8000 + state.season), cup.round + 1, ARENAS.map((a) => a.id));
    nextCup = { round: cup.round + 1, ties: nextTies, championId: null, log };
  }

  const hallOfFame = fallen.length > 0 ? [...fallen, ...state.hallOfFame] : state.hallOfFame;
  return { ...state, fighters, teams, playerLineup, news: pushNews(state.news, news), hallOfFame, cup: nextCup };
}

/** The player's own cup result line, if they were in this round. */
function playerTieNews(state: GameState, played: Fixture[], winners: string[], label: string): NewsItem[] {
  const tie = played.find((t) => t.homeTeamId === state.playerTeamId || t.awayTeamId === state.playerTeamId);
  if (!tie) return [];
  const home = tie.homeTeamId === state.playerTeamId;
  const oppName = teamById(state, home ? tie.awayTeamId : tie.homeTeamId).name;
  const forS = home ? tie.homeScore! : tie.awayScore!;
  const agS = home ? tie.awayScore! : tie.homeScore!;
  const advanced = winners.includes(state.playerTeamId);
  return [{
    id: `${tie.id}:cup`, season: state.season, week: 0, category: 'result',
    text: `Cup ${label}: you ${forS >= agS ? 'beat' : 'lost to'} ${oppName} ${forS}–${agS} — ${advanced ? 'through to the next round!' : 'knocked out.'}`,
  }];
}

function cupInjuryItem(state: GameState, tieId: string, inj: { id: string; name: string; kind: 'serious' | 'ending' }): NewsItem {
  return {
    id: `${tieId}:inj:${inj.id}`, season: state.season, week: 0, category: 'injury',
    text: inj.kind === 'ending' ? `${inj.name} fell in a cup tie and will fight no more.` : `${inj.name} took a serious injury in the cup.`,
  };
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
