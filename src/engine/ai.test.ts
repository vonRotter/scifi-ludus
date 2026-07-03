import { describe, it, expect } from 'vitest';
import { chooseFacilityUpgrade, chooseLineup, chooseSigning } from './ai';
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
    corpKey: 'helion', labLevel: 0, contract: null, specializations: {},
  };
}

function fighterOf(id: string, kind: 'melee' | 'ranged'): Fighter {
  const f = agent(id);
  const s = { ...f.subStats };
  if (kind === 'melee') { s.strength = 19; s.technique = 18; s.agility = 17; s.eyesight = 3; s.steadiness = 3; s.handling = 3; }
  else { s.eyesight = 19; s.steadiness = 18; s.handling = 17; s.strength = 4; s.technique = 4; s.agility = 4; }
  return { ...f, subStats: s };
}

describe('adaptive AI tactics', () => {
  const roster: Record<string, Fighter> = {};
  const ids: string[] = [];
  for (let i = 0; i < 6; i++) { const f = agent(`r${i}`); roster[f.id] = f; ids.push(f.id); }

  it('kites a melee-heavy opponent from range', () => {
    const enemy = Array.from({ length: 6 }, (_, i) => fighterOf(`m${i}`, 'melee'));
    const l = chooseLineup('ai', ids, roster, makeRng(1), enemy);
    expect(l.tactics.focus).toBe('ranged');
    expect(l.tactics.posture).toBe('defensive');
  });

  it('closes down a ranged-heavy opponent', () => {
    const enemy = Array.from({ length: 6 }, (_, i) => fighterOf(`g${i}`, 'ranged'));
    const l = chooseLineup('ai', ids, roster, makeRng(1), enemy);
    expect(l.tactics.focus).toBe('melee');
    expect(l.tactics.posture).toBe('aggressive');
  });
});

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
