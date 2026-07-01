import { describe, it, expect } from 'vitest';
import {
  applyMorale, moraleAfterBenched, moraleAfterInjury, moraleAfterResult,
  moraleLabel, moraleOf, NEUTRAL_MORALE,
} from './morale';
import { Fighter, SubStats } from './types';

function stats(): SubStats {
  return {
    strength: 10, technique: 10, agility: 10,
    eyesight: 10, steadiness: 10, handling: 10,
    toughness: 10, reflexes: 10, armourUse: 10,
    temperament: 10, awareness: 10, discipline: 10,
    acceleration: 10, stamina: 10, manoeuvre: 10,
  };
}

function fighter(overrides: Partial<Fighter> = {}): Fighter {
  return {
    id: 'f1', name: 'Test', bodyType: 'brute', subStats: stats(),
    potential: 12, matchesPlayed: 0, wage: 50, scoutLevel: 0, injuryWeeks: 0, age: 24,
    ...overrides,
  };
}

describe('morale movement', () => {
  it('rises on a win, falls on a loss, and clamps to 0..100', () => {
    expect(moraleAfterResult(60, 'win')).toBeGreaterThan(60);
    expect(moraleAfterResult(60, 'loss')).toBeLessThan(60);
    expect(moraleAfterResult(98, 'win')).toBeLessThanOrEqual(100);
    expect(moraleAfterResult(2, 'loss')).toBeGreaterThanOrEqual(0);
  });

  it('drops further from injury and drifts down on the bench', () => {
    expect(moraleAfterInjury(60)).toBeLessThan(60);
    expect(moraleAfterBenched(60)).toBeLessThan(60);
  });

  it('defaults to neutral when unset', () => {
    expect(moraleOf(fighter())).toBe(NEUTRAL_MORALE);
    expect(moraleOf(fighter({ morale: 80 }))).toBe(80);
  });
});

describe('morale effect', () => {
  it('lifts a buoyant fighter and drags a dejected one, bounded and side-neutral', () => {
    const high = applyMorale(fighter({ morale: 95 }));
    const low = applyMorale(fighter({ morale: 10 }));
    expect(high.subStats.awareness).toBeGreaterThan(10);
    expect(low.subStats.awareness).toBeLessThan(10);
    // Bounded to ±2.
    expect(high.subStats.awareness - 10).toBeLessThanOrEqual(2);
    expect(10 - low.subStats.awareness).toBeLessThanOrEqual(2);
  });

  it('is a no-op at neutral morale', () => {
    const f = fighter({ morale: NEUTRAL_MORALE });
    expect(applyMorale(f)).toBe(f);
  });
});

describe('morale label', () => {
  it('climbs through the tiers', () => {
    expect(moraleLabel(10)).toBe('Dejected');
    expect(moraleLabel(90)).toBe('Buoyant');
    expect(moraleLabel(10)).not.toBe(moraleLabel(60));
  });
});
