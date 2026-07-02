/**
 * Season structure: fixtures, league table, standings, progression.
 *
 * Single responsibility: schedule a short double round-robin and tally results
 * into a table. Pure and deterministic — no React, no randomness beyond the
 * seeds it bakes into fixtures, no I/O.
 */

import { POINTS_DRAW, POINTS_WIN } from './constants';
import { deriveSeed } from './rng';
import { Fixture, TableRow, Team } from './types';

/**
 * One round-robin leg for `n` teams (every team plays every other exactly
 * once), via the standard circle method. For odd `n` a phantom "bye" slot is
 * added and dropped from the output, so one team sits out each round.
 */
function singleLegSchedule(n: number): Array<[number, number]> {
  const size = n % 2 === 0 ? n : n + 1;
  const arr = Array.from({ length: size }, (_, i) => i);
  const matches: Array<[number, number]> = [];
  for (let round = 0; round < size - 1; round++) {
    for (let i = 0; i < size / 2; i++) {
      const a = arr[i];
      const b = arr[size - 1 - i];
      if (a < n && b < n) matches.push([a, b]);
    }
    const fixed = arr[0];
    const rest = arr.slice(1);
    rest.unshift(rest.pop()!);
    arr.splice(0, arr.length, fixed, ...rest);
  }
  return matches;
}

/**
 * Build the season's fixtures: a double round-robin (everyone plays everyone
 * home and away) for however many teams are passed in. Each fixture gets a
 * fixed per-match seed (so the result is reproducible) and an arena assigned
 * round-robin from `arenaIds`.
 */
export function generateFixtures(teams: Team[], seed: number, arenaIds: string[]): Fixture[] {
  const leg1 = singleLegSchedule(teams.length);
  const leg2: Array<[number, number]> = leg1.map(([h, a]) => [a, h]);
  const schedule = [...leg1, ...leg2];
  return schedule.map(([h, a], i) => ({
    id: `fx-${i}`,
    week: i + 1,
    homeTeamId: teams[h].id,
    awayTeamId: teams[a].id,
    arenaId: arenaIds[i % arenaIds.length],
    seed: deriveSeed(seed, 1000 + i),
    played: false,
  }));
}

function blankRow(teamId: string): TableRow {
  return {
    teamId,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    pointsFor: 0,
    pointsAgainst: 0,
    points: 0,
  };
}

/** Tally all played fixtures into a sorted league table. */
export function computeTable(teams: Team[], fixtures: Fixture[]): TableRow[] {
  const rows = new Map<string, TableRow>();
  for (const t of teams) rows.set(t.id, blankRow(t.id));

  for (const fx of fixtures) {
    if (!fx.played || fx.homeScore === undefined || fx.awayScore === undefined) continue;
    const home = rows.get(fx.homeTeamId)!;
    const away = rows.get(fx.awayTeamId)!;
    home.played++;
    away.played++;
    home.pointsFor += fx.homeScore;
    home.pointsAgainst += fx.awayScore;
    away.pointsFor += fx.awayScore;
    away.pointsAgainst += fx.homeScore;

    if (fx.homeScore > fx.awayScore) {
      home.won++;
      away.lost++;
      home.points += POINTS_WIN;
    } else if (fx.awayScore > fx.homeScore) {
      away.won++;
      home.lost++;
      away.points += POINTS_WIN;
    } else {
      home.drawn++;
      away.drawn++;
      home.points += POINTS_DRAW;
      away.points += POINTS_DRAW;
    }
  }

  return [...rows.values()].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    const diffA = a.pointsFor - a.pointsAgainst;
    const diffB = b.pointsFor - b.pointsAgainst;
    if (diffB !== diffA) return diffB - diffA;
    if (b.pointsFor !== a.pointsFor) return b.pointsFor - a.pointsFor;
    return a.teamId.localeCompare(b.teamId);
  });
}

/** Are all fixtures played? */
export function seasonComplete(fixtures: Fixture[]): boolean {
  return fixtures.every((f) => f.played);
}

/** The champion's team id once the season is complete, else null. */
export function champion(teams: Team[], fixtures: Fixture[]): string | null {
  if (!seasonComplete(fixtures)) return null;
  return computeTable(teams, fixtures)[0]?.teamId ?? null;
}

/** The next unplayed fixture involving a team, or null. */
export function nextFixtureFor(fixtures: Fixture[], teamId: string): Fixture | null {
  return (
    fixtures.find(
      (f) => !f.played && (f.homeTeamId === teamId || f.awayTeamId === teamId),
    ) ?? null
  );
}

/** The next unplayed fixture overall (any teams), or null. */
export function nextUnplayed(fixtures: Fixture[]): Fixture | null {
  return fixtures.find((f) => !f.played) ?? null;
}
