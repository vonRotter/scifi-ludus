import { describe, it, expect } from 'vitest';
import { simulateMatch } from './simulate';
import { generateContent } from '../../data/seedFighters';
import { ARENAS } from '../../data/arenas';
import { SQUAD_SIZE } from '../constants';
import { Fighter, Role, SquadInput, Side, Tactics } from '../types';

function squad(fighters: Fighter[], side: Side, role: Role = 'frontline'): SquadInput {
  const roles: Record<string, Role> = {};
  for (const f of fighters) roles[f.id] = role;
  const tactics: Tactics = { posture: 'balanced', focus: 'objective', roles };
  return { side, fighters: fighters.slice(0, SQUAD_SIZE), tactics };
}

function content() {
  const c = generateContent(12345);
  const list = (teamIdx: number) =>
    c.teams[teamIdx].fighterIds.map((id) => c.fighters[id]);
  return { home: list(0), away: list(1) };
}

describe('simulateMatch determinism', () => {
  it('same fighters, terrain, tactics and seed yield an identical result', () => {
    const { home, away } = content();
    const a = simulateMatch(squad(home, 'home'), squad(away, 'away'), ARENAS[0], 777);
    const b = simulateMatch(squad(home, 'home'), squad(away, 'away'), ARENAS[0], 777);
    expect(a.homeScore).toBe(b.homeScore);
    expect(a.awayScore).toBe(b.awayScore);
    expect(a.winner).toBe(b.winner);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('a different seed can change the result', () => {
    const { home, away } = content();
    const results = new Set<string>();
    for (let s = 0; s < 12; s++) {
      const r = simulateMatch(squad(home, 'home'), squad(away, 'away'), ARENAS[0], s);
      results.add(`${r.homeScore}-${r.awayScore}`);
    }
    expect(results.size).toBeGreaterThan(1);
  });
});

describe('simulateMatch produces sensible matches', () => {
  it('emits a non-trivial timeline for both rounds', () => {
    const { home, away } = content();
    const r = simulateMatch(squad(home, 'home'), squad(away, 'away'), ARENAS[0], 1);
    expect(r.rounds[0].frames.length).toBeGreaterThan(10);
    expect(r.rounds[1].frames.length).toBeGreaterThan(10);
    expect(r.rounds[0].frames[0].fighters.length).toBe(SQUAD_SIZE * 2);
  });

  it('produces a varied scoreline distribution across many seeds', () => {
    const { home, away } = content();
    let homeWins = 0;
    let awayWins = 0;
    let draws = 0;
    for (let s = 0; s < 60; s++) {
      const r = simulateMatch(squad(home, 'home'), squad(away, 'away'), ARENAS[s % ARENAS.length], s);
      if (r.winner === 'home') homeWins++;
      else if (r.winner === 'away') awayWins++;
      else draws++;
    }
    // Neither side should win literally everything; results should vary.
    expect(homeWins + awayWins + draws).toBe(60);
    expect(homeWins).toBeGreaterThan(0);
    expect(awayWins).toBeGreaterThan(0);
  });

  it('has no systematic home/away side bias (each pairing, both orientations)', () => {
    // Distinct rosters played both ways cancels roster strength, leaving only
    // any side advantage. The field and squads are mirror-symmetric, so home
    // should win roughly half. Guards against terrain/targeting asymmetries.
    const rosters: Fighter[][] = [];
    for (let g = 0; g < 8; g++) {
      const c = generateContent(2000 + g);
      for (let t = 0; t < 3; t++) rosters.push(c.teams[t].fighterIds.map((id) => c.fighters[id]));
    }
    let homeWins = 0;
    let games = 0;
    for (let i = 0; i < rosters.length; i++) {
      for (let j = 0; j < rosters.length; j++) {
        if (i === j) continue;
        const seed = i * 31 + j * 7 + 5;
        const r = simulateMatch(squad(rosters[i], 'home'), squad(rosters[j], 'away'), ARENAS[seed % ARENAS.length], seed);
        if (r.winner === 'home') homeWins++;
        games++;
      }
    }
    const homePct = homeWins / games;
    expect(homePct).toBeGreaterThan(0.4);
    expect(homePct).toBeLessThan(0.6);
  });

  it('point-symmetric arenas stay side-fair (each pairing, both orientations)', () => {
    // The rotation-symmetry proof obligation: a 180°-symmetric arena, played by
    // distinct rosters both ways, must not favour a side. Checked per point
    // arena so a diagonal-layout bias can't hide in the all-arenas average.
    const rosters: Fighter[][] = [];
    for (let g = 0; g < 6; g++) {
      const c = generateContent(3000 + g);
      for (let t = 0; t < 3; t++) rosters.push(c.teams[t].fighterIds.map((id) => c.fighters[id]));
    }
    const pointArenas = ARENAS.filter((a) => a.symmetry === 'point');
    expect(pointArenas.length).toBeGreaterThan(0);
    for (const a of pointArenas) {
      let homeWins = 0;
      let games = 0;
      for (let i = 0; i < rosters.length; i++) {
        for (let j = 0; j < rosters.length; j++) {
          if (i === j) continue;
          const seed = i * 29 + j * 11 + 3;
          const r = simulateMatch(squad(rosters[i], 'home'), squad(rosters[j], 'away'), a, seed);
          if (r.winner === 'home') homeWins++;
          games++;
        }
      }
      const homePct = homeWins / games;
      expect(homePct, `${a.id} home win rate ${homePct.toFixed(3)}`).toBeGreaterThan(0.4);
      expect(homePct, `${a.id} home win rate ${homePct.toFixed(3)}`).toBeLessThan(0.6);
    }
  });

  it('half-time tactics change only re-runs round two', () => {
    const { home, away } = content();
    const baseHome = squad(home, 'home');
    const baseAway = squad(away, 'away');
    const noChange = simulateMatch(baseHome, baseAway, ARENAS[0], 42);
    const changed = simulateMatch(baseHome, baseAway, ARENAS[0], 42, {
      round2: {
        home: { ...baseHome.tactics, posture: 'aggressive' },
        away: baseAway.tactics,
      },
    });
    // Round one is seeded identically and unaffected by the round-two change.
    expect(JSON.stringify(noChange.rounds[0])).toBe(JSON.stringify(changed.rounds[0]));
  });
});
