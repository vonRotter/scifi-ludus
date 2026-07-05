import { describe, it, expect } from 'vitest';
import { simulateMatch } from './simulate';
import { computeRatings } from './ratings';
import { mergeStats, newStat } from './events';
import { generateContent } from '../../data/seedFighters';
import { ARENAS } from '../../data/arenas';
import { SQUAD_SIZE } from '../constants';
import { Fighter, MatchStats, Role, Side, SquadInput, Tactics } from '../types';

function squad(fighters: Fighter[], side: Side, role: Role = 'frontline'): SquadInput {
  const roles: Record<string, Role> = {};
  for (const f of fighters) roles[f.id] = role;
  const tactics: Tactics = { posture: 'balanced', focus: 'objective', roles };
  return { side, fighters: fighters.slice(0, SQUAD_SIZE), tactics };
}

function content() {
  const c = generateContent(2468);
  const list = (i: number) => c.teams[i].fighterIds.map((id) => c.fighters[id]);
  return { home: list(0), away: list(1) };
}

describe('match event log & stats', () => {
  it('emits stats for every fielded fighter and events that stay in bounds', () => {
    const { home, away } = content();
    const r = simulateMatch(squad(home, 'home'), squad(away, 'away'), ARENAS[0], 99);

    // Every fielded fighter has a tally in both the round and the match totals.
    expect(Object.keys(r.rounds[0].stats).length).toBe(SQUAD_SIZE * 2);
    expect(Object.keys(r.stats).length).toBe(SQUAD_SIZE * 2);
    for (const id of Object.keys(r.stats)) {
      const s = r.stats[id];
      expect(s.hitsLanded).toBeLessThanOrEqual(s.attempts);
      expect(s.damageDealt).toBeGreaterThanOrEqual(0);
    }

    // Events are timestamped and first-blood, if present, precedes every down.
    for (const round of r.rounds) {
      let sawDown = false;
      for (const e of round.events) {
        expect(e.t).toBeGreaterThan(0);
        if (e.kind === 'down') sawDown = true;
        if (e.kind === 'first-blood') expect(sawDown).toBe(false);
      }
    }
  });

  it('down credits reconcile with downsScored and the scoreline', () => {
    const { home, away } = content();
    const r = simulateMatch(squad(home, 'home'), squad(away, 'away'), ARENAS[2], 7);

    let credited = 0;
    for (const round of r.rounds) {
      for (const e of round.events) {
        if (e.kind === 'down' && e.credit) credited++;
      }
    }
    const totalDowns = Object.values(r.stats).reduce((n, s) => n + s.downsScored, 0);
    expect(totalDowns).toBe(credited);
  });

  it('is deterministic: same seed yields identical stats and events', () => {
    const { home, away } = content();
    const a = simulateMatch(squad(home, 'home'), squad(away, 'away'), ARENAS[1], 55);
    const b = simulateMatch(squad(home, 'home'), squad(away, 'away'), ARENAS[1], 55);
    expect(JSON.stringify(a.stats)).toBe(JSON.stringify(b.stats));
    expect(JSON.stringify(a.rounds[0].events)).toBe(JSON.stringify(b.rounds[0].events));
    expect(JSON.stringify(a.ratings)).toBe(JSON.stringify(b.ratings));
  });
});

describe('ratings', () => {
  it('keeps every rating on the 2..10 band', () => {
    const { home, away } = content();
    const r = simulateMatch(squad(home, 'home'), squad(away, 'away'), ARENAS[0], 12);
    for (const id of Object.keys(r.ratings)) {
      expect(r.ratings[id]).toBeGreaterThanOrEqual(2);
      expect(r.ratings[id]).toBeLessThanOrEqual(10);
    }
  });

  it('rewards downs and damage over a passive fighter', () => {
    const stats: MatchStats = {
      hero: { ...newStat('home'), damageDealt: 120, hitsLanded: 10, attempts: 12, downsScored: 2 },
      passive: { ...newStat('home'), damageDealt: 5, hitsLanded: 1, attempts: 8 },
    };
    const ratings = computeRatings(stats);
    expect(ratings.hero).toBeGreaterThan(ratings.passive);
  });
});

describe('mergeStats', () => {
  it('sums fields and carries fighters present in only one round', () => {
    const a: MatchStats = { x: { ...newStat('home'), damageDealt: 10, downsScored: 1 } };
    const b: MatchStats = {
      x: { ...newStat('home'), damageDealt: 5, downsScored: 2 },
      y: { ...newStat('away'), damageDealt: 3 },
    };
    const m = mergeStats(a, b);
    expect(m.x.damageDealt).toBe(15);
    expect(m.x.downsScored).toBe(3);
    expect(m.y.damageDealt).toBe(3);
  });
});
