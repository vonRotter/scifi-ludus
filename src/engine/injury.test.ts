import { describe, it, expect } from 'vitest';
import { applyInjuryOutcome, isInjured, recover, recoveryStep, rollInjury } from './injury';
import { makeRng } from './rng';
import { Fighter, SubStats } from './types';

function stats(overrides: Partial<SubStats> = {}): SubStats {
  const base: SubStats = {
    strength: 10, technique: 10, agility: 10,
    eyesight: 10, steadiness: 10, handling: 10,
    toughness: 10, reflexes: 10, armourUse: 10,
    temperament: 10, awareness: 10, discipline: 10,
    acceleration: 10, stamina: 10, manoeuvre: 10,
  };
  return { ...base, ...overrides };
}

function fighter(overrides: Partial<Fighter> = {}): Fighter {
  return {
    id: 'f1', name: 'Test', bodyType: 'brute', subStats: stats(),
    potential: 12, matchesPlayed: 0, wage: 50, scoutLevel: 0, injuryWeeks: 0, age: 24,
    ...overrides,
  };
}

describe('injury status and recovery', () => {
  it('isInjured tracks the countdown', () => {
    expect(isInjured(fighter({ injuryWeeks: 0 }))).toBe(false);
    expect(isInjured(fighter({ injuryWeeks: 2 }))).toBe(true);
  });

  it('recovers faster with a higher medbay level, clamped at zero', () => {
    expect(recoveryStep(0)).toBe(1);
    expect(recoveryStep(2)).toBeGreaterThan(recoveryStep(0));
    expect(recover(fighter({ injuryWeeks: 3 }), 0).injuryWeeks).toBe(2);
    expect(recover(fighter({ injuryWeeks: 3 }), 2).injuryWeeks).toBe(0); // heals 3 at once
    expect(recover(fighter({ injuryWeeks: 0 }), 0).injuryWeeks).toBe(0);
  });
});

describe('rolling injuries', () => {
  it('only ever yields the four valid outcome kinds, with sane durations', () => {
    for (let s = 0; s < 400; s++) {
      const o = rollInjury(fighter(), makeRng(s));
      expect(['none', 'knock', 'serious', 'ending']).toContain(o.kind);
      if (o.kind === 'knock' || o.kind === 'serious') {
        expect(o.weeks).toBeGreaterThanOrEqual(1);
        expect(o.weeks).toBeLessThanOrEqual(6);
      }
    }
  });

  it('tougher fighters are injured less often', () => {
    const frail = fighter({ subStats: stats({ toughness: 2, reflexes: 2, armourUse: 2 }) });
    const tough = fighter({ subStats: stats({ toughness: 20, reflexes: 20, armourUse: 20 }) });
    let frailHits = 0;
    let toughHits = 0;
    for (let s = 0; s < 2000; s++) {
      if (rollInjury(frail, makeRng(s)).kind !== 'none') frailHits++;
      if (rollInjury(tough, makeRng(s + 99999)).kind !== 'none') toughHits++;
    }
    expect(frailHits).toBeGreaterThan(toughHits);
  });

  it('most injuries are knocks; career-enders are rare', () => {
    const counts: Record<string, number> = { none: 0, knock: 0, serious: 0, ending: 0 };
    for (let s = 0; s < 20000; s++) counts[rollInjury(fighter(), makeRng(s)).kind]++;
    const injuries = counts.knock + counts.serious + counts.ending;
    expect(counts.knock).toBeGreaterThan(counts.serious);
    expect(counts.serious).toBeGreaterThan(counts.ending);
    expect(counts.ending / injuries).toBeLessThan(0.15); // genuinely rare
  });

  it('applyInjuryOutcome sidelines a knock and docks a stat for a serious injury', () => {
    const f = fighter();
    expect(applyInjuryOutcome(f, { kind: 'knock', weeks: 2 }).injuryWeeks).toBe(2);
    const hurt = applyInjuryOutcome(f, { kind: 'serious', weeks: 4, statLoss: 'strength' });
    expect(hurt.injuryWeeks).toBe(4);
    expect(hurt.subStats.strength).toBe(f.subStats.strength - 1);
  });
});
