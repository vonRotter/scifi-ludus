import { describe, it, expect } from 'vitest';
import { ageFighter, DECLINE_AGE, RETIRE_AGE, shouldRetire } from './aging';
import { makeRng } from './rng';
import { Fighter, SubStats } from './types';

function stats(): SubStats {
  return {
    strength: 12, technique: 12, agility: 12,
    eyesight: 12, steadiness: 12, handling: 12,
    toughness: 12, reflexes: 12, armourUse: 12,
    temperament: 12, awareness: 12, discipline: 12,
    acceleration: 12, stamina: 12, manoeuvre: 12,
  };
}

function fighter(overrides: Partial<Fighter> = {}): Fighter {
  return {
    id: 'f1', name: 'Test', bodyType: 'brute', subStats: stats(),
    potential: 12, matchesPlayed: 0, wage: 50, scoutLevel: 0, injuryWeeks: 0, age: 24,
    ...overrides,
  };
}

describe('aging', () => {
  it('adds a year and leaves a young fighter undimmed', () => {
    const aged = ageFighter(fighter({ age: 22 }), makeRng(1));
    expect(aged.age).toBe(23);
    expect(aged.subStats).toEqual(stats()); // no decline before prime ends
  });

  it('erodes physical stats once past the decline age, but never mental/aim', () => {
    // Average several seeds: an old fighter loses physical points over time.
    let physicalLost = 0;
    for (let s = 0; s < 50; s++) {
      const aged = ageFighter(fighter({ age: DECLINE_AGE + 6 }), makeRng(s));
      physicalLost += stats().strength - aged.subStats.strength
        + stats().agility - aged.subStats.agility;
      expect(aged.subStats.eyesight).toBe(stats().eyesight); // aim holds
      expect(aged.subStats.discipline).toBe(stats().discipline); // mind holds
    }
    expect(physicalLost).toBeGreaterThan(0);
  });
});

describe('retirement', () => {
  it('never retires the young', () => {
    for (let s = 0; s < 100; s++) {
      expect(shouldRetire(fighter({ age: RETIRE_AGE - 1 }), makeRng(s))).toBe(false);
    }
  });

  it('grows more likely with age', () => {
    const rate = (age: number) => {
      let hits = 0;
      for (let s = 0; s < 1000; s++) if (shouldRetire(fighter({ age }), makeRng(s))) hits++;
      return hits;
    };
    expect(rate(RETIRE_AGE + 6)).toBeGreaterThan(rate(RETIRE_AGE));
  });
});
