/**
 * Training: weekly fighter growth toward their hidden potential.
 *
 * Single responsibility: nudge a fighter's sub-stats up within one trained
 * category, capped by their hidden `potential` and STAT_MAX. Pure, seeded —
 * all randomness flows through the injected Rng, never Math.random. No React,
 * no state ownership; the state layer calls this once per fixture week.
 */

import { categoryScores } from './attributes';
import { Rng } from './rng';
import { STAT_MAX } from './constants';
import { Category, CATEGORIES, CATEGORY_SUBSTATS, Fighter } from './types';

/** A trained sub-stat can't grow past the fighter's hidden potential. */
function ceilingFor(fighter: Fighter): number {
  return Math.min(STAT_MAX, fighter.potential);
}

/**
 * Train one fighter for one week: each sub-stat in `focus` has a chance to
 * gain +1, shrinking as it nears the fighter's potential ceiling (diminishing
 * returns), and never exceeding it. Untrained categories don't grow.
 * `bonus` (from the ludus's training facility) adds straight to the chance.
 */
export function trainFighter(fighter: Fighter, focus: Category, rng: Rng, bonus = 0): Fighter {
  const ceiling = ceilingFor(fighter);
  const subStats = { ...fighter.subStats };
  for (const key of CATEGORY_SUBSTATS[focus]) {
    const current = subStats[key];
    if (current >= ceiling) continue;
    const room = ceiling - current;
    const chance = Math.min(0.85, 0.12 + room * 0.04 + bonus);
    if (rng.chance(chance)) subStats[key] = current + 1;
  }
  return { ...fighter, subStats };
}

/** Train every fighter on a roster for one week, in a stable id order. */
export function trainRoster(
  fighters: Record<string, Fighter>,
  fighterIds: string[],
  focus: Category,
  rng: Rng,
  bonus = 0,
): Record<string, Fighter> {
  const out = { ...fighters };
  for (const id of fighterIds) {
    const f = out[id];
    if (f) out[id] = trainFighter(f, focus, rng, bonus);
  }
  return out;
}

/** A sensible default focus for a roster: its weakest average category. */
export function weakestCategory(fighters: Fighter[]): Category {
  let worst: Category = CATEGORIES[0];
  let worstAvg = Infinity;
  for (const c of CATEGORIES) {
    const avg = fighters.reduce((s, f) => s + categoryScores(f.subStats)[c], 0) / Math.max(1, fighters.length);
    if (avg < worstAvg) {
      worstAvg = avg;
      worst = c;
    }
  }
  return worst;
}
