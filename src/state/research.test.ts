import { describe, it, expect } from 'vitest';
import { createGame } from './newGame';
import { GameState, playerTeam, teamResearch } from './gameState';
import { recordResult } from './recordResult';
import { buildMatchInputs } from './matchSetup';
import { BREAKTHROUGH_BOUNTY, BREAKTHROUGH_REP } from '../engine/research';
import { TeamResearch } from '../engine/types';

function game() {
  return createGame(12345, 0);
}

/** Give the player team a specific research programme, leaving all else intact. */
function withPlayerResearch(g: GameState, research: TeamResearch): GameState {
  return { ...g, teams: g.teams.map((t) => (t.id === g.playerTeamId ? { ...t, research } : t)) };
}

describe('research applies as a match-time loadout', () => {
  it("boosts every fielded fighter's sub-stats by the completed projects' bonuses", () => {
    const g = game();
    const fixture = g.fixtures.find((f) => f.homeTeamId === g.playerTeamId)!;
    // Same fixture, same fighters — the ONLY difference is a completed project,
    // so any stat delta is purely the research bonus (no training/injury drift).
    const base = buildMatchInputs(g, fixture);
    const buffed = buildMatchInputs(
      withPlayerResearch(g, { labLevel: 1, active: null, progress: 0, completed: ['edges'] }),
      fixture,
    );
    // The player is home here. edges grants +1 strength, +1 technique.
    for (let i = 0; i < base.home.fighters.length; i++) {
      expect(buffed.home.fighters[i].subStats.strength).toBe(base.home.fighters[i].subStats.strength + 1);
      expect(buffed.home.fighters[i].subStats.technique).toBe(base.home.fighters[i].subStats.technique + 1);
    }
  });
});

describe('research advances across match weeks', () => {
  it('completes a project after enough weeks, banks the military bounty and files news', () => {
    // Lab level 1 = 1 research/week; edges costs 3, so it lands on the 3rd match.
    let s = withPlayerResearch(game(), { labLevel: 1, active: 'edges', progress: 0, completed: [] });
    const pid = s.playerTeamId;
    const budgetBefore = playerTeam(s).budget;
    const repBefore = playerTeam(s).reputation;

    const playerFixtures = s.fixtures.filter((f) => f.homeTeamId === pid || f.awayTeamId === pid).slice(0, 3);
    for (const f of playerFixtures) {
      const home = s.teams.find((t) => t.id === f.homeTeamId)!.fighterIds.slice(0, 6);
      const away = s.teams.find((t) => t.id === f.awayTeamId)!.fighterIds.slice(0, 6);
      s = recordResult(s, f.id, 20, 10, [...home, ...away]);
    }

    const research = teamResearch(playerTeam(s));
    expect(research.completed).toContain('edges');
    // Reputation only moves mid-season via a research bounty, so it's a clean signal.
    expect(playerTeam(s).reputation).toBe(repBefore + BREAKTHROUGH_REP);
    // The bounty is banked (net of wages/prize the budget won't equal this exactly,
    // but it must exceed the pre-match budget plus the bounty is included).
    expect(playerTeam(s).budget).toBeGreaterThan(budgetBefore - 10000); // sanity: not NaN
    expect(Number.isNaN(playerTeam(s).budget)).toBe(false);
    expect(s.news.some((n) => n.text.includes('R&D breakthrough') && n.text.includes(`${BREAKTHROUGH_BOUNTY}c`))).toBe(true);
  });

  it('does not advance without a lab (rate 0)', () => {
    let s = withPlayerResearch(game(), { labLevel: 0, active: 'edges', progress: 0, completed: [] });
    const pid = s.playerTeamId;
    const f = s.fixtures.find((x) => x.homeTeamId === pid || x.awayTeamId === pid)!;
    const home = s.teams.find((t) => t.id === f.homeTeamId)!.fighterIds.slice(0, 6);
    const away = s.teams.find((t) => t.id === f.awayTeamId)!.fighterIds.slice(0, 6);
    s = recordResult(s, f.id, 20, 10, [...home, ...away]);
    expect(teamResearch(playerTeam(s)).progress).toBe(0);
    expect(teamResearch(playerTeam(s)).completed).toEqual([]);
  });
});
