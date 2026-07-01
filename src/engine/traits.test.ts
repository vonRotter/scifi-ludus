import { describe, it, expect } from 'vitest';
import {
  applyTraits, knownTraits, rollTraits, traitInjuryMult, traitsOf,
  traitsRevealed, traitTrainingMult, TRAITS,
} from './traits';
import { makeRng } from './rng';
import { Fighter, SubStats, TraitKey } from './types';

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

describe('trait assignment', () => {
  it('produces at most two traits, and never a contradictory pair', () => {
    for (let s = 0; s < 500; s++) {
      const ts = rollTraits(makeRng(s));
      expect(ts.length).toBeLessThanOrEqual(2);
      expect(new Set(ts).size).toBe(ts.length); // no duplicates
      if (ts.includes('fragile')) expect(ts).not.toContain('ironhide');
      if (ts.includes('berserker')) expect(ts).not.toContain('stalwart');
    }
  });

  it('beasts only roll from the wild pool', () => {
    const allowed = new Set<TraitKey>(['berserker', 'ironhide', 'fleet', 'fragile']);
    for (let s = 0; s < 300; s++) {
      for (const t of rollTraits(makeRng(s), true)) expect(allowed.has(t)).toBe(true);
    }
  });
});

describe('trait effects', () => {
  it('applies stat shifts at match time without touching the stored fighter', () => {
    const f = fighter({ traits: ['berserker'] });
    const loaded = applyTraits(f);
    expect(loaded.subStats.strength).toBe(12); // +2
    expect(loaded.subStats.toughness).toBe(8); // -2
    expect(f.subStats.strength).toBe(10); // original untouched
  });

  it('is a no-op for a fighter with no traits', () => {
    const f = fighter();
    expect(traitsOf(f)).toEqual([]);
    expect(applyTraits(f)).toBe(f);
  });

  it('fragile raises injury odds, iron-hide lowers them, prodigy speeds training', () => {
    expect(traitInjuryMult(fighter({ traits: ['fragile'] }))).toBeGreaterThan(1);
    expect(traitInjuryMult(fighter({ traits: ['ironhide'] }))).toBeLessThan(1);
    expect(traitTrainingMult(fighter({ traits: ['prodigy'] }))).toBeGreaterThan(1);
    expect(traitInjuryMult(fighter())).toBe(1);
  });
});

describe('trait fog', () => {
  it('hides traits until enough appearances or scouting', () => {
    const green = fighter({ traits: ['deadeye'], matchesPlayed: 0, scoutLevel: 0 });
    expect(traitsRevealed(green)).toBe(false);
    expect(knownTraits(green)).toEqual([]);

    expect(traitsRevealed(fighter({ traits: ['deadeye'], matchesPlayed: 4 }))).toBe(true);
    expect(knownTraits(fighter({ traits: ['deadeye'], scoutLevel: 2 }))).toEqual(['deadeye']);
  });

  it('every catalogued trait has a label and description', () => {
    for (const key of Object.keys(TRAITS) as TraitKey[]) {
      expect(TRAITS[key].label.length).toBeGreaterThan(0);
      expect(TRAITS[key].desc.length).toBeGreaterThan(0);
    }
  });
});
