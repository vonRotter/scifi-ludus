import { describe, it, expect } from 'vitest';
import { createGame } from './newGame';
import { advanceSeason, BEAST_TAME_FEE, playerTeam, recordResult, signFreeAgent, tameBeast, teamById, upgradeFacility } from './gameState';
import { seasonComplete } from '../engine/season';
import { beastsUnlocked, rosterCap, stadiumGate } from '../engine/facilities';
import { SQUAD_SIZE } from '../engine/constants';
import { buildMatchInputs } from './matchSetup';

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
    const gStadium = upgradeFacility(g0, homeId, 'stadium');
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

describe('roster cap (housing)', () => {
  it('blocks signing once beds are full, and a housing upgrade frees more', () => {
    const g0 = game();
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

      // Build housing to add beds, then the same signing succeeds.
      const roomier = upgradeFacility(g, playerTeam(g).id, 'housing');
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

    const homeBefore = facLevels(flush, aiFixture.homeTeamId);
    const fielded = [...teamById(flush, aiFixture.homeTeamId).fighterIds.slice(0, 6),
                     ...teamById(flush, aiFixture.awayTeamId).fighterIds.slice(0, 6)];
    const g1 = recordResult(flush, aiFixture.id, 22, 19, fielded);

    expect(facLevels(g1, aiFixture.homeTeamId)).toBeGreaterThan(homeBefore);
    // The player's own facilities never change from recording a result.
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

    // Build a menagerie (unlocks the first beasts) and tame one.
    const g1 = upgradeFacility(g0, g0.playerTeamId, 'menagerie');
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
    // Drew: prize draw (120) minus wages, and zero gate.
    const delta = teamById(g1, homeId).budget - before;
    const wages = g0.teams.find((t) => t.id === homeId)!.fighterIds
      .reduce((s, id) => s + g0.fighters[id].wage, 0);
    expect(delta).toBe(120 - wages);
  });
});
