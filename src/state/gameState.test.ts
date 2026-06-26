import { describe, it, expect } from 'vitest';
import { createGame } from './newGame';
import { playerTeam, recordResult, signFreeAgent, teamById, upgradeFacility } from './gameState';
import { rosterCap, stadiumGate } from '../engine/facilities';

/** A fresh deterministic game to mutate in tests. */
function game() {
  return createGame(12345, 0);
}

describe('stadium gate income', () => {
  it("credits the home team exactly the stadium gate, isolated from wages/prize", () => {
    const g0 = game();
    const fixture = g0.fixtures[0];
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

describe('finance settlement', () => {
  it('banks nothing extra when the home team has no stadium', () => {
    const g0 = game();
    const fixture = g0.fixtures[0];
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
