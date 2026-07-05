import { describe, it, expect } from 'vitest';
import { energyFactor, updateEnergy } from './stamina';
import { simulateMatch } from './simulate';
import { generateContent } from '../../data/seedFighters';
import { ARENAS } from '../../data/arenas';
import { SQUAD_SIZE } from '../constants';
import { Entity } from './internal';
import { Fighter, Role, Side, SquadInput, Tactics } from '../types';

/** A stub with just the fields updateEnergy reads/writes. */
function stub(energy: number, stamina = 12): Entity {
  return { energy, stamina } as unknown as Entity;
}

describe('energyFactor', () => {
  it('fades from 1.0 fresh to a 0.6 floor when spent, never lower', () => {
    expect(energyFactor(1)).toBeCloseTo(1);
    expect(energyFactor(0)).toBeCloseTo(0.6);
    expect(energyFactor(0.5)).toBeCloseTo(0.8);
  });
});

describe('updateEnergy', () => {
  it('drains with movement and an attack, recovers when still', () => {
    const moving = stub(1);
    updateEnergy(moving, 3, true, 'balanced');
    expect(moving.energy).toBeLessThan(1);

    const resting = stub(0.5);
    updateEnergy(resting, 0, false, 'balanced');
    expect(resting.energy).toBeGreaterThan(0.5);
  });

  it('aggressive posture drains faster than defensive', () => {
    const agg = stub(1);
    const def = stub(1);
    updateEnergy(agg, 3, true, 'aggressive');
    updateEnergy(def, 3, true, 'defensive');
    expect(1 - agg.energy).toBeGreaterThan(1 - def.energy);
  });

  it('higher stamina drains slower', () => {
    const lo = stub(1, 4);
    const hi = stub(1, 18);
    updateEnergy(lo, 3, true, 'balanced');
    updateEnergy(hi, 3, true, 'balanced');
    expect(lo.energy).toBeLessThan(hi.energy);
  });

  it('never falls below zero', () => {
    const e = stub(0.001);
    for (let i = 0; i < 50; i++) updateEnergy(e, 5, true, 'aggressive');
    expect(e.energy).toBe(0);
  });
});

function squad(fighters: Fighter[], side: Side): SquadInput {
  const roles: Record<string, Role> = {};
  for (const f of fighters) roles[f.id] = 'frontline';
  const tactics: Tactics = { posture: 'aggressive', focus: 'melee', roles };
  return { side, fighters: fighters.slice(0, SQUAD_SIZE), tactics };
}

describe('fatigue over a match', () => {
  it('tires fighters within a round and carries the fatigue into round two', () => {
    const c = generateContent(321);
    const home = c.teams[0].fighterIds.map((id) => c.fighters[id]);
    const away = c.teams[1].fighterIds.map((id) => c.fighters[id]);
    const r = simulateMatch(squad(home, 'home'), squad(away, 'away'), ARENAS[0], 4);

    // Someone is measurably tired by the end of round one.
    const r1End = r.rounds[0].frames[r.rounds[0].frames.length - 1];
    expect(r1End.fighters.some((f) => f.energy < 0.9)).toBe(true);

    // Round two opens with carried-over fatigue, not a full reset.
    const r2Start = r.rounds[1].frames[0];
    expect(r2Start.fighters.some((f) => f.energy < 0.95)).toBe(true);
  });
});
