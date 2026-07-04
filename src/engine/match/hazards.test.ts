import { describe, it, expect } from 'vitest';
import { hazardDamageAt, speedFactorAt, dist } from './geometry';
import { ARENAS } from '../../data/arenas';
import { Arena } from '../types';

const W = 480;

function arena(hazards: Arena['hazards']): Arena {
  return { id: 't', name: 't', width: W, height: 300, obstacles: [], objective: { x: 240, y: 150, r: 40 }, hazards };
}

describe('hazard geometry', () => {
  it('plasma burns points inside its radius and spares those outside', () => {
    const a = arena([{ x: 100, y: 150, r: 20, kind: 'plasma', intensity: 0.5 }]);
    expect(hazardDamageAt(100, 150, a)).toBeCloseTo(0.5);
    expect(hazardDamageAt(115, 150, a)).toBeCloseTo(0.5); // 15 < 20, inside
    expect(hazardDamageAt(140, 150, a)).toBe(0); // 40 > 20, outside
    expect(speedFactorAt(100, 150, a)).toBe(1); // plasma doesn't slow
  });

  it('gravwells multiply the speed factor inside and leave it 1 outside', () => {
    const a = arena([{ x: 100, y: 150, r: 20, kind: 'gravwell', intensity: 0.5 }]);
    expect(speedFactorAt(100, 150, a)).toBeCloseTo(0.5);
    expect(speedFactorAt(200, 150, a)).toBe(1);
    expect(hazardDamageAt(100, 150, a)).toBe(0); // gravwell doesn't burn
  });

  it('overlapping hazards of a kind stack (damage sums, slow multiplies)', () => {
    const a = arena([
      { x: 100, y: 150, r: 30, kind: 'plasma', intensity: 0.4 },
      { x: 110, y: 150, r: 30, kind: 'plasma', intensity: 0.3 },
    ]);
    expect(hazardDamageAt(105, 150, a)).toBeCloseTo(0.7);
    const b = arena([
      { x: 100, y: 150, r: 30, kind: 'gravwell', intensity: 0.5 },
      { x: 110, y: 150, r: 30, kind: 'gravwell', intensity: 0.5 },
    ]);
    expect(speedFactorAt(105, 150, b)).toBeCloseTo(0.25);
  });

  it('a plain arena with no hazards is inert', () => {
    const a = arena(undefined);
    expect(hazardDamageAt(240, 150, a)).toBe(0);
    expect(speedFactorAt(240, 150, a)).toBe(1);
  });
});

describe('every shipped arena keeps hazards side-fair', () => {
  // Sample the whole field; the mirror image of every point must feel the exact
  // same hazard, or one side of the field is structurally advantaged.
  it('hazard effects are left-right mirror-symmetric', () => {
    for (const a of ARENAS) {
      for (let x = 0; x <= W; x += 20) {
        for (let y = 0; y <= 300; y += 20) {
          expect(hazardDamageAt(x, y, a)).toBeCloseTo(hazardDamageAt(W - x, y, a));
          expect(speedFactorAt(x, y, a)).toBeCloseTo(speedFactorAt(W - x, y, a));
        }
      }
    }
  });

  it('no hazard overlaps the central objective, so holding the zone is not a death sentence', () => {
    for (const a of ARENAS) {
      for (const h of a.hazards ?? []) {
        expect(dist(h.x, h.y, a.objective.x, a.objective.y)).toBeGreaterThan(a.objective.r + h.r);
      }
    }
  });
});
