import { describe, it, expect } from 'vitest';
import { createGame } from './newGame';
import { BEAST_TAME_FEE, discoveredAgentIds, GameState, playerTeam, renewContract, sendScout, signFreeAgent, tameBeast, teamById, tickScoutSearch, upgradeFacility } from './gameState';
import { scoutSearchTime } from '../engine/scouting';
import { recordResult } from './recordResult';
import { advanceSeason } from './rollover';
import { seasonComplete } from '../engine/season';
import { beastsUnlocked, rosterCap, stadiumGate } from '../engine/facilities';
import { corpByKey, incomeMultiplier } from '../engine/corporations';
import { PRIZE_DRAW } from '../engine/finance';
import { SQUAD_SIZE } from '../engine/constants';
import { contractSeasonsOf } from '../engine/contracts';
import { buildMatchInputs } from './matchSetup';
import { resolveCupRound } from './cup';

/** A fresh deterministic game to mutate in tests. */
function game() {
  return createGame(12345, 0);
}

/** A fixture where the player is the home team (so AI auto-investment can't
 * perturb the home-side budget the finance tests measure). */
function playerHomeFixture(g: ReturnType<typeof game>) {
  return g.fixtures.find((f) => f.homeTeamId === g.playerTeamId)!;
}

describe('stadium gate income', () => {
  it("credits the home team exactly the stadium gate, isolated from wages/prize", () => {
    const g0 = game();
    const fixture = playerHomeFixture(g0);
    const homeId = fixture.homeTeamId;
    const fielded = [...g0.teams.find((t) => t.id === homeId)!.fighterIds.slice(0, 6),
                     ...g0.teams.find((t) => t.id === fixture.awayTeamId)!.fighterIds.slice(0, 6)];

    // Same fixture, same scoreline — once without a stadium, once with one.
    // Measure each game's match-week budget swing against its own pre-match
    // budget, so the upgrade's purchase cost cancels out and only the gate
    // (which a stadium adds and a bare ludus doesn't) remains.
    const gBare = g0;
    // Give the home team a built stadium directly (the build system is tested
    // separately); here we only care about the gate it adds to the settlement.
    const gStadium = { ...g0, teams: g0.teams.map((t) => (t.id === homeId ? { ...t, facilities: { ...t.facilities, stadium: 1 } } : t)) };
    const bareBudget = teamById(gBare, homeId).budget;
    const stadiumBudget = teamById(gStadium, homeId).budget;

    const without = recordResult(gBare, fixture.id, 30, 20, fielded);
    const withStadium = recordResult(gStadium, fixture.id, 30, 20, fielded);

    const bareDelta = teamById(without, homeId).budget - bareBudget;
    const stadiumDelta = teamById(withStadium, homeId).budget - stadiumBudget;

    const gate = stadiumGate(teamById(gStadium, homeId).facilities.stadium);
    expect(gate).toBeGreaterThan(0);
    expect(stadiumDelta - bareDelta).toBe(gate);
  });
});

describe('facility construction', () => {
  it('commissions a build (does not upgrade instantly) and blocks a second', () => {
    const g0 = game();
    const pid = g0.playerTeamId;
    const before = playerTeam(g0);
    const g1 = upgradeFacility(g0, pid, 'training');
    const after = playerTeam(g1);
    // Charged, queued — but the level has not gone up yet.
    expect(after.facilities.training).toBe(before.facilities.training);
    expect(after.facilityBuild?.kind).toBe('training');
    expect(after.budget).toBeLessThan(before.budget);
    // A second commission is refused while one is under way.
    const g2 = upgradeFacility(g1, pid, 'medbay');
    expect(playerTeam(g2).facilityBuild?.kind).toBe('training');
    expect(playerTeam(g2).budget).toBe(after.budget);
  });
});

