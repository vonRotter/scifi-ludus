import { describe, it, expect } from 'vitest';
import { ARENAS, arenaById } from './arenas';
import { Obstacle, Hazard } from '../engine/types';

/** A stable key for an obstacle, for set-equality checks. */
const okey = (o: Obstacle) => `${o.x},${o.y},${o.w},${o.h}`;
/** A stable key for a hazard's placement + effect (symmetry must preserve both). */
const hkey = (h: Hazard) => `${h.x},${h.y},${h.r},${h.kind},${h.intensity},${h.period ?? 0},${h.duty ?? -1}`;

describe('arena layouts are fair by construction', () => {
  it('every arena declares a known symmetry and a central-ish objective', () => {
    for (const a of ARENAS) {
      expect(a.symmetry === undefined || a.symmetry === 'mirror' || a.symmetry === 'point').toBe(true);
      // The objective sits on the field centre, so it is fixed under both a
      // left-right reflection and a 180° rotation — fair under either symmetry.
      expect(a.objective.x).toBe(a.width / 2);
      expect(a.objective.y).toBe(a.height / 2);
    }
  });

  it('mirror arenas map onto themselves under a left-right reflection', () => {
    for (const a of ARENAS.filter((x) => (x.symmetry ?? 'mirror') === 'mirror')) {
      const obs = new Set(a.obstacles.map(okey));
      for (const o of a.obstacles) {
        expect(obs.has(okey({ x: a.width - o.x - o.w, y: o.y, w: o.w, h: o.h }))).toBe(true);
      }
      const haz = new Set((a.hazards ?? []).map(hkey));
      for (const h of a.hazards ?? []) {
        expect(haz.has(hkey({ ...h, x: a.width - h.x }))).toBe(true);
      }
    }
  });

  it('point arenas map onto themselves under a 180° rotation', () => {
    const pts = ARENAS.filter((x) => x.symmetry === 'point');
    expect(pts.length).toBeGreaterThanOrEqual(2);
    for (const a of pts) {
      const obs = new Set(a.obstacles.map(okey));
      for (const o of a.obstacles) {
        expect(obs.has(okey({ x: a.width - o.x - o.w, y: a.height - o.y - o.h, w: o.w, h: o.h }))).toBe(true);
      }
      const haz = new Set((a.hazards ?? []).map(hkey));
      for (const h of a.hazards ?? []) {
        expect(haz.has(hkey({ ...h, x: a.width - h.x, y: a.height - h.y }))).toBe(true);
      }
    }
  });

  it('arena ids are unique and resolvable', () => {
    const ids = ARENAS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(arenaById(id).id).toBe(id);
  });
});
