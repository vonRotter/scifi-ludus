import { describe, it, expect } from 'vitest';
import { estimateSubStat, estimateCategories, usageFromStat } from './fog';
import { newStat } from './match/events';
import { Fighter, SubStats } from './types';

function stats(): SubStats {
  return {
    strength: 14, technique: 14, agility: 14,
    eyesight: 14, steadiness: 14, handling: 14,
    toughness: 14, reflexes: 14, armourUse: 14,
    temperament: 14, awareness: 14, discipline: 14,
    acceleration: 14, stamina: 14, manoeuvre: 14,
  };
}

function fighter(overrides: Partial<Fighter> = {}): Fighter {
  return {
    id: 'f1', name: 'Test', bodyType: 'brute', subStats: stats(),
    potential: 12, matchesPlayed: 0, wage: 50, scoutLevel: 0, injuryWeeks: 0, age: 24,
    ...overrides,
  };
}

/** The width of a sub-stat's uncertainty band — smaller means better known. */
const bandWidth = (f: Fighter, key: keyof SubStats) => {
  const e = estimateSubStat(f, key);
  return e.high - e.low;
};

describe('usageFromStat', () => {
  it('maps each tally onto its category and caps at one category-match', () => {
    const u = usageFromStat({ ...newStat('home'), meleeAttempts: 6, rangedAttempts: 0, damageTaken: 20, zoneTicks: 30 });
    expect(u.melee).toBeCloseTo(0.5, 5);   // 6 / 12
    expect(u.ranged).toBe(0);
    expect(u.defence).toBeCloseTo(0.5, 5); // 20 / 40
    expect(u.speed).toBeCloseTo(0.5, 5);   // 30 / 60
    // A blowout can't count for more than one match's worth.
    const big = usageFromStat({ ...newStat('home'), meleeAttempts: 999, damageTaken: 9999 });
    expect(big.melee).toBe(1);
    expect(big.defence).toBe(1);
  });
});

describe('usage-based fog reveal', () => {
  it('is a no-op when the fighter has no usage (old saves read as before)', () => {
    const plain = fighter();
    const withEmpty = fighter({ usage: {} });
    expect(bandWidth(plain, 'strength')).toBe(bandWidth(withEmpty, 'strength'));
  });

  it('sharpens the categories a fighter exercised, not the ones they did not', () => {
    // Same true stats, zero matches, zero scouting — only usage differs.
    const brawler = fighter({ usage: { melee: 2 } });
    const base = fighter();
    // Their melee band is tighter than an unexercised fighter's...
    expect(bandWidth(brawler, 'strength')).toBeLessThan(bandWidth(base, 'strength'));
    // ...while a category they never used stays exactly as foggy.
    expect(bandWidth(brawler, 'eyesight')).toBe(bandWidth(base, 'eyesight'));
  });

  it('can fully reveal a category on heavy use alone, before any match count', () => {
    const specialist = fighter({ matchesPlayed: 0, scoutLevel: 0, usage: { melee: 4 } });
    expect(estimateSubStat(specialist, 'strength').revealed).toBe(true);
    // But only that category — ranged is still a guess.
    expect(estimateSubStat(specialist, 'eyesight').revealed).toBe(false);
    const cats = estimateCategories(specialist);
    expect(cats.melee.revealed).toBe(true);
    expect(cats.ranged.revealed).toBe(false);
  });
});