describe('scouting over time', () => {
  it('a fresh game knows only a couple of agents, and the rest cannot be signed', () => {
    const g0 = game();
    expect(discoveredAgentIds(g0).length).toBe(2);
    const hidden = g0.freeAgents.find((id) => !discoveredAgentIds(g0).includes(id))!;
    expect(hidden).toBeTruthy();
    expect(signFreeAgent(g0, hidden)).toBe(g0); // an undiscovered agent is unsignable
  });

  it('sending the scout runs a timed search, one at a time', () => {
    const g0 = game();
    const weeks = scoutSearchTime(playerTeam(g0).facilities.scouting);
    const g1 = sendScout(g0);
    expect(g1.scoutSearch?.weeksLeft).toBe(weeks);
    expect(sendScout(g1)).toBe(g1); // a second search is refused
  });

  it('a completed search turns up a new agent and files news', () => {
    const g0 = game();
    const before = discoveredAgentIds(g0).length;
    let g = sendScout(g0);
    for (let i = 0; i < scoutSearchTime(playerTeam(g0).facilities.scouting); i++) g = tickScoutSearch(g, 100 + i);
    expect(g.scoutSearch).toBeUndefined();
    expect(discoveredAgentIds(g).length).toBe(before + 1);
    expect(g.news.some((n) => n.text.includes('tracked down'))).toBe(true);
  });
});

describe('roster cap (housing)', () => {
  it('blocks signing once beds are full, and a housing upgrade frees more', () => {
    // The whole market is already scouted here — we're testing the bed cap, not
    // scouting-over-time (covered separately).
    const base = game();
    const g0: GameState = { ...base, discoveredAgents: base.freeAgents };
    const startCount = playerTeam(g0).fighterIds.length;
    const cap0 = rosterCap(playerTeam(g0).facilities.housing);
    expect(startCount).toBeLessThanOrEqual(cap0);

    // Sign free agents until the roster is full.
    let g = g0;
    while (playerTeam(g).fighterIds.length < cap0 && g.freeAgents.length > 0) {
      g = signFreeAgent(g, g.freeAgents[0]);
    }
    expect(playerTeam(g).fighterIds.length).toBe(cap0);

    // Now at the cap: another signing is a no-op.
    if (g.freeAgents.length > 0) {
      const blocked = signFreeAgent(g, g.freeAgents[0]);
      expect(playerTeam(blocked).fighterIds.length).toBe(cap0);

      // A finished housing upgrade adds beds, then the same signing succeeds.
      const pid = playerTeam(g).id;
      const roomier = { ...g, teams: g.teams.map((t) => (t.id === pid ? { ...t, facilities: { ...t.facilities, housing: t.facilities.housing + 1 } } : t)) };
      expect(rosterCap(playerTeam(roomier).facilities.housing)).toBeGreaterThan(cap0);
      const signed = signFreeAgent(roomier, roomier.freeAgents[0]);
      expect(playerTeam(signed).fighterIds.length).toBe(cap0 + 1);
    }
  });
});

describe('injury recovery on a match week', () => {
  it('decrements an injured fighter when any fixture is recorded', () => {
    const g0 = game();
    const fixture = g0.fixtures[0];
    // Injure a benched fighter on the home team (not fielded below).
    const homeIds = g0.teams.find((t) => t.id === fixture.homeTeamId)!.fighterIds;
    const injuredId = homeIds[homeIds.length - 1];
    const g1: typeof g0 = {
      ...g0,
      fighters: { ...g0.fighters, [injuredId]: { ...g0.fighters[injuredId], injuryWeeks: 3 } },
    };
    const fielded = homeIds.slice(0, 6); // injuredId is the last, so it sits out
    const g2 = recordResult(g1, fixture.id, 25, 18, fielded);
    // A week passed, so with no medbay it heals exactly one week.
    expect(g2.fighters[injuredId].injuryWeeks).toBe(2);
  });
});

