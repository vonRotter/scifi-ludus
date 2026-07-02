import { describe, it, expect } from 'vitest';
import {
  applyArmoury,
  applyHousing,
  applyScoutingDiscount,
  applyWeaponsmith,
  canUpgrade,
  emptyFacilities,
  facilityUpgradeCost,
  MAX_FACILITY_LEVEL,
  rosterCap,
  stadiumGate,
  trainingBonus,
  upgradeFacility,
} from './facilities';
import { Fighter } from './types';

function fighter(overrides: Partial<Fighter> = {}): Fighter {
  return {
    id: 'f1',
    name: 'Test',
    bodyType: 'brute',
    subStats: {
      strength: 10, technique: 10, agility: 10,
      eyesight: 10, steadiness: 10, handling: 10,
      toughness: 10, reflexes: 10, armourUse: 10,
      temperament: 10, awareness: 10, discipline: 10,
      acceleration: 10, stamina: 10, manoeuvre: 10,
    },
    potential: 12,
    matchesPlayed: 0,
    wage: 50,
    scoutLevel: 0,
    injuryWeeks: 0,
    age: 24,
    ...overrides,
  };
}

describe('facility levels', () => {
  it('starts at zero for every kind', () => {
    const f = emptyFacilities();
    expect(f.training).toBe(0);
    expect(f.scouting).toBe(0);
    expect(f.armoury).toBe(0);
    expect(f.weaponsmith).toBe(0);
    expect(f.housing).toBe(0);
    expect(f.stadium).toBe(0);
  });

  it('upgrades one level at a time and stops at the cap', () => {
    let f = emptyFacilities();
    for (let i = 0; i < MAX_FACILITY_LEVEL; i++) {
      expect(canUpgrade(f, 'training')).toBe(true);
      f = upgradeFacility(f, 'training');
    }
    expect(f.training).toBe(MAX_FACILITY_LEVEL);
    expect(canUpgrade(f, 'training')).toBe(false);
    expect(upgradeFacility(f, 'training')).toBe(f); // no-op once maxed
  });

  it('cost rises with level', () => {
    let f = emptyFacilities();
    const c0 = facilityUpgradeCost(f, 'armoury');
    f = upgradeFacility(f, 'armoury');
    const c1 = facilityUpgradeCost(f, 'armoury');
    expect(c1).toBeGreaterThan(c0);
  });
});

describe('facility effects', () => {
  it('training bonus grows with level and is zero at level 0', () => {
    expect(trainingBonus(0)).toBe(0);
    expect(trainingBonus(2)).toBeGreaterThan(trainingBonus(1));
  });

  it('scouting discount reduces cost, more at higher levels', () => {
    const base = 100;
    expect(applyScoutingDiscount(base, 0)).toBe(base);
    expect(applyScoutingDiscount(base, 1)).toBeLessThan(base);
    expect(applyScoutingDiscount(base, 3)).toBeLessThan(applyScoutingDiscount(base, 1));
  });

  it('armoury boosts defensive sub-stats without touching the original fighter', () => {
    const f = fighter();
    const boosted = applyArmoury(f, 2);
    expect(boosted.subStats.toughness).toBeGreaterThan(f.subStats.toughness);
    expect(boosted.subStats.armourUse).toBeGreaterThan(f.subStats.armourUse);
    expect(f.subStats.toughness).toBe(10); // original untouched
  });

  it('armoury is a no-op at level 0', () => {
    const f = fighter();
    expect(applyArmoury(f, 0)).toBe(f);
  });

  it('weaponsmith boosts offensive sub-stats without touching the original fighter', () => {
    const f = fighter();
    const boosted = applyWeaponsmith(f, 2);
    expect(boosted.subStats.technique).toBeGreaterThan(f.subStats.technique);
    expect(boosted.subStats.handling).toBeGreaterThan(f.subStats.handling);
    expect(f.subStats.technique).toBe(10); // original untouched
  });

  it('weaponsmith is a no-op at level 0', () => {
    const f = fighter();
    expect(applyWeaponsmith(f, 0)).toBe(f);
  });

  it('housing boosts visible mental sub-stats, leaving hidden temperament alone', () => {
    const f = fighter();
    const boosted = applyHousing(f, 2);
    expect(boosted.subStats.awareness).toBeGreaterThan(f.subStats.awareness);
    expect(boosted.subStats.discipline).toBeGreaterThan(f.subStats.discipline);
    expect(boosted.subStats.temperament).toBe(f.subStats.temperament);
    expect(f.subStats.awareness).toBe(10); // original untouched
  });

  it('housing is a no-op at level 0', () => {
    const f = fighter();
    expect(applyHousing(f, 0)).toBe(f);
  });

  it('stadium gate is zero unbuilt and grows with level', () => {
    expect(stadiumGate(0)).toBe(0);
    expect(stadiumGate(2)).toBeGreaterThan(stadiumGate(1));
  });

  it('roster cap grows with housing level', () => {
    expect(rosterCap(0)).toBeGreaterThan(0);
    expect(rosterCap(1)).toBeGreaterThan(rosterCap(0));
    expect(rosterCap(3)).toBeGreaterThan(rosterCap(1));
  });
});
