/**
 * League match settlement: record a played fixture and settle its week.
 *
 * Single responsibility: mark the fixture, train both rosters, apply the shared
 * bout effects (injuries, morale, wins), settle the week's finances (wages,
 * prize, home gate, AI reinvestment), and file the news. Orchestration over the
 * engine's pure rules and the shared bout logic; returns a new GameState.
 */

import { chooseFacilityUpgrade } from '../engine/ai';
import { facilityUpgradeCost, stadiumGate, trainingBonus, upgradeFacility as upgradeFacilityLevel } from '../engine/facilities';
import { payroll, prizeFor } from '../engine/finance';
import { deriveSeed, makeRng } from '../engine/rng';
import { trainRoster } from '../engine/training';
import { Fixture } from '../engine/types';
import { GameState, NewsItem, pushNews } from './gameState';
import { applyBoutEffects, outcomeFor, pruneEnded } from './bout';

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

  // Both rosters train for the week (before the bout's effects land), then the
  // shared bout logic applies appearances, healing, injuries, morale, and wins.
  let trained = { ...state.fighters };
  const trainingRng = makeRng(deriveSeed(fixture.seed, 0x7a17));
  for (const teamId of [fixture.homeTeamId, fixture.awayTeamId]) {
    const team = state.teams.find((t) => t.id === teamId);
    if (team) {
      trained = trainRoster(trained, team.fighterIds, team.trainingFocus, trainingRng, trainingBonus(team.facilities.training));
    }
  }

  const bout = applyBoutEffects(state, {
    seed: fixture.seed,
    homeTeamId: fixture.homeTeamId,
    awayTeamId: fixture.awayTeamId,
    homeScore, awayScore, fieldedIds,
    heal: true,
    baseFighters: trained,
  });
  const fighters = bout.fighters;

  // News: the player's result, plus their serious injuries and every death.
  const news = pushNews(state.news, [
    ...playerResultNews(state, fixture, homeScore, awayScore),
    ...bout.injuries
      .filter((i) => i.kind === 'ending' || i.isPlayer)
      .map((i): NewsItem => ({
        id: `${fixture.id}:inj:${i.id}`,
        season: state.season,
        week: fixture.week,
        category: 'injury',
        text: i.kind === 'ending'
          ? `${i.name} fell in the arena and will fight no more.`
          : `${i.name} picked up a serious injury.`,
      })),
  ]);

  // Settle the week's finances for the two teams that played: wages out, prize
  // and home gate in, and AI schools reinvest what's left in facilities.
  const investRng = makeRng(deriveSeed(fixture.seed, 0xfac1));
  const settled = state.teams.map((t) => {
    if (t.id !== fixture.homeTeamId && t.id !== fixture.awayTeamId) return t;
    const outcome = outcomeFor(
      t.id === fixture.homeTeamId ? homeScore : awayScore,
      t.id === fixture.homeTeamId ? awayScore : homeScore,
    );
    const wages = payroll(t.fighterIds.map((id) => fighters[id]));
    const gate = t.id === fixture.homeTeamId ? stadiumGate(t.facilities.stadium) : 0;
    const budget = t.budget - wages + prizeFor(outcome) + gate;
    if (t.id === state.playerTeamId) return { ...t, budget };
    const buy = chooseFacilityUpgrade(t.facilities, budget, investRng);
    if (!buy) return { ...t, budget };
    return { ...t, budget: budget - facilityUpgradeCost(t.facilities, buy), facilities: upgradeFacilityLevel(t.facilities, buy) };
  });

  const hallOfFame = bout.fallen.length > 0 ? [...bout.fallen, ...state.hallOfFame] : state.hallOfFame;
  const { teams, playerLineup } = pruneEnded(fighters, settled, state.playerLineup, bout.ended);

  return { ...state, fixtures, fighters, teams, playerLineup, news, hallOfFame };
}

/** The player's own result line for the news feed, if their team played. */
function playerResultNews(state: GameState, fixture: Fixture, homeScore: number, awayScore: number): NewsItem[] {
  const playerHome = fixture.homeTeamId === state.playerTeamId;
  const playerAway = fixture.awayTeamId === state.playerTeamId;
  if (!playerHome && !playerAway) return [];
  const oppId = playerHome ? fixture.awayTeamId : fixture.homeTeamId;
  const opp = state.teams.find((t) => t.id === oppId)?.name ?? 'a rival';
  const forScore = playerHome ? homeScore : awayScore;
  const against = playerHome ? awayScore : homeScore;
  const verb = forScore > against ? 'beat' : forScore < against ? 'lost to' : 'drew with';
  return [{
    id: `${fixture.id}:result`,
    season: state.season,
    week: fixture.week,
    category: 'result',
    text: `You ${verb} ${opp} ${forScore}–${against}.`,
  }];
}
