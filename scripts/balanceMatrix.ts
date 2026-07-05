/**
 * Balance harness: a Monte-Carlo matchup matrix for tuning the match engine.
 *
 * This is a DEV SCRIPT, not a test — run it by hand after any change that
 * touches combat, movement, targeting, fatigue or scoring, and eyeball the
 * tables. It runs every (focus × focus) and (posture × posture) pairing across
 * a pool of generated rosters and many seeds, both orientations, and prints:
 *   - win-rate matrices (is any tactic dominant?),
 *   - mean scoreline and match length,
 *   - the downs-vs-zone scoring split (is the objective worth contesting?).
 *
 * The engine is a pure, headless function, so this is just a lot of fast calls.
 * Usage:  npx vite-node scripts/balanceMatrix.ts [seeds] [rosters]
 */

import { simulateMatch } from '../src/engine/match/simulate';
import { chooseLineup } from '../src/engine/ai';
import { generateContent } from '../src/data/seedFighters';
import { ARENAS } from '../src/data/arenas';
import { SCORE_PER_DOWN } from '../src/engine/constants';
import { makeRng, hashString } from '../src/engine/rng';
import { Fighter, Focus, MatchResult, Posture, Side, SquadInput, Tactics } from '../src/engine/types';

const SEEDS = Number(process.argv[2] ?? 40);
const ROSTERS = Number(process.argv[3] ?? 4);
const FOCUSES: Focus[] = ['melee', 'ranged', 'objective'];
const POSTURES: Posture[] = ['aggressive', 'balanced', 'defensive'];

interface Team { roster: Fighter[]; fById: Record<string, Fighter>; }

function rosters(n: number): Team[] {
  const teams: Team[] = [];
  for (let g = 0; teams.length < n; g++) {
    const c = generateContent(4100 + g);
    for (let t = 0; t < 3 && teams.length < n; t++) {
      teams.push({ roster: c.teams[t].fighterIds.map((id) => c.fighters[id]), fById: c.fighters });
    }
  }
  return teams;
}

function squad(team: Team, side: Side, tweak: Partial<Tactics>, salt: number): SquadInput {
  const lu = chooseLineup('x', team.roster.map((f) => f.id), team.fById, makeRng(salt));
  return { side, fighters: lu.fighterIds.map((id) => team.fById[id]), tactics: { ...lu.tactics, ...tweak } };
}

/** Down-derived points for a side = its fighters' downs × SCORE_PER_DOWN. */
function downPoints(r: MatchResult, side: Side): number {
  let downs = 0;
  for (const id of Object.keys(r.stats)) if (r.stats[id].side === side) downs += r.stats[id].downsScored;
  return downs * SCORE_PER_DOWN;
}

interface Agg { games: number; totalScore: number; totalFrames: number; downPts: number; zonePts: number; }
const agg: Agg = { games: 0, totalScore: 0, totalFrames: 0, downPts: 0, zonePts: 0 };

function record(r: MatchResult): void {
  agg.games++;
  agg.totalScore += r.homeScore + r.awayScore;
  agg.totalFrames += r.rounds[0].frames.length + r.rounds[1].frames.length;
  const dh = downPoints(r, 'home');
  const da = downPoints(r, 'away');
  agg.downPts += dh + da;
  agg.zonePts += Math.max(0, r.homeScore - dh) + Math.max(0, r.awayScore - da);
}

/**
 * A×B win matrix for a tactic dimension: each cell is A's win% when playing
 * tactic A against tactic B, averaged over every roster pairing, seed and
 * orientation. The diagonal should sit near 50%; off-diagonals reveal dominance.
 */
function winMatrix(kind: 'focus' | 'posture', teams: Team[]): number[][] {
  const opts = kind === 'focus' ? FOCUSES : POSTURES;
  const key = (v: string): Partial<Tactics> => (kind === 'focus' ? { focus: v as Focus } : { posture: v as Posture });
  const mat: number[][] = opts.map(() => opts.map(() => 0));
  for (let a = 0; a < opts.length; a++) {
    for (let b = 0; b < opts.length; b++) {
      let aWins = 0;
      let games = 0;
      for (let i = 0; i < teams.length; i++) {
        for (let j = 0; j < teams.length; j++) {
          if (i === j) continue;
          for (let s = 0; s < SEEDS; s++) {
            const seed = i * 131 + j * 17 + s * 3 + 1;
            const arena = ARENAS[seed % ARENAS.length];
            const r1 = simulateMatch(
              squad(teams[i], 'home', key(opts[a]), hashString(`${i}`)),
              squad(teams[j], 'away', key(opts[b]), hashString(`${j}`)),
              arena, seed,
            );
            record(r1);
            if (r1.winner === 'home') aWins++;
            const r2 = simulateMatch(
              squad(teams[j], 'home', key(opts[b]), hashString(`${j}`)),
              squad(teams[i], 'away', key(opts[a]), hashString(`${i}`)),
              arena, seed + 1,
            );
            record(r2);
            if (r2.winner === 'away') aWins++;
            games += 2;
          }
        }
      }
      mat[a][b] = aWins / games;
    }
  }
  return mat;
}

function printMatrix(title: string, labels: string[], mat: number[][]): void {
  console.log(`\n### ${title} — row's win% vs column\n`);
  console.log(`| ${'A \\ B'.padEnd(10)} | ${labels.map((l) => l.padStart(9)).join(' | ')} |`);
  console.log(`| ${'-'.repeat(10)} | ${labels.map(() => '-'.repeat(9)).join(' | ')} |`);
  mat.forEach((row, a) => {
    const cells = row.map((v) => {
      const pct = `${(v * 100).toFixed(1)}%`;
      const flag = v < 0.35 || v > 0.65 ? '!' : ' ';
      return `${flag}${pct}`.padStart(9);
    });
    console.log(`| ${labels[a].padEnd(10)} | ${cells.join(' | ')} |`);
  });
}

function main(): void {
  const t0 = Date.now();
  const teams = rosters(ROSTERS);
  console.log(`# LUDUS balance matrix\n`);
  console.log(`Rosters: ${teams.length} · seeds/pairing: ${SEEDS} · arenas: ${ARENAS.length}`);

  printMatrix('Focus', FOCUSES, winMatrix('focus', teams));
  printMatrix('Posture', POSTURES, winMatrix('posture', teams));

  const totalPts = agg.downPts + agg.zonePts || 1;
  console.log(`\n### Aggregates over ${agg.games} matches\n`);
  console.log(`- Mean combined score: ${(agg.totalScore / agg.games).toFixed(1)}`);
  console.log(`- Mean frames/match (both rounds): ${(agg.totalFrames / agg.games).toFixed(0)}`);
  console.log(`- Scoring split — downs: ${((agg.downPts / totalPts) * 100).toFixed(1)}% · zone: ${((agg.zonePts / totalPts) * 100).toFixed(1)}%`);
  console.log(`\n(! flags any win% outside the 35–65% fairness band.)`);
  console.log(`\nRan in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

main();
