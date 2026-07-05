import { describe, it, expect } from 'vitest';
import { adjustTactics, chooseFacilityUpgrade, chooseLineup, chooseSigning, NEUTRAL_PERSONALITY, rollPersonality } from './ai';
import { emptyFacilities, FACILITY_KINDS, MAX_FACILITY_LEVEL } from './facilities';
import { ROSTER_SIZE } from './constants';
import { makeRng } from './rng';
import { AiPersonality, Facilities, Fighter, Tactics, Team } from './types';

const persona = (over: Partial<AiPersonality>): AiPersonality => ({ ...NEUTRAL_PERSONALITY, ...over });

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

describe('AI half-time adjustment', () => {
  const base: Tactics = { posture: 'balanced', focus: 'objective', roles: {} };
  const meleeSquad = Array.from({ length: 6 }, (_, i) => fighterOf(`m${i}`, 'melee'));

  it('tightens up when protecting a lead', () => {
    expect(adjustTactics(base, 20, 8, meleeSquad).posture).toBe('defensive');
  });

  it('presses aggressively on its own strength when being beaten', () => {
    const adj = adjustTactics(base, 5, 20, meleeSquad);
    expect(adj.posture).toBe('aggressive');
    expect(adj.focus).toBe('melee');
  });

  it('turns to the objective in a tight game', () => {
    expect(adjustTactics(base, 12, 12, meleeSquad).focus).toBe('objective');
  });
});

describe('AI personality', () => {
  it('rollPersonality is deterministic and stays in a sane band', () => {
    const a = rollPersonality(makeRng(7));
    const b = rollPersonality(makeRng(7));
    expect(a).toEqual(b);
    for (const v of Object.values(a)) {
      expect(v).toBeGreaterThanOrEqual(0.15);
      expect(v).toBeLessThanOrEqual(0.85);
    }
  });

  it('aggression shifts when a stable presses or sits back', () => {
    const base: Tactics = { posture: 'balanced', focus: 'objective', roles: {} };
    const squad = Array.from({ length: 6 }, (_, i) => fighterOf(`m${i}`, 'melee'));
    const bold = persona({ aggression: 1 });
    const timid = persona({ aggression: 0 });
    // Four behind: the aggressive stable already presses; the timid one holds.
    expect(adjustTactics(base, 6, 10, squad, bold).posture).toBe('aggressive');
    expect(adjustTactics(base, 6, 10, squad, timid).posture).not.toBe('aggressive');
    // Four ahead: the timid stable already shuts up shop; the aggressive one won't.
    expect(adjustTactics(base, 10, 6, squad, timid).posture).toBe('defensive');
    expect(adjustTactics(base, 10, 6, squad, bold).posture).not.toBe('defensive');
  });

  it('scheming decides whether it counter-picks or plays its own game', () => {
    const roster: Record<string, Fighter> = {};
    const ids: string[] = [];
    for (let i = 0; i < 6; i++) { const f = agent(`r${i}`); roster[f.id] = f; ids.push(f.id); }
    const enemy = Array.from({ length: 6 }, (_, i) => fighterOf(`m${i}`, 'melee'));
    const schemer = chooseLineup('ai', ids, roster, makeRng(1), enemy, persona({ scheming: 0.9 }));
    const stubborn = chooseLineup('ai', ids, roster, makeRng(1), enemy, persona({ scheming: 0.2 }));
    expect(schemer.tactics.focus).toBe('ranged'); // counters the melee foe
    expect(stubborn.tactics.focus).not.toBe('ranged'); // plays its own game instead
  });

  it('youthBias reaches for prospects a veteran-minded stable passes on', () => {
    const aged = (id: string, age: number): Fighter => ({ ...agent(id), age });
    // Three veterans then a younger prospect of equal raw ability, listed last.
    const pool = [aged('vetA', 30), aged('vetB', 30), aged('vetC', 30), aged('kid', 20)];
    const youthTeam = { ...team(6), personality: persona({ youthBias: 1 }) };
    const vetTeam = { ...team(6), personality: persona({ youthBias: 0 }) };
    let youthPicksKid = false;
    let vetPicksKid = false;
    for (let s = 1; s <= 24; s++) {
      if (chooseSigning(youthTeam, pool, makeRng(s)) === 'kid') youthPicksKid = true;
      if (chooseSigning(vetTeam, pool, makeRng(s)) === 'kid') vetPicksKid = true;
    }
    expect(youthPicksKid).toBe(true);
    expect(vetPicksKid).toBe(false);
  });

  it('patience raises the cash a stable hoards before investing', () => {
    // At 1500 the impatient stable builds (reserve 320); the patient one saves
    // (reserve 1280 — 1500 minus the 500 cost falls short).
    expect(chooseFacilityUpgrade(emptyFacilities(), 1500, makeRng(1), persona({ patience: 1 }))).toBeNull();
    expect(chooseFacilityUpgrade(emptyFacilities(), 1500, makeRng(1), persona({ patience: 0 }))).not.toBeNull();
  });
});
