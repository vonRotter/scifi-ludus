import { describe, it, expect } from 'vitest';
import { simulateMatch } from './simulate';
import { chooseLineup } from '../ai';
import { generateContent } from '../../data/seedFighters';
import { ARENAS } from '../../data/arenas';
import { makeRng, hashString } from '../rng';
import { SCORE_PER_DOWN } from '../constants';
import { Fighter, Focus, MatchResult, Posture, SquadInput, Side } from '../types';

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
      // Rotate the arena by a running counter, NOT by the roster-pair seed: the
      // latter aliases a matchup's index with its arena, so a lopsided pairing
      // can land systematically on an arena that flatters one tactic, and the
      // estimate lurches whenever the arena count changes. An even round-robin
      // decouples the two, so this measures true tactic balance across the whole
      // arena set (and stays stable as arenas are added).
      let pick = 0;
      for (let i = 0; i < teams.length; i++) {
        for (let j = 0; j < teams.length; j++) {
          if (i === j) continue;
          const seed = i * 17 + j * 3 + 1;
          const arena = ARENAS[pick++ % ARENAS.length];
          const ti = teams[i];
          const tj = teams[j];
          // Both orientations so any side bias cancels out.
          const r1 = simulateMatch(
            squad(ti.roster, ti.fById, 'home', a, hashString(`${i}`)),
            squad(tj.roster, tj.fById, 'away', b, hashString(`${j}`)),
            arena,
            seed,
          );
          if (r1.winner === 'home') aWins++;
          const r2 = simulateMatch(
            squad(tj.roster, tj.fById, 'home', b, hashString(`${j}`)),
            squad(ti.roster, ti.fById, 'away', a, hashString(`${i}`)),
            arena,
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

/** Build a squad at a fixed posture (focus left at the AI's chosen lineup). */
function postureSquad(roster: Fighter[], fById: Record<string, Fighter>, side: Side, posture: Posture, salt: number): SquadInput {
  const lu = chooseLineup('x', roster.map((f) => f.id), fById, makeRng(salt));
  return { side, fighters: lu.fighterIds.map((id) => fById[id]), tactics: { ...lu.tactics, posture } };
}

/**
 * Fatigue makes posture a real trade-off (aggressive burns energy faster and
 * fades in round two), so guard that it did NOT tip aggressive-vs-defensive into
 * a dominant strategy: head-to-head must still land inside 35%..65%.
 */
describe('posture balance under fatigue', () => {
  it('aggressive vs defensive is not a dominant strategy', () => {
    const teams = rosters();
    let aggWins = 0;
    let games = 0;
    for (let i = 0; i < teams.length; i++) {
      for (let j = 0; j < teams.length; j++) {
        if (i === j) continue;
        const seed = i * 17 + j * 3 + 1;
        const ti = teams[i];
        const tj = teams[j];
        const r1 = simulateMatch(
          postureSquad(ti.roster, ti.fById, 'home', 'aggressive', hashString(`${i}`)),
          postureSquad(tj.roster, tj.fById, 'away', 'defensive', hashString(`${j}`)),
          ARENAS[seed % ARENAS.length], seed,
        );
        if (r1.winner === 'home') aggWins++;
        const r2 = simulateMatch(
          postureSquad(tj.roster, tj.fById, 'home', 'defensive', hashString(`${j}`)),
          postureSquad(ti.roster, ti.fById, 'away', 'aggressive', hashString(`${i}`)),
          ARENAS[seed % ARENAS.length], seed + 1,
        );
        if (r2.winner === 'away') aggWins++;
        games += 2;
      }
    }
    const aggPct = aggWins / games;
    expect(aggPct).toBeGreaterThan(0.35);
    expect(aggPct).toBeLessThan(0.65);
  });
});

/**
 * Both scoring sources must stay meaningful: if downs (or the zone) came to
 * dominate, a whole tactic would be pointless. Guards against a degenerate
 * all-deathball or all-zone meta after any combat/targeting/scoring change.
 */
describe('scoring mix', () => {
  it('splits points between downs and the objective (zone is 15–45% of total)', () => {
    const teams = rosters();
    let downPts = 0;
    let totalPts = 0;
    const downPointsFor = (r: MatchResult, side: Side): number => {
      let downs = 0;
      for (const id of Object.keys(r.stats)) if (r.stats[id].side === side) downs += r.stats[id].downsScored;
      return downs * SCORE_PER_DOWN;
    };
    for (let i = 0; i < teams.length; i++) {
      const j = (i + 1) % teams.length;
      for (let s = 0; s < 8; s++) {
        const seed = i * 29 + s * 7 + 3;
        const r = simulateMatch(
          squad(teams[i].roster, teams[i].fById, 'home', 'objective', hashString(`${i}`)),
          squad(teams[j].roster, teams[j].fById, 'away', 'melee', hashString(`${j}`)),
          ARENAS[seed % ARENAS.length], seed,
        );
        const dp = downPointsFor(r, 'home') + downPointsFor(r, 'away');
        downPts += dp;
        totalPts += r.homeScore + r.awayScore;
      }
    }
    const zoneShare = 1 - downPts / totalPts;
    expect(zoneShare).toBeGreaterThan(0.15);
    expect(zoneShare).toBeLessThan(0.45);
  });
});
