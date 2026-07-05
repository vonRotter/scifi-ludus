import { describe, it, expect } from 'vitest';
import { chooseTarget, separation } from './targeting';
import { newStat } from './events';
import { Entity } from './internal';
import { Arena, CategoryScores, Side } from '../types';

const ARENA: Arena = {
  id: 'flat', name: 'Flat', width: 200, height: 120, obstacles: [],
  objective: { x: 100, y: 60, r: 20 },
};

let seq = 0;
function ent(side: Side, x: number, y: number, over: Partial<Entity> = {}, scores: Partial<CategoryScores> = {}): Entity {
  return {
    id: `e${seq++}`, side, role: 'frontline', x, y, hp: 100, maxHp: 100, alive: true,
    cooldown: 0, spec: {}, seedBase: seq, facing: 0, action: 'idle',
    scores: { melee: 12, ranged: 12, defence: 10, mental: 10, speed: 10, ...scores },
    stat: newStat(side), lastCredit: null, lastCause: null,
    energy: 1, stamina: 12, awareness: 12, discipline: 12, targetId: null,
    nerve: 1, shaken: false, temperament: 12,
    ...over,
  };
}

describe('chooseTarget', () => {
  it('prefers a closer enemy, all else equal', () => {
    const self = ent('home', 0, 0);
    const near = ent('away', 20, 0);
    const far = ent('away', 80, 0);
    expect(chooseTarget(self, [self, near, far], ARENA, 'melee')).toBe(near);
  });

  it('finishes a wounded target over an equidistant healthy one (focus fire)', () => {
    const self = ent('home', 0, 0);
    const healthy = ent('away', 30, -10);
    const wounded = ent('away', 30, 10, { hp: 15 }); // same distance, low HP
    expect(chooseTarget(self, [self, healthy, wounded], ARENA, 'melee')).toBe(wounded);
  });

  it('is mirror-fair: reflected inputs yield the reflected choice', () => {
    // Home fighter and its two marks, then everything reflected across x = W/2.
    const W = ARENA.width;
    const s = ent('home', 40, 40);
    const a = ent('away', 70, 30, { seedBase: 100 });
    const b = ent('away', 90, 55, { hp: 40, seedBase: 200 });
    const pick = chooseTarget(s, [s, a, b], ARENA, 'objective');

    const mx = (x: number) => W - x;
    const sm = ent('away', mx(40), 40, { seedBase: s.seedBase });
    const am = ent('home', mx(70), 30, { seedBase: 100 });
    const bm = ent('home', mx(90), 55, { hp: 40, seedBase: 200 });
    const pickM = chooseTarget(sm, [sm, am, bm], ARENA, 'objective');
    expect(pick).toBeTruthy();
    expect(pickM).toBeTruthy();

    // The mirrored choice must correspond to the mirror of the original choice.
    const wantMirrorId = pick === a ? am.id : bm.id;
    expect(pickM!.id).toBe(wantMirrorId);
  });

  it('holds its current mark under hysteresis when a rival is only marginally better', () => {
    const self = ent('home', 0, 0, { targetId: 'mark', discipline: 4 }); // low discipline = sticky
    const mark = ent('away', 30, 0, { id: 'mark' });
    const other = ent('away', 28, 0); // a hair closer
    expect(chooseTarget(self, [self, mark, other], ARENA, 'melee')).toBe(mark);
  });
});

describe('separation', () => {
  it('pushes away from a crowding ally and is zero when clear', () => {
    const self = ent('home', 50, 50);
    const ally = ent('home', 52, 50); // very close, to self's right
    const push = separation(self, [self, ally]);
    expect(push.dx).toBeLessThan(0); // shoved left, away from the ally
    expect(Math.abs(push.dy)).toBeLessThan(1e-6);

    const alone = separation(self, [self, ent('home', 120, 50)]);
    expect(alone.dx).toBe(0);
    expect(alone.dy).toBe(0);
  });
});
