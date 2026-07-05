/**
 * Match statistics helpers: build empty tallies and merge them across rounds.
 *
 * Single responsibility: the small pure functions that create and combine
 * FighterStat records. It owns no simulation logic and no randomness — the tick
 * loop in simulate.ts mutates the live tallies; this module only shapes them.
 */

import { FighterStat, MatchStats, Side } from '../types';

/** A zeroed tally for one fighter on a given side. */
export function newStat(side: Side): FighterStat {
  return {
    side,
    damageDealt: 0,
    damageTaken: 0,
    downsScored: 0,
    timesDowned: 0,
    hitsLanded: 0,
    attempts: 0,
    zoneTicks: 0,
    hazardDamage: 0,
  };
}

/** Sum two per-fighter stats field by field (side is taken from `a`). */
function addStat(a: FighterStat, b: FighterStat): FighterStat {
  return {
    side: a.side,
    damageDealt: a.damageDealt + b.damageDealt,
    damageTaken: a.damageTaken + b.damageTaken,
    downsScored: a.downsScored + b.downsScored,
    timesDowned: a.timesDowned + b.timesDowned,
    hitsLanded: a.hitsLanded + b.hitsLanded,
    attempts: a.attempts + b.attempts,
    zoneTicks: a.zoneTicks + b.zoneTicks,
    hazardDamage: a.hazardDamage + b.hazardDamage,
  };
}

/**
 * Merge two rounds' stat maps into one match-level map. Fighters absent from a
 * round (e.g. subbed) simply carry their other round's tally through.
 */
export function mergeStats(a: MatchStats, b: MatchStats): MatchStats {
  const out: MatchStats = {};
  for (const id of Object.keys(a)) out[id] = a[id];
  for (const id of Object.keys(b)) {
    out[id] = out[id] ? addStat(out[id], b[id]) : b[id];
  }
  return out;
}
