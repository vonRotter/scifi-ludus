import { describe, it, expect } from 'vitest';
import { placementPrize } from './finance';

describe('end-of-season placement prize', () => {
  it('pays more for a higher finish and tapers to the bottom', () => {
    expect(placementPrize(1, 4)).toBeGreaterThan(placementPrize(2, 4));
    expect(placementPrize(2, 4)).toBeGreaterThan(placementPrize(4, 4));
  });

  it('always pays something, even for last place', () => {
    expect(placementPrize(4, 4)).toBeGreaterThan(0);
  });
});
