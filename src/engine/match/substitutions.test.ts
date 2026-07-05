import { describe, it, expect } from 'vitest';
import { simulateMatch } from './simulate';
import { generateContent } from '../../data/seedFighters';
import { ARENAS } from '../../data/arenas';
import { SQUAD_SIZE } from '../constants';
import { Fighter, Role, Side, SquadInput, Tactics } from '../types';

function squad(fighters: Fighter[], side: Side): SquadInput {
  const roles: Record<string, Role> = {};
  for (const f of fighters) roles[f.id] = 'frontline';
  const tactics: Tactics = { posture: 'balanced', focus: 'objective', roles };
  return { side, fighters: fighters.slice(0, SQUAD_SIZE), tactics };
}

function tacticsFor(fighters: Fighter[]): Tactics {
  const roles: Record<string, Role> = {};
  for (const f of fighters) roles[f.id] = 'frontline';
  return { posture: 'aggressive', focus: 'melee', roles };
}

describe('half-time substitutions', () => {
  it('brings a reserve on for round two: fresh legs, credited in the totals', () => {
    const c = generateContent(9090);
    const homeAll = c.teams[0].fighterIds.map((id) => c.fighters[id]);
    const away = c.teams[1].fighterIds.map((id) => c.fighters[id]);
    const starters = homeAll.slice(0, SQUAD_SIZE);
    const sub = homeAll[SQUAD_SIZE]; // the seventh fighter, on the bench

    // Round two: swap the last starter out for the reserve.
    const round2Home = [...starters.slice(0, SQUAD_SIZE - 1), sub];
    const benched = starters[SQUAD_SIZE - 1];

    const r = simulateMatch(squad(starters, 'home'), squad(away, 'away'), ARENAS[0], 3, {
      round2: { home: tacticsFor(round2Home), away: squad(away, 'away').tactics },
      round2Fighters: { home: round2Home },
    });

    // Round one fielded the starters; the reserve did not feature.
    expect(r.rounds[0].stats[sub.id]).toBeUndefined();
    expect(r.rounds[0].stats[benched.id]).toBeDefined();

    // Round two fielded the reserve and not the benched starter.
    expect(r.rounds[1].stats[sub.id]).toBeDefined();
    expect(r.rounds[1].stats[benched.id]).toBeUndefined();

    // Match totals credit the reserve, and it has a rating.
    expect(r.stats[sub.id]).toBeDefined();
    expect(r.ratings[sub.id]).toBeGreaterThanOrEqual(2);

    // The reserve enters round two at full energy (fresh legs).
    const r2Start = r.rounds[1].frames[0].fighters.find((f) => f.id === sub.id);
    expect(r2Start?.energy).toBe(1);
  });

  it('leaves round one untouched (subs only affect round two)', () => {
    const c = generateContent(4242);
    const homeAll = c.teams[0].fighterIds.map((id) => c.fighters[id]);
    const away = c.teams[2].fighterIds.map((id) => c.fighters[id]);
    const starters = homeAll.slice(0, SQUAD_SIZE);
    const round2Home = [...starters.slice(0, SQUAD_SIZE - 1), homeAll[SQUAD_SIZE]];

    const noSub = simulateMatch(squad(starters, 'home'), squad(away, 'away'), ARENAS[1], 8);
    const withSub = simulateMatch(squad(starters, 'home'), squad(away, 'away'), ARENAS[1], 8, {
      round2: { home: tacticsFor(round2Home), away: squad(away, 'away').tactics },
      round2Fighters: { home: round2Home },
    });

    expect(JSON.stringify(withSub.rounds[0])).toBe(JSON.stringify(noSub.rounds[0]));
  });
});
