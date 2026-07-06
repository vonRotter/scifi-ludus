import { describe, it, expect } from 'vitest';
import { contractSeasonsOf, isExpiring, isUnderpaid, renewalFee, RENEW_SEASONS, wageDemand } from './contracts';
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

  it('wage demand rises with career wins and is never below the current wage', () => {
    const cheapWinner = fighter({ wage: 40, wins: 30 });
    const cheapRookie = fighter({ wage: 40, wins: 0 });
    expect(wageDemand(cheapWinner)).toBeGreaterThan(wageDemand(cheapRookie));
    // A fighter already paid above their computed demand never asks for less.
    expect(wageDemand(fighter({ wage: 1000, wins: 0 }))).toBe(1000);
    // A bigger club pays a touch more for the same fighter.
    expect(wageDemand(cheapWinner, 200)).toBeGreaterThan(wageDemand(cheapWinner, 0));
  });

  it('flags a proven fighter on a cheap deal as underpaid', () => {
    expect(isUnderpaid(fighter({ wage: 40, wins: 30 }))).toBe(true);
    expect(isUnderpaid(fighter({ wage: 1000, wins: 0 }))).toBe(false);
  });
});