describe('AI facility investment', () => {
  it('an AI side reinvests after a match when flush, the player never auto-spends', () => {
    const g0 = game();
    // A fixture between two AI teams (player is team-0 / playerTeamId).
    const aiFixture = g0.fixtures.find(
      (f) => f.homeTeamId !== g0.playerTeamId && f.awayTeamId !== g0.playerTeamId,
    )!;
    // Make both AI sides rich so an upgrade is always affordable.
    const flush = {
      ...g0,
      teams: g0.teams.map((t) =>
        t.id === g0.playerTeamId ? t : { ...t, budget: 50000 },
      ),
    };
    const facLevels = (g: typeof g0, id: string) =>
      Object.values(teamById(g, id).facilities).reduce((s, n) => s + n, 0);

    const fielded = [...teamById(flush, aiFixture.homeTeamId).fighterIds.slice(0, 6),
                     ...teamById(flush, aiFixture.awayTeamId).fighterIds.slice(0, 6)];
    const g1 = recordResult(flush, aiFixture.id, 22, 19, fielded);

    // A flush AI commissions a facility build (it completes over later weeks).
    expect(teamById(g1, aiFixture.homeTeamId).facilityBuild).toBeTruthy();
    // The player never auto-spends: no build, same facilities as before.
    expect(playerTeam(g1).facilityBuild).toBeUndefined();
    expect(facLevels(g1, g0.playerTeamId)).toBe(facLevels(g0, g0.playerTeamId));
  });
});

describe('taming beasts', () => {
  it('is blocked without a menagerie, then works once one unlocks the beast', () => {
    const g0 = game();
    const beastId = g0.beasts[0];
    expect(playerTeam(g0).facilities.menagerie).toBe(0);
    expect(beastsUnlocked(0)).toBe(0);

    // No menagerie: caged, taming is a no-op.
    expect(tameBeast(g0, beastId)).toBe(g0);

    // A finished menagerie (unlocks the first beasts) lets you tame one.
    const pid = g0.playerTeamId;
    const g1 = { ...g0, teams: g0.teams.map((t) => (t.id === pid ? { ...t, facilities: { ...t.facilities, menagerie: 1 } } : t)) };
    expect(beastsUnlocked(playerTeam(g1).facilities.menagerie)).toBeGreaterThan(0);
    const budgetBefore = playerTeam(g1).budget;
    const rosterBefore = playerTeam(g1).fighterIds.length;

    const g2 = tameBeast(g1, beastId);
    expect(playerTeam(g2).fighterIds).toContain(beastId);
    expect(g2.beasts).not.toContain(beastId);
    expect(playerTeam(g2).budget).toBe(budgetBefore - BEAST_TAME_FEE);
    expect(playerTeam(g2).fighterIds.length).toBe(rosterBefore + 1);
  });

  it('keeps still-caged beasts unavailable beyond the menagerie level', () => {
    const g0 = upgradeFacility(game(), game().playerTeamId, 'menagerie');
    const lockedIndex = beastsUnlocked(1); // first index still beyond unlock
    const lockedId = g0.beasts[lockedIndex];
    expect(tameBeast(g0, lockedId)).toBe(g0);
  });
});

describe('injury attrition invariants', () => {
  it('across many seasons, no squad is ever left unable to field six, and no lineup dangles', () => {
    let g = createGame(777, 0);
    for (let s = 0; s < 6; s++) {
      // Play out the whole season.
      let guard = 0;
      while (!seasonComplete(g.fixtures) && guard++ < 100) {
        const fx = g.fixtures.find((f) => !f.played)!;
        const inputs = buildMatchInputs(g, fx);
        g = recordResult(g, fx.id, 24, 17, inputs.fieldedIds);
        // Every team can still field a match.
        for (const t of g.teams) expect(t.fighterIds.length).toBeGreaterThanOrEqual(SQUAD_SIZE);
        // The player's lineup never references a fighter who left the game.
        for (const id of g.playerLineup.fighterIds) expect(g.fighters[id]).toBeDefined();
      }
      g = advanceSeason(g);
    }
  });
});

