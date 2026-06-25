import { describe, it, expect } from 'vitest';
import { categoryScore } from './attributes';
import { SubStats } from './types';

/** Build a full SubStats object, overriding only what a test cares about. */
function stats(overrides: Partial<SubStats>): SubStats {
  const base: SubStats = {
    strength: 10, technique: 10, agility: 10,
    eyesight: 10, steadiness: 10, handling: 10,
    toughness: 10, reflexes: 10, armourUse: 10,
    temperament: 10, awareness: 10, discipline: 10,
    acceleration: 10, stamina: 10, manoeuvre: 10,
  };
  return { ...base, ...overrides };
}

describe('categoryScore: different bodies, equal effectiveness', () => {
  it('a balanced melee and a lopsided melee land near each other', () => {
    const balanced = stats({ strength: 12, technique: 12, agility: 12 });
    const lopsided = stats({ strength: 18, technique: 14, agility: 4 });
    const a = categoryScore(balanced, 'melee');
    const b = categoryScore(lopsided, 'melee');
    expect(Math.abs(a - b)).toBeLessThan(2.0);
  });

  it('brute (high strength) and duellist (high technique+agility) reach comparable melee', () => {
    const brute = stats({ strength: 18, technique: 9, agility: 6 });
    const duellist = stats({ strength: 9, technique: 15, agility: 15 });
    const a = categoryScore(brute, 'melee');
    const b = categoryScore(duellist, 'melee');
    expect(Math.abs(a - b)).toBeLessThan(2.5);
  });
});

describe('categoryScore: diminishing returns', () => {
  it('one maxed sub-stat cannot carry a category alone', () => {
    const oneMaxed = stats({ strength: 20, technique: 3, agility: 3 });
    const evenMid = stats({ strength: 11, technique: 11, agility: 11 });
    expect(categoryScore(oneMaxed, 'melee')).toBeLessThan(categoryScore(evenMid, 'melee'));
  });

  it('is monotonic: raising a sub-stat never lowers the category', () => {
    const lo = categoryScore(stats({ strength: 8 }), 'melee');
    const hi = categoryScore(stats({ strength: 16 }), 'melee');
    expect(hi).toBeGreaterThan(lo);
  });

  it('stays within the 1..20 scale', () => {
    const maxed = stats({ strength: 20, technique: 20, agility: 20 });
    expect(categoryScore(maxed, 'melee')).toBeLessThanOrEqual(20);
    expect(categoryScore(maxed, 'melee')).toBeGreaterThan(18);
  });
});
