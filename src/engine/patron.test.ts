import { describe, it, expect } from 'vitest';
import {
  confidenceAfter, confidenceLabel, objectiveFor, objectiveMet, patronBonus,
} from './patron';

describe('patron objectives', () => {
  it('asks more of a renowned ludus than an unknown one', () => {
    const unknown = objectiveFor(0, 4);
    const renowned = objectiveFor(300, 4);
    expect(renowned.targetRank).toBeLessThan(unknown.targetRank);
    expect(renowned.targetRank).toBe(1); // win the league
  });

  it('judges a placement against the target', () => {
    const obj = objectiveFor(0, 4); // avoid last: targetRank 3
    expect(objectiveMet(2, obj)).toBe(true);
    expect(objectiveMet(4, obj)).toBe(false);
  });
});

describe('patron confidence', () => {
  it('rises on success and falls on failure, clamped', () => {
    expect(confidenceAfter(60, true)).toBeGreaterThan(60);
    expect(confidenceAfter(60, false)).toBeLessThan(60);
    expect(confidenceAfter(95, true)).toBeLessThanOrEqual(100);
    expect(confidenceAfter(5, false)).toBeGreaterThanOrEqual(0);
  });

  it('pays a bonus only on success and labels the mood', () => {
    expect(patronBonus(true)).toBeGreaterThan(0);
    expect(patronBonus(false)).toBe(0);
    expect(confidenceLabel(10)).toBe('Precarious');
    expect(confidenceLabel(90)).toBe('Delighted');
  });
});
