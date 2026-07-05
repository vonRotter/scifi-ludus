/**
 * League match settlement: record a played fixture and settle its week.
 *
 * Single responsibility: mark the fixture, train both rosters, apply the shared
 * bout effects (injuries, morale, wins), settle the week's finances (wages,
 * prize, home gate, AI reinvestment), and file the news. Orchestration over the
 * engine's pure rules and the shared bout logic; returns a new GameState.
 */

import { chooseFacilityUpgrade, chooseLabUpgrade, personalityOf } from '../engine/ai';
import { corpByKey, incomeMultiplier, procurementResearchMultiplier, trainingPerkMultiplier } from '../engine/corporations';
import { facilityUpgradeCost, stadiumGate, trainingBonus, upgradeFacility as upgradeFacilityLevel } from '../engine/facilities';
import { payroll, prizeFor } from '../engine/finance';
import { advanceContract, labUpgradeCost, researchRate } from '../engine/procurement';
import { deriveSeed, makeRng } from '../engine/rng';
import { trainRoster } from '../engine/training';
import { Fixture } from '../engine/types';
import { GameState, NewsItem, pushNews, resolveContractTick, teamById } from './gameState';
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
      // A Neuro-Conditioning corp lifts its stable's training gains.
      const bonus = trainingBonus(team.facilities.training) * trainingPerkMultiplier(corpByKey(team.corpKey).perk);
      trained = trainRoster(trained, team.fighterIds, team.trainingFocus, trainingRng, bonus);
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
    // A Broadcast-Rights corp earns richer prize money from every result.
    const prize = Math.round(prizeFor(outcome) * incomeMultiplier(corpByKey(t.corpKey).perk));
    const budget = t.budget - wages + prize + gate;
    if (t.id === state.playerTeamId) return { ...t, budget };
    // AI stables reinvest: a facility upgrade, then maybe an R&D Lab level.
    let b = budget;
    let facilities = t.facilities;
    const persona = personalityOf(t);
    const buy = chooseFacilityUpgrade(facilities, b, investRng, persona);
    if (buy) {
      b -= facilityUpgradeCost(facilities, buy);
      facilities = upgradeFacilityLevel(facilities, buy);
    }
    let labLevel = t.labLevel;
    if (chooseLabUpgrade(labLevel, b, investRng, persona)) {
      b -= labUpgradeCost(labLevel);
      labLevel += 1;
    }
    return { ...t, budget: b, facilities, labLevel };
  });

  const hallOfFame = bout.fallen.length > 0 ? [...bout.fallen, ...state.hallOfFame] : state.hallOfFame;
  const { teams, playerLineup } = pruneEnded(fighters, settled, state.playerLineup, bout.ended);

  // Each stable that played and holds a contract puts a match week into it:
  // banks research from its lab (a Skunkworks corp researches faster), credits a
  // win, and burns a deadline week. Fulfilment/forfeit is settled uniformly by
  // resolveContractTick (bounty + specialization); the player's outcome is news.
  let out: GameState = { ...state, fixtures, fighters, teams, playerLineup, news, hallOfFame };
  const contractNews: NewsItem[] = [];
  for (const teamId of [fixture.homeTeamId, fixture.awayTeamId]) {
    const team = teamById(out, teamId);
    if (!team.contract) continue;
    const won = teamId === fixture.homeTeamId ? homeScore > awayScore : awayScore > homeScore;
    const rate = researchRate(team.labLevel) * procurementResearchMultiplier(corpByKey(team.corpKey).perk);
    const tick = advanceContract(team.contract, rate, won ? 1 : 0);
    const resolved = resolveContractTick(out, teamId, tick);
    out = resolved.state;
    if (teamId === state.playerTeamId && resolved.event) {
      contractNews.push({
        id: `${fixture.id}:ct:${team.contract.id}:${resolved.event}`,
        season: state.season,
        week: fixture.week,
        category: 'season',
        text: resolved.event === 'fulfilled'
          ? `Contract fulfilled: ${team.contract.name}. Your stable gains a ${team.contract.domain} specialization.`
          : `Contract forfeited: ${team.contract.name} ran past its deadline.`,
      });
    }
  }
  return contractNews.length > 0 ? { ...out, news: pushNews(out.news, contractNews) } : out;
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
