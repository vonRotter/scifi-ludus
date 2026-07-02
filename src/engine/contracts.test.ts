import { describe, it, expect } from 'vitest';
import { contractSeasonsOf, isExpiring, renewalFee, RENEW_SEASONS } from './contracts';
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

describe('contracts', () => {
  it('defaults sensibly and flags an expiring deal', () => {
    expect(contractSeasonsOf(fighter())).toBe(2);
    expect(isExpiring(fighter({ contractSeasons: 3 }))).toBe(false);
    expect(isExpiring(fighter({ contractSeasons: 1 }))).toBe(true);
    expect(RENEW_SEASONS).toBeGreaterThan(1);
  });

  it('charges an unhappy fighter more to re-sign than a happy one', () => {
    const happy = renewalFee(fighter({ morale: 95 }));
    const sulking = renewalFee(fighter({ morale: 15 }));
    expect(sulking).toBeGreaterThan(happy);
    expect(happy).toBeGreaterThan(0);
  });
});
