import { describe, it, expect } from 'vitest';
import { resolveAttack, PostureMods } from './combat';
import { newStat } from './events';
import { Entity } from './internal';
import { makeRng } from '../rng';
import { CategoryScores, SpecLevels } from '../types';

const NEUTRAL: PostureMods = { atk: 1, def: 1 };

function entity(scores: Partial<CategoryScores>, spec: SpecLevels = {}): Entity {
  return {
    id: 'e', side: 'home', role: 'frontline', x: 0, y: 0, hp: 100, maxHp: 100, alive: true,
    cooldown: 0, spec, seedBase: 1, facing: 0, action: 'idle',
    scores: { melee: 12, ranged: 12, defence: 10, mental: 10, speed: 10, ...scores },
    stat: newStat('home'), lastCredit: null, lastCause: null,
    energy: 1, stamina: 12, awareness: 12, discipline: 12, targetId: null,
    nerve: 1, shaken: false, temperament: 12,
  };
}

// A fresh identical rng each call so only the spec differs between measurements.
const roll = () => makeRng(20240607);

describe('specialization is conditional in combat', () => {
  it('a melee specialization raises melee damage but not ranged damage', () => {
    const plain = entity({});
    const meleeSpec = entity({}, { melee: 3 });
    const target = entity({});

    const plainMelee = resolveAttack(plain, target, 'melee', NEUTRAL, NEUTRAL, roll());
    const specMelee = resolveAttack(meleeSpec, target, 'melee', NEUTRAL, NEUTRAL, roll());
    expect(specMelee).toBeGreaterThan(plainMelee);

    // The same melee specialization does nothing for a ranged attack.
    const plainRanged = resolveAttack(plain, target, 'ranged', NEUTRAL, NEUTRAL, roll());
    const specRanged = resolveAttack(meleeSpec, target, 'ranged', NEUTRAL, NEUTRAL, roll());
    expect(specRanged).toBeCloseTo(plainRanged);
  });

  it('a defence specialization on the defender soaks more damage', () => {
    const attacker = entity({});
    const softTarget = entity({});
    const armoured = entity({}, { defence: 3 });
    const soft = resolveAttack(attacker, softTarget, 'melee', NEUTRAL, NEUTRAL, roll());
    const hard = resolveAttack(attacker, armoured, 'melee', NEUTRAL, NEUTRAL, roll());
    expect(hard).toBeLessThan(soft);
  });
});