describe('morale', () => {
  it('lifts a winning side and dents a losing one', () => {
    const g0 = game();
    const fx = playerHomeFixture(g0); // player at home
    const homeIds = teamById(g0, fx.homeTeamId).fighterIds.slice(0, 6);
    const awayIds = teamById(g0, fx.awayTeamId).fighterIds.slice(0, 6);
    const before = (g: typeof g0, id: string) => g.fighters[id].morale ?? 60;
    const homeM0 = before(g0, homeIds[0]);
    const awayM0 = before(g0, awayIds[0]);

    // Home win.
    const g1 = recordResult(g0, fx.id, 30, 10, [...homeIds, ...awayIds]);
    expect(before(g1, homeIds[0])).toBeGreaterThan(homeM0);
    expect(before(g1, awayIds[0])).toBeLessThan(awayM0);
  });
});

describe('news feed', () => {
  it('records a result item when the player plays, newest first', () => {
    const g0 = game();
    const fx = playerHomeFixture(g0);
    const fielded = [...teamById(g0, fx.homeTeamId).fighterIds.slice(0, 6),
                     ...teamById(g0, fx.awayTeamId).fighterIds.slice(0, 6)];
    const before = g0.news.length;
    const g1 = recordResult(g0, fx.id, 30, 12, fielded);
    expect(g1.news.length).toBeGreaterThan(before);
    expect(g1.news[0].category).toBe('result');
    expect(g1.news[0].text).toContain('30–12');
  });

  it('stays silent about a fixture the player is not in', () => {
    const g0 = game();
    const aiFx = g0.fixtures.find(
      (f) => f.homeTeamId !== g0.playerTeamId && f.awayTeamId !== g0.playerTeamId,
    )!;
    const fielded = [...teamById(g0, aiFx.homeTeamId).fighterIds.slice(0, 6),
                     ...teamById(g0, aiFx.awayTeamId).fighterIds.slice(0, 6)];
    const g1 = recordResult(g0, aiFx.id, 20, 19, fielded);
    expect(g1.news.every((n) => n.category !== 'result')).toBe(true);
  });
});

describe('difficulty', () => {
  it('sets the starting budget from the chosen preset and records it', () => {
    const relaxed = createGame(1, 0, 'relaxed');
    const brutal = createGame(1, 0, 'brutal');
    expect(playerTeam(relaxed).budget).toBeGreaterThan(playerTeam(brutal).budget);
    expect(relaxed.difficulty).toBe('relaxed');
    expect(brutal.difficulty).toBe('brutal');
  });
});

describe('knockout cup', () => {
  it('starts with a first round and crowns a champion after enough rounds', () => {
    let g = game();
    expect(g.cup.championId).toBeNull();
    expect(g.cup.ties.length).toBeGreaterThan(0);

    // Resolve rounds until a winner is decided (bounded to avoid a runaway).
    let guard = 0;
    while (g.cup.championId === null && guard++ < 10) {
      g = resolveCupRound(g);
    }
    expect(g.cup.championId).not.toBeNull();
    // The champion is one of the league's teams, and the win was logged.
    expect(g.teams.some((t) => t.id === g.cup.championId)).toBe(true);
    expect(g.cup.log.length).toBeGreaterThan(0);
    expect(g.news.some((n) => n.text.includes('Cup'))).toBe(true);
  });

  it('is a no-op once the cup is already decided', () => {
    let g = game();
    let guard = 0;
    while (g.cup.championId === null && guard++ < 10) g = resolveCupRound(g);
    const after = resolveCupRound(g);
    expect(after).toBe(g);
  });
});

