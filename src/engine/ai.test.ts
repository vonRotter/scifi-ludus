import { describe, it, expect } from 'vitest';
import { chooseFacilityUpgrade } from './ai';
import { emptyFacilities, FACILITY_KINDS, MAX_FACILITY_LEVEL } from './facilities';
import { makeRng } from './rng';
import { Facilities } from './types';

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
