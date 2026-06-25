import { describe, it, expect } from 'vitest';
import { simulateMatch } from './simulate';
import { chooseLineup } from '../ai';
import { generateContent } from '../../data/seedFighters';
import { ARENAS } from '../../data/arenas';
import { makeRng, hashString } from '../rng';
import { Fighter, Focus, SquadInput, Side } from '../types';

/**
 * Build a squad the way the game actually does (best six, roles assigned by the
 * AI from each fighter's strengths), then override only the focus under test.
 * This keeps the balance check faithful to real lineups rather than arbitrary
 * role splits.
 */
function squad(roster: Fighter[], fById: Record<string, Fighter>, side: Side, focus: Focus, salt: number): SquadInput {
  const lu = chooseLineup('x', roster.map((f) => f.id), fById, makeRng(salt));
  return {
    side,
    fighters: lu.fighterIds.map((id) => fById[id]),
    tactics: { ...lu.tactics, posture: 'balanced', focus },
  };
}

function rosters() {
  const teams: { roster: Fighter[]; fById: Record<string, Fighter> }[] = [];
  for (let g = 0; g < 4; g++) {
    const c = generateContent(4100 + g);
    for (let t = 0; t < 3; t++) {
      teams.push({ roster: c.teams[t].fighterIds.map((id) => c.fighters[id]), fById: c.fighters });
    }
  }
  return teams;
}

/** No focus should dominate: head-to-head each should land in 35%..65%. */
describe('tactical balance', () => {
  const pairs: [Focus, Focus][] = [
    ['melee', 'ranged'],
    ['melee', 'objective'],
    ['ranged', 'objective'],
  ];

  for (const [a, b] of pairs) {
    it(`${a} vs ${b} is not a dominant strategy`, () => {
      const teams = rosters();
      let aWins = 0;
      let games = 0;
      for (let i = 0; i < teams.length; i++) {
        for (let j = 0; j < teams.length; j++) {
          if (i === j) continue;
          const seed = i * 17 + j * 3 + 1;
          const ti = teams[i];
          const tj = teams[j];
          // Both orientations so any side bias cancels out.
          const r1 = simulateMatch(
            squad(ti.roster, ti.fById, 'home', a, hashString(`${i}`)),
            squad(tj.roster, tj.fById, 'away', b, hashString(`${j}`)),
            ARENAS[seed % ARENAS.length],
            seed,
          );
          if (r1.winner === 'home') aWins++;
          const r2 = simulateMatch(
            squad(tj.roster, tj.fById, 'home', b, hashString(`${j}`)),
            squad(ti.roster, ti.fById, 'away', a, hashString(`${i}`)),
            ARENAS[seed % ARENAS.length],
            seed + 1,
          );
          if (r2.winner === 'away') aWins++;
          games += 2;
        }
      }
      const aPct = aWins / games;
      expect(aPct).toBeGreaterThan(0.35);
      expect(aPct).toBeLessThan(0.65);
    });
  }
});