describe('history and legacy', () => {
  it('records the league champion each season', () => {
    const g0 = game();
    expect(g0.champions).toHaveLength(0);
    const finished = { ...g0, fixtures: g0.fixtures.map((f) => ({ ...f, played: true, homeScore: 20, awayScore: 18 })) };
    const g1 = advanceSeason(finished);
    expect(g1.champions).toHaveLength(1);
    expect(g1.champions[0].season).toBe(g0.season);
    expect(g1.champions[0].name.length).toBeGreaterThan(0);
  });

  it('inducts a retired player fighter into the hall of fame', () => {
    const g0 = game();
    // Age the whole player roster past retirement so someone hangs it up.
    const pids = playerTeam(g0).fighterIds;
    const aged = {
      ...g0,
      fixtures: g0.fixtures.map((f) => ({ ...f, played: true, homeScore: 20, awayScore: 18 })),
      fighters: Object.fromEntries(
        Object.entries(g0.fighters).map(([id, f]) => [id, pids.includes(id) ? { ...f, age: 40 } : f]),
      ),
    };
    const g1 = advanceSeason(aged);
    expect(g1.hallOfFame.length).toBeGreaterThan(0);
    expect(g1.hallOfFame[0].cause).toBe('retired');
  });
});

describe('patron objectives', () => {
  it('moves confidence and sets a new objective at the season turn', () => {
    const g0 = game();
    const conf0 = g0.patronConfidence;
    // A finished season where the player finished top (won every home game big).
    const finished = {
      ...g0,
      fixtures: g0.fixtures.map((f) => ({
        ...f, played: true,
        homeScore: f.homeTeamId === g0.playerTeamId ? 40 : 10,
        awayScore: f.awayTeamId === g0.playerTeamId ? 40 : 10,
      })),
    };
    const g1 = advanceSeason(finished);
    // Confidence changed and a fresh objective exists for the new season.
    expect(g1.patronConfidence).not.toBe(conf0);
    expect(g1.objective.text.length).toBeGreaterThan(0);
    expect(g1.news.some((n) => n.text.includes('sponsor'))).toBe(true);
  });
});

describe('contracts', () => {
  it('re-signs an expiring player fighter for a fee, extending the deal', () => {
    const g0 = game();
    const pid = playerTeam(g0).id;
    const fid = playerTeam(g0).fighterIds[0];
    // Force the deal to its final season.
    const g1 = { ...g0, fighters: { ...g0.fighters, [fid]: { ...g0.fighters[fid], contractSeasons: 1 } } };
    const budget0 = playerTeam(g1).budget;
    const g2 = renewContract(g1, fid);
    expect(contractSeasonsOf(g2.fighters[fid])).toBeGreaterThan(1);
    expect(teamById(g2, pid).budget).toBeLessThan(budget0);
  });

  it('lets an un-renewed deal lapse to free agency at the season turn', () => {
    const g0 = game();
    const fid = playerTeam(g0).fighterIds[0];
    // One expiring fighter, season finished, and a comfortably deep squad so
    // the floor guard does not force a retention.
    const finished = {
      ...g0,
      fixtures: g0.fixtures.map((f) => ({ ...f, played: true, homeScore: 20, awayScore: 18 })),
      fighters: { ...g0.fighters, [fid]: { ...g0.fighters[fid], contractSeasons: 1, age: 24 } },
    };
    const g1 = advanceSeason(finished);
    // They are no longer on the player's roster, and joined the free-agent pool.
    expect(playerTeam(g1).fighterIds).not.toContain(fid);
    expect(g1.freeAgents).toContain(fid);
  });
});

