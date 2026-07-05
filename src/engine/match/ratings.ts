/**
 * Match ratings: turn a match's per-fighter tallies into a familiar 0–10 score.
 *
 * Single responsibility: a pure normalisation of MatchStats into a rating per
 * fighter. No randomness, no state — same stats in, same ratings out, so it is
 * deterministic for free. Ratings feed morale, news, awards and valuation
 * downstream, but this module knows nothing of them.
 */

import { FighterStat, MatchStats } from '../types';

/** Keep a rating on the familiar football-management 2–10 band. */
function clampRating(r: number): number {
  return Math.max(2, Math.min(10, Math.round(r * 10) / 10));
}

/**
 * Rate every fighter in `stats` from 6.0 outward: reward damage above the match
 * mean, downs scored, accuracy and time controlling the zone; penalise going
 * down. Normalised against the match's own totals so a low-scoring grind and a
 * blowout both spread their ratings sensibly.
 */
export function computeRatings(stats: MatchStats): Record<string, number> {
  const ids = Object.keys(stats);
  const out: Record<string, number> = {};
  if (ids.length === 0) return out;

  let totalDamage = 0;
  let maxZone = 0;
  for (const id of ids) {
    totalDamage += stats[id].damageDealt;
    maxZone = Math.max(maxZone, stats[id].zoneTicks);
  }
  const meanDamage = totalDamage / ids.length || 1;

  for (const id of ids) {
    const s: FighterStat = stats[id];
    let r = 6.0;
    // Damage carried relative to the average fielded fighter.
    r += ((s.damageDealt - meanDamage) / meanDamage) * 1.2;
    // Decisive moments.
    r += s.downsScored * 0.7;
    r -= s.timesDowned * 0.9;
    // Marksmanship, once there's a meaningful sample of attempts.
    if (s.attempts >= 4) r += (s.hitsLanded / s.attempts - 0.75) * 2.5;
    // Territory: sole control of the objective.
    if (maxZone > 0) r += (s.zoneTicks / maxZone) * 0.8;
    out[id] = clampRating(r);
  }
  return out;
}
