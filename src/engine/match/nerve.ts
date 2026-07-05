/**
 * Nerve model: composure under fire, and the wobble when it breaks.
 *
 * Single responsibility: the pure per-tick nerve maths. Heavy hits, an ally
 * going down close by, and being locally outnumbered erode a fighter's nerve;
 * high temperament resists it; quiet ticks restore it. A broken fighter is
 * flagged `shaken` (with hysteresis) — the movement layer then has it pull back
 * to its own line rather than flee. Everything depends only on the fighter's own
 * state and LOCAL facts (both sides counted the same), so it is side-neutral and
 * the mirror-fairness invariant holds. No randomness, no React.
 */

import { Entity } from './internal';

/** Nerve thresholds, with hysteresis so a fighter doesn't flicker in and out. */
const BREAK = 0.35; // drop below this and the fighter is shaken
const STEADY = 0.55; // must climb back above this to compose itself again

/** Radius (field units) for the "ally down nearby" and "outnumbered" checks. */
const LOCAL_R = 55;

const RECOVER = 0.009; // natural recovery per calm tick — breaks are brief
const DMG_DROP = 0.65; // scale on a heavy hit (× fraction of max HP lost)
const DMG_HEAVY = 0.12; // a hit only rattles if it takes >12% of max HP
const ALLY_DOWN_DROP = 0.14; // per allied fighter downed nearby this tick
const OUTNUMBER_DROP = 0.014; // per extra local enemy, each tick

/** Higher temperament => a smaller share of every nerve hit lands (0.3×..1×). */
function dropScale(temperament: number): number {
  return 1 - Math.min(0.7, (temperament / 20) * 0.7);
}

/** Living allies and enemies within LOCAL_R of `self`. */
function localCounts(self: Entity, entities: Entity[]): { allies: number; enemies: number } {
  let allies = 0;
  let enemies = 0;
  for (const e of entities) {
    if (!e.alive || e === self) continue;
    const dx = e.x - self.x;
    const dy = e.y - self.y;
    if (dx * dx + dy * dy > LOCAL_R * LOCAL_R) continue;
    if (e.side === self.side) allies++;
    else enemies++;
  }
  return { allies, enemies };
}

/**
 * Advance one fighter's nerve for a tick. `dmgTaken` is the HP it lost this
 * tick; `alliedDownsNear` the number of same-side fighters downed within range
 * this tick. Mutates `self.nerve`/`self.shaken`; returns true only on the tick
 * the fighter FIRST breaks, so the caller can emit a single "shaken" event.
 */
export function updateNerve(
  self: Entity,
  entities: Entity[],
  dmgTaken: number,
  alliedDownsNear: number,
): boolean {
  let drop = 0;
  if (dmgTaken > DMG_HEAVY * self.maxHp) drop += DMG_DROP * (dmgTaken / self.maxHp);
  drop += ALLY_DOWN_DROP * alliedDownsNear;
  const { allies, enemies } = localCounts(self, entities);
  if (enemies > allies) drop += OUTNUMBER_DROP * (enemies - allies);
  drop *= dropScale(self.temperament);

  self.nerve = Math.max(0, Math.min(1, self.nerve - drop + RECOVER));

  const wasShaken = self.shaken;
  if (self.shaken) {
    if (self.nerve > STEADY) self.shaken = false;
  } else if (self.nerve < BREAK) {
    self.shaken = true;
  }
  return !wasShaken && self.shaken;
}
