/**
 * Arena / terrain definitions (Phase 1 content).
 *
 * Single responsibility: static field layouts. Pure data, no logic, no React.
 * The field is 480x300 units; obstacles block movement and ranged line-of-sight.
 */

import { Arena, Hazard, Obstacle } from '../engine/types';

const W = 480;
const H = 300;

/**
 * Mirror an obstacle left-to-right (reflect x about the field centre, keep y).
 * The squads start as a left-right mirror of each other, so the terrain must
 * use the SAME reflection for both sides to face identical cover — otherwise a
 * side gets a structural advantage.
 */
function mirror(o: Obstacle): Obstacle {
  return { x: W - o.x - o.w, y: o.y, w: o.w, h: o.h };
}

function symmetric(half: Obstacle[]): Obstacle[] {
  return half.flatMap((o) => [o, mirror(o)]);
}

/**
 * Mirror a hazard left-to-right about the field centre (reflect the centre x,
 * keep everything else). Hazards MUST be placed in mirror pairs for the same
 * fairness reason as obstacles — the no-side-bias invariant depends on it.
 */
function mirrorHazard(h: Hazard): Hazard {
  return { ...h, x: W - h.x };
}

function symmetricHazards(half: Hazard[]): Hazard[] {
  return half.flatMap((h) => [h, mirrorHazard(h)]);
}

export const ARENAS: Arena[] = [
  {
    id: 'arena-pit',
    name: 'Drydock Nine',
    width: W,
    height: H,
    objective: { x: 240, y: 150, r: 46 },
    obstacles: symmetric([
      { x: 150, y: 60, w: 30, h: 30 },
      { x: 110, y: 200, w: 24, h: 24 },
    ]),
    // Ion vents flanking the top and bottom approaches to the core: they chip
    // anyone who lingers, without being lethal enough to warp the scoreline.
    hazards: symmetricHazards([
      { x: 200, y: 70, r: 20, kind: 'plasma', intensity: 0.12 },
      { x: 200, y: 230, r: 20, kind: 'plasma', intensity: 0.12 },
    ]),
  },
  {
    id: 'arena-spire',
    name: 'Orbital Causeway',
    width: W,
    height: H,
    objective: { x: 240, y: 150, r: 40 },
    obstacles: symmetric([
      { x: 110, y: 120, w: 24, h: 60 },
      { x: 200, y: 70, w: 24, h: 24 },
    ]),
    // Grav-shear pools drag on anyone crossing the flanks — cross slow, or go round.
    hazards: symmetricHazards([
      { x: 150, y: 150, r: 20, kind: 'gravwell', intensity: 0.75 },
    ]),
  },
  {
    id: 'arena-flats',
    name: 'The Slag Flats',
    width: W,
    height: H,
    objective: { x: 240, y: 150, r: 54 },
    obstacles: symmetric([{ x: 175, y: 120, w: 20, h: 20 }]),
    // Open ground broken only by two smouldering slag pools mid-flank.
    hazards: symmetricHazards([
      { x: 140, y: 150, r: 28, kind: 'plasma', intensity: 0.15 },
    ]),
  },
  {
    id: 'arena-vault',
    name: 'The Vault',
    width: W,
    height: H,
    // A cover-heavy arena around a broad core — clean of hazards.
    objective: { x: 240, y: 150, r: 46 },
    obstacles: symmetric([
      { x: 112, y: 66, w: 22, h: 60 },
      { x: 150, y: 214, w: 36, h: 20 },
    ]),
  },
  {
    id: 'arena-crucible',
    name: 'The Crucible',
    width: W,
    height: H,
    // Fight around the core with ion vents guarding the top and bottom lanes.
    objective: { x: 240, y: 150, r: 48 },
    obstacles: symmetric([{ x: 150, y: 118, w: 24, h: 24 }]),
    hazards: symmetricHazards([
      { x: 190, y: 62, r: 20, kind: 'plasma', intensity: 0.14 },
      { x: 190, y: 238, r: 20, kind: 'plasma', intensity: 0.14 },
    ]),
  },
  {
    id: 'arena-drift',
    name: 'Zero-G Drift',
    width: W,
    height: H,
    // Grav-shear wells sit on the mid-flanks; the fast pay to cross, or route round.
    objective: { x: 240, y: 150, r: 46 },
    obstacles: symmetric([
      { x: 128, y: 88, w: 20, h: 20 },
      { x: 128, y: 192, w: 20, h: 20 },
    ]),
    hazards: symmetricHazards([
      { x: 152, y: 150, r: 22, kind: 'gravwell', intensity: 0.75 },
    ]),
  },
];

export function arenaById(id: string): Arena {
  const a = ARENAS.find((x) => x.id === id);
  if (!a) throw new Error(`Unknown arena: ${id}`);
  return a;
}
