import { describe, it, expect } from 'vitest';
import { chooseFacilityUpgrade, chooseSigning } from './ai';
import { emptyFacilities, FACILITY_KINDS, MAX_FACILITY_LEVEL } from './facilities';
import { ROSTER_SIZE } from './constants';
import { makeRng } from './rng';
import { Facilities, Fighter, Team } from './types';

function maxed(): Facilities {
  const f = emptyFacilities();
  for (const k of FACILITY_KINDS) f[k] = MAX_FACILITY_LEVEL;
  return f;
}

describe('AI facility investment', () => {
  it('saves (returns null) when it cannot afford to keep a reserve', () => {
    expect(chooseFacilityUpgrade(emptyFacilities(), 100, makeRng(1))).toBeNull();
  });

  it('invests in some facility when flush with cash', () => {
    const pick = chooseFacilityUpgrade(emptyFacilities(), 50000, makeRng(1));
    expect(pick).not.toBeNull();
    expect(FACILITY_KINDS).toContain(pick!);
  });

  it('saves when every facility is already maxed, however rich', () => {
    expect(chooseFacilityUpgrade(maxed(), 1_000_000, makeRng(1))).toBeNull();
  });
});

function agent(id: string): Fighter {
  return {
    id, name: id, bodyType: 'brute',
    subStats: {
      strength: 10, technique: 10, agility: 10, eyesight: 10, steadiness: 10, handling: 10,
      toughness: 10, reflexes: 10, armourUse: 10, temperament: 10, awareness: 10, discipline: 10,
      acceleration: 10, stamina: 10, manoeuvre: 10,
    },
    potential: 12, matchesPlayed: 0, wage: 50, scoutLevel: 0, injuryWeeks: 0, age: 22,
  };
}

function team(count: number): Team {
  return {
    id: 'ai', name: 'AI', isPlayer: false,
    fighterIds: Array.from({ length: count }, (_, i) => `own${i}`),
    budget: 3000, trainingFocus: 'melee', facilities: emptyFacilities(), reputation: 0,
  };
}

describe('AI free-agent recruiting', () => {
  it('signs a free agent when short-handed, and passes when the pool is empty', () => {
    const pool = [agent('a'), agent('b'), agent('c')];
    const pick = chooseSigning(team(6), pool, makeRng(1));
    expect(pick).not.toBeNull();
    expect(pool.map((f) => f.id)).toContain(pick!);
    expect(chooseSigning(team(6), [], makeRng(1))).toBeNull();
  });

  it('passes when the roster is already full', () => {
    expect(chooseSigning(team(ROSTER_SIZE), [agent('a')], makeRng(1))).toBeNull();
  });
});
