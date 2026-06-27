import { describe, it, expect } from 'vitest';
import { prospectPotentialBoost, reputationGain, reputationTier } from './reputation';

describe('reputation gain', () => {
  it('rewards a higher finish more', () => {
    expect(reputationGain(1, 4)).toBeGreaterThan(reputationGain(4, 4));
  });
  it('always pays a little, even for last', () => {
    expect(reputationGain(4, 4)).toBeGreaterThan(0);
  });
});

describe('reputation tiers', () => {
  it('starts unknown and climbs with reputation', () => {
    expect(reputationTier(0)).toBe('Unknown');
    expect(reputationTier(1000)).toBe('Legendary');
    expect(reputationTier(100)).not.toBe(reputationTier(0));
  });
});

describe('prospect potential boost', () => {
  it('is zero for an unknown ludus and grows with renown, capped', () => {
    expect(prospectPotentialBoost(0)).toBe(0);
    expect(prospectPotentialBoost(120)).toBeGreaterThan(prospectPotentialBoost(0));
    expect(prospectPotentialBoost(100000)).toBeLessThanOrEqual(4);
  });
});