describe('season rollover', () => {
  it('is a no-op until the season is complete', () => {
    const g0 = game();
    expect(seasonComplete(g0.fixtures)).toBe(false);
    expect(advanceSeason(g0)).toBe(g0);
  });

  it('pays prize money, heals injuries, and starts a fresh fixture list', () => {
    const g0 = game();
    // Force a finished season: every fixture played, and one fighter injured.
    const anyId = playerTeam(g0).fighterIds[0];
    const finished: typeof g0 = {
      ...g0,
      fixtures: g0.fixtures.map((f) => ({ ...f, played: true, homeScore: 20, awayScore: 18 })),
      fighters: { ...g0.fighters, [anyId]: { ...g0.fighters[anyId], injuryWeeks: 3 } },
    };
    const budgetBefore = playerTeam(finished).budget;
    const fixtureCount = finished.fixtures.length;

    const g1 = advanceSeason(finished);
    expect(g1.season).toBe(g0.season + 1);
    expect(playerTeam(g1).budget).toBeGreaterThan(budgetBefore); // placement prize
    expect(g1.fighters[anyId].injuryWeeks).toBe(0); // off-season heal
    expect(g1.fixtures.length).toBe(fixtureCount);
    expect(seasonComplete(g1.fixtures)).toBe(false); // all unplayed again
    // Everyone aged a year.
    expect(g1.fighters[anyId].age).toBe(g0.fighters[anyId].age + 1);
    // Reputation accrued from the finish.
    expect(playerTeam(g1).reputation).toBeGreaterThan(playerTeam(g0).reputation);
    // A review of the finished season is captured for the UI.
    expect(g1.lastReview?.season).toBe(g0.season);
    expect(g1.lastReview?.championName).toBeTruthy();
    expect(g1.lastReview?.intakeCount).toBeGreaterThan(0);
  });

  it('lets a short-handed rival sign a free agent in the off-season', () => {
    const g0 = game();
    const aiId = g0.teams.find((t) => !t.isPlayer)!.id;
    // Leave a rival a man short so it will recruit, and note the pool.
    const short = {
      ...g0,
      fixtures: g0.fixtures.map((f) => ({ ...f, played: true, homeScore: 20, awayScore: 18 })),
      teams: g0.teams.map((t) => (t.id === aiId ? { ...t, fighterIds: t.fighterIds.slice(0, -1) } : t)),
    };
    const beforeAi = new Set(short.teams.filter((t) => !t.isPlayer).flatMap((t) => t.fighterIds));
    const g1 = advanceSeason(short);
    // A rival has claimed someone new from the market (an old free agent or a
    // fresh prospect — a youth-minded stable may reach for the latter).
    const signed = g1.teams
      .filter((t) => !t.isPlayer)
      .flatMap((t) => t.fighterIds)
      .filter((id) => !beforeAi.has(id));
    expect(signed.length).toBeGreaterThan(0);
    // Every rival roster stays within the legal cap.
    g1.teams.filter((t) => !t.isPlayer).forEach((t) => expect(t.fighterIds.length).toBeLessThanOrEqual(9));
  });

  it('brings in a fresh crop of young free agents each season', () => {
    const g0 = game();
    const finished: typeof g0 = {
      ...g0,
      fixtures: g0.fixtures.map((f) => ({ ...f, played: true, homeScore: 20, awayScore: 18 })),
    };
    const beforeYoungest = Math.min(...g0.freeAgents.map((id) => g0.fighters[id].age));
    const g1 = advanceSeason(finished);
    expect(g1.freeAgents.length).toBeGreaterThan(g0.freeAgents.length);
    // The intake is teenage talent — younger than anything in the old pool.
    const newcomers = g1.freeAgents.filter((id) => !g0.freeAgents.includes(id));
    expect(newcomers.length).toBeGreaterThan(0);
    expect(Math.min(...newcomers.map((id) => g1.fighters[id].age))).toBeLessThanOrEqual(beforeYoungest);
  });
});

describe('finance settlement', () => {
  it('banks nothing extra when the home team has no stadium', () => {
    const g0 = game();
    const fixture = playerHomeFixture(g0);
    const homeId = fixture.homeTeamId;
    expect(teamById(g0, homeId).facilities.stadium).toBe(0);
    const before = teamById(g0, homeId).budget;
    const fielded = g0.teams.find((t) => t.id === homeId)!.fighterIds.slice(0, 6);
    const g1 = recordResult(g0, fixture.id, 20, 20, fielded);
    // Drew: draw prize (scaled by any corp income perk) minus wages, zero gate.
    const delta = teamById(g1, homeId).budget - before;
    const wages = g0.teams.find((t) => t.id === homeId)!.fighterIds
      .reduce((s, id) => s + g0.fighters[id].wage, 0);
    const prize = Math.round(PRIZE_DRAW * incomeMultiplier(corpByKey(teamById(g0, homeId).corpKey).perk));
    expect(delta).toBe(prize - wages);
  });
});
