/**
 * Cup resolution: play out the current knockout round and advance the bracket.
 *
 * Single responsibility: simulate the current round's ties (deterministically,
 * with the same engine the league uses), apply their real stakes — injuries,
 * morale, career wins, and career-ending blows — then either crown a champion
 * or pair the winners into the next round. Orchestration only; the bout rules
 * live in the engine.
 */

import { ARENAS } from '../data/arenas';
import { pairRound, cupWinner, CUP_WIN_PRIZE, CUP_WIN_REP } from '../engine/cup';
import { deriveSeed, makeRng } from '../engine/rng';
import { simulateMatch } from '../engine/match/simulate';
import { SQUAD_SIZE } from '../engine/constants';
import { difficultyInjuryMult } from '../engine/difficulty';
import { applyInjuryOutcome, isInjured, rollInjury } from '../engine/injury';
import { moraleAfterInjury, moraleAfterResult, moraleOf } from '../engine/morale';
import { Fixture } from '../engine/types';
import { GameState, HallOfFamer, NewsItem, teamById } from './gameState';
import { buildMatchInputs } from './matchSetup';

/** A label for a round based on how many ties it holds (1 = Final). */
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

  const fighters = { ...state.fighters };
  const news: NewsItem[] = [];
  const fallen: HallOfFamer[] = [];
  const ended = new Set<string>();
  const label = roundLabel(cup.ties.length);

  // Per-team headcount, so a career-ender never leaves a squad unfieldable.
  const headcount: Record<string, number> = {};
  for (const t of state.teams) headcount[t.id] = t.fighterIds.length;

  const winners: string[] = [];
  const played: Fixture[] = [];
  const injuryMult = difficultyInjuryMult(state.difficulty);

  for (const tie of cup.ties) {
    const inputs = buildMatchInputs(state, tie);
    const result = simulateMatch(inputs.home, inputs.away, inputs.arena, tie.seed);
    const { homeScore, awayScore } = result;
    const winnerId = cupWinner(tie, homeScore, awayScore);
    played.push({ ...tie, played: true, homeScore, awayScore });
    winners.push(winnerId);

    const homeOutcome = homeScore > awayScore ? 'win' : homeScore < awayScore ? 'loss' : 'draw';
    const awayOutcome = homeScore > awayScore ? 'loss' : homeScore < awayScore ? 'win' : 'draw';

    // Fresh injuries for the fielded, then morale + career wins.
    const rng = makeRng(deriveSeed(tie.seed, 0x1273));
    for (const side of ['home', 'away'] as const) {
      const teamId = side === 'home' ? tie.homeTeamId : tie.awayTeamId;
      const outcome = side === 'home' ? homeOutcome : awayOutcome;
      const fieldedIds = (side === 'home' ? inputs.home : inputs.away).fighters.map((f) => f.id);
      for (const id of fieldedIds) {
        const f = fighters[id];
        if (!f) continue;
        let hurtSeriously = false;
        if (!isInjured(f)) {
          const injury = rollInjury(f, rng, injuryMult);
          if (injury.kind === 'ending') {
            if (headcount[teamId] <= SQUAD_SIZE) {
              fighters[id] = applyInjuryOutcome(f, { kind: 'serious', weeks: 6, statLoss: 'stamina' });
              hurtSeriously = true;
            } else {
              ended.add(id);
              headcount[teamId]--;
              if (teamId === state.playerTeamId) {
                fallen.push({ id, name: f.name, bodyType: f.bodyType, apps: f.matchesPlayed, wins: f.wins ?? 0, season: state.season, cause: 'fell' });
              }
              news.push(cupInjuryItem(state, tie.id, id, f.name, 'ending'));
              continue;
            }
          } else if (injury.kind === 'serious') {
            fighters[id] = applyInjuryOutcome(f, injury);
            hurtSeriously = true;
          } else if (injury.kind === 'knock') {
            fighters[id] = applyInjuryOutcome(f, injury);
          }
          if (hurtSeriously && teamId === state.playerTeamId) {
            news.push(cupInjuryItem(state, tie.id, id, f.name, 'serious'));
          }
        }
        const cur = fighters[id];
        let m = moraleAfterResult(moraleOf(cur), outcome);
        if (hurtSeriously) m = moraleAfterInjury(m);
        fighters[id] = { ...cur, matchesPlayed: cur.matchesPlayed + 1, morale: m, wins: (cur.wins ?? 0) + (outcome === 'win' ? 1 : 0) };
      }
    }
  }

  // A result line for the player's tie, if they were in this round.
  const playerTie = played.find((t) => t.homeTeamId === state.playerTeamId || t.awayTeamId === state.playerTeamId);
  if (playerTie) {
    const home = playerTie.homeTeamId === state.playerTeamId;
    const oppName = teamById(state, home ? playerTie.awayTeamId : playerTie.homeTeamId).name;
    const forS = home ? playerTie.homeScore! : playerTie.awayScore!;
    const agS = home ? playerTie.awayScore! : playerTie.homeScore!;
    const advanced = winners.includes(state.playerTeamId);
    news.push({
      id: `${playerTie.id}:cup`, season: state.season, week: 0, category: 'result',
      text: `Cup ${label}: you ${forS >= agS ? 'beat' : 'lost to'} ${oppName} ${forS}–${agS} — ${advanced ? 'through to the next round!' : 'knocked out.'}`,
    });
  }

  // Prune career-enders from squads and the player's lineup.
  let teams = state.teams;
  let playerLineup = state.playerLineup;
  if (ended.size > 0) {
    for (const id of ended) delete fighters[id];
    teams = teams.map((t) => ({ ...t, fighterIds: t.fighterIds.filter((id) => !ended.has(id)) }));
    playerLineup = {
      ...playerLineup,
      fighterIds: playerLineup.fighterIds.filter((id) => !ended.has(id)),
      tactics: { ...playerLineup.tactics, roles: Object.fromEntries(Object.entries(playerLineup.tactics.roles).filter(([id]) => !ended.has(id))) },
    };
  }

  const log = [{ round: cup.round, text: `${capitalize(label)}: ${played.map((t) => `${teamById(state, t.homeTeamId).name} ${t.homeScore}–${t.awayScore} ${teamById(state, t.awayTeamId).name}`).join('; ')}` }, ...cup.log];

  // Advance: crown a champion, or pair the winners into the next round.
  let nextCup;
  if (winners.length === 1) {
    const championId = winners[0];
    const champName = teamById(state, championId).name;
    teams = teams.map((t) => (t.id === championId ? { ...t, budget: t.budget + CUP_WIN_PRIZE, reputation: t.reputation + CUP_WIN_REP } : t));
    news.push({
      id: `cup-champ-s${state.season}`, season: state.season, week: 0, category: 'season',
      text: `${champName} lifted the Cup${championId === state.playerTeamId ? ' — glory is yours!' : '.'}`,
    });
    nextCup = { ...cup, ties: played, championId, log };
  } else {
    const nextTies = pairRound(winners, deriveSeed(state.seed, 8000 + state.season), cup.round + 1, ARENAS.map((a) => a.id));
    nextCup = { round: cup.round + 1, ties: nextTies, championId: null, log };
  }

  const hallOfFame = fallen.length > 0 ? [...fallen, ...state.hallOfFame] : state.hallOfFame;
  return { ...state, fighters, teams, playerLineup, news: [...news, ...state.news].slice(0, 80), hallOfFame, cup: nextCup };
}

function cupInjuryItem(state: GameState, tieId: string, id: string, name: string, kind: 'serious' | 'ending'): NewsItem {
  return {
    id: `${tieId}:inj:${id}`, season: state.season, week: 0, category: 'injury',
    text: kind === 'ending' ? `${name} fell in a cup tie and will fight no more.` : `${name} took a serious injury in the cup.`,
  };
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
