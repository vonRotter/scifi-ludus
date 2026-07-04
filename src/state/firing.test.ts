import { describe, it, expect } from 'vitest';
import { createGame } from './newGame';
import { GameState, playerTeam } from './gameState';
import { advanceSeason } from './rollover';

function game() {
  return createGame(4242, 0);
}

/** Play out the season with the player finishing dead last every fixture. */
function seasonWherePlayerLosesAll(g: GameState): GameState {
  const pid = g.playerTeamId;
  return {
    ...g,
    fixtures: g.fixtures.map((f) => ({
      ...f,
      played: true,
      // Player scores 0, opponents 30; player finishes bottom.
      homeScore: f.homeTeamId === pid ? 0 : 30,
      awayScore: f.awayTeamId === pid ? 0 : 30,
    })),
  };
}

describe('sponsor confidence and firing', () => {
  it('does not fire while confidence survives a single bad season', () => {
    // Start confidence 60; one miss (-18) -> 42, well above zero.
    const g1 = advanceSeason(seasonWherePlayerLosesAll(game()));
    expect(g1.careerOver).toBeFalsy();
    expect(g1.season).toBe(2); // rolled into the next season
    expect(g1.patronConfidence).toBeLessThan(60);
  });

  it('fires the manager when confidence is drained to zero, ending the career', () => {
    let g = game();
    // Drive confidence down over successive failed seasons until the sack.
    let fired = false;
    for (let i = 0; i < 6; i++) {
      const before = playerTeam(g).name;
      g = advanceSeason(seasonWherePlayerLosesAll(g));
      if (g.careerOver) {
        fired = true;
        expect(g.careerOver.reason).toBe('fired');
        expect(g.careerOver.message).toContain(before); // names the stable
        expect(g.patronConfidence).toBe(0);
        expect(g.news.some((n) => n.text.includes('Sacked'))).toBe(true);
        break;
      }
      // Re-arm the next season as an all-loss run (advanceSeason made new fixtures).
      g = seasonWherePlayerLosesAll(g);
    }
    expect(fired).toBe(true);
  });

  it('a fired career does not generate a further season', () => {
    let g = game();
    let seasonAtFiring = 0;
    for (let i = 0; i < 6; i++) {
      const prevSeason = g.season;
      g = advanceSeason(seasonWherePlayerLosesAll(g));
      if (g.careerOver) { seasonAtFiring = prevSeason; break; }
      g = seasonWherePlayerLosesAll(g);
    }
    // On firing the season counter is frozen at the season that just ended.
    expect(g.careerOver?.season).toBe(seasonAtFiring);
    expect(g.season).toBe(seasonAtFiring);
  });
});
