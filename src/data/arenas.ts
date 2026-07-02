/**
 * Arena / terrain definitions (Phase 1 content).
 *
 * Single responsibility: static field layouts. Pure data, no logic, no React.
 * The field is 480x300 units; obstacles block movement and ranged line-of-sight.
 */

import { Arena, Obstacle } from '../engine/types';

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
  },
  {
    id: 'arena-flats',
    name: 'The Slag Flats',
    width: W,
    height: H,
    objective: { x: 240, y: 150, r: 54 },
    obstacles: symmetric([{ x: 175, y: 120, w: 20, h: 20 }]),
  },
];

export function arenaById(id: string): Arena {
  const a = ARENAS.find((x) => x.id === id);
  if (!a) throw new Error(`Unknown arena: ${id}`);
  return a;
}
