import { describe, it, expect } from 'vitest';
import { isInjured, recover, recoveryStep, rollInjuryWeeks } from './injury';
import { makeRng } from './rng';
import { Fighter, SubStats } from './types';

function stats(overrides: Partial<SubStats> = {}): SubStats {
  const base: SubStats = {
    strength: 10, technique: 10, agility: 10,
    eyesight: 10, steadiness: 10, handling: 10,
    toughness: 10, reflexes: 10, armourUse: 10,
    temperament: 10, awareness: 10, discipline: 10,
    acceleration: 10, stamina: 10, manoeuvre: 10,
  };
  return { ...base, ...overrides };
}

function fighter(overrides: Partial<Fighter> = {}): Fighter {
  return {
    id: 'f1', name: 'Test', bodyType: 'brute', subStats: stats(),
    potential: 12, matchesPlayed: 0, wage: 50, scoutLevel: 0, injuryWeeks: 0, age: 24,
    ...overrides,
  };
}

describe('injury status and recovery', () => {
  it('isInjured tracks the countdown', () => {
    expect(isInjured(fighter({ injuryWeeks: 0 }))).toBe(false);
    expect(isInjured(fighter({ injuryWeeks: 2 }))).toBe(true);
  });

  it('recovers faster with a higher medbay level, clamped at zero', () => {
    expect(recoveryStep(0)).toBe(1);
    expect(recoveryStep(2)).toBeGreaterThan(recoveryStep(0));
    expect(recover(fighter({ injuryWeeks: 3 }), 0).injuryWeeks).toBe(2);
    expect(recover(fighter({ injuryWeeks: 3 }), 2).injuryWeeks).toBe(0); // heals 3 at once
    expect(recover(fighter({ injuryWeeks: 0 }), 0).injuryWeeks).toBe(0);
  });
});

describe('rolling injuries', () => {
  it('always returns a valid duration (0 or within bounds)', () => {
    for (let s = 0; s < 200; s++) {
      const weeks = rollInjuryWeeks(fighter(), makeRng(s));
      expect(weeks).toBeGreaterThanOrEqual(0);
      expect(weeks).toBeLessThanOrEqual(4);
    }
  });

  it('tougher fighters are injured less often', () => {
    const frail = fighter({ subStats: stats({ toughness: 2, reflexes: 2, armourUse: 2 }) });
    const tough = fighter({ subStats: stats({ toughness: 20, reflexes: 20, armourUse: 20 }) });
    let frailHits = 0;
    let toughHits = 0;
    for (let s = 0; s < 2000; s++) {
      if (rollInjuryWeeks(frail, makeRng(s)) > 0) frailHits++;
      if (rollInjuryWeeks(tough, makeRng(s + 99999)) > 0) toughHits++;
    }
    expect(frailHits).toBeGreaterThan(toughHits);
  });
});
