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
  const H = 300;
  // Sample the whole field at a few ticks (to catch duty-cycled vents): the
  // congruent point under the arena's own symmetry — a left-right reflection for
  // mirror arenas, a 180° rotation for point arenas — must feel the exact same
  // hazard, or one side of the field is structurally advantaged.
  it('hazard effects respect each arena\'s declared symmetry', () => {
    for (const a of ARENAS) {
      const point = a.symmetry === 'point';
      for (const tick of [0, 9, 13]) {
        for (let x = 0; x <= W; x += 20) {
          for (let y = 0; y <= H; y += 20) {
            const [mx, my] = point ? [W - x, H - y] : [W - x, y];
            expect(hazardDamageAt(x, y, a, tick)).toBeCloseTo(hazardDamageAt(mx, my, a, tick));
            expect(speedFactorAt(x, y, a, tick)).toBeCloseTo(speedFactorAt(mx, my, a, tick));
          }
        }
      }
    }
  });

  it('no burning hazard overlaps the objective, so holding the zone is not a death sentence', () => {
    // A grav-shear well over the core is a deliberate identity (it drags, never
    // burns); only damaging plasma is barred from the objective.
    for (const a of ARENAS) {
      for (const h of a.hazards ?? []) {
        if (h.kind !== 'plasma') continue;
        expect(dist(h.x, h.y, a.objective.x, a.objective.y)).toBeGreaterThan(a.objective.r + h.r);
      }
    }
  });
});

describe('duty-cycled hazards', () => {
  it('pulse on for their duty window and off outside it, phase-locked to the tick', () => {
    const a = arena([{ x: 100, y: 150, r: 20, kind: 'plasma', intensity: 0.5, period: 10, duty: 4 }]);
    // Live for ticks 0..3 of every period, dark for 4..9.
    expect(hazardDamageAt(100, 150, a, 0)).toBeCloseTo(0.5);
    expect(hazardDamageAt(100, 150, a, 3)).toBeCloseTo(0.5);
    expect(hazardDamageAt(100, 150, a, 4)).toBe(0);
    expect(hazardDamageAt(100, 150, a, 9)).toBe(0);
    expect(hazardDamageAt(100, 150, a, 10)).toBeCloseTo(0.5); // next cycle
    expect(hazardDamageAt(100, 150, a, 13)).toBeCloseTo(0.5);
    expect(hazardDamageAt(100, 150, a, 14)).toBe(0);
  });
});
