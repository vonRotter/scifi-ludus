import { describe, it, expect } from 'vitest';
import { createGame } from './newGame';
import { recordResult, teamById, upgradeFacility } from './gameState';
import { stadiumGate } from '../engine/facilities';

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
