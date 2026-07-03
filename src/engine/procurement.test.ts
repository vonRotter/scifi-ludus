import { describe, it, expect } from 'vitest';
import {
  activateContract, advanceContract, bidScore, contractBounty, generateOffers,
  grantSpecialization, OFFER_COUNT, specLevel,
} from './procurement';
import { areRivals, corpByKey, mayBidOn } from './corporations';
import { ContractOffer } from './types';

function offer(over: Partial<ContractOffer> = {}): ContractOffer {
  return {
    id: 'o', sponsorCorp: 'helion', domain: 'melee', name: 'Trial',
    researchRequired: 4, goalWins: 2, deadlineWeeks: 6, acquisitionCost: 400, reward: 1, ...over,
  };
}

describe('contract market', () => {
  it('is deterministic in seed+season and the right size', () => {
    const a = generateOffers(777, 1);
    const b = generateOffers(777, 1);
    expect(a).toEqual(b);
    expect(a.length).toBe(OFFER_COUNT);
    expect(generateOffers(777, 2)).not.toEqual(a); // a new season, a new market
    for (const o of a) expect(corpByKey(o.sponsorCorp)).toBeTruthy(); // every sponsor is real
  });
});

describe('corporation rivalries gate bidding', () => {
  it('rivals cannot bid on each other, allies (and self) can', () => {
    expect(areRivals('helion', 'vantor')).toBe(true);
    expect(mayBidOn('vantor', 'helion')).toBe(false); // Vantor barred from Helion contracts
    expect(mayBidOn('helion', 'helion')).toBe(true); // a corp may bid on its own
    expect(mayBidOn('maru', 'helion')).toBe(true); // unrelated corps are fine
  });
});

describe('hybrid bid score', () => {
  const base = { credits: 500, reputation: 40, perk: 'income' as const, sameCorp: false, specialtyMatch: false, noise: 0 };
  it('rises with credits, reputation, and corp favour', () => {
    expect(bidScore({ ...base, credits: 800 })).toBeGreaterThan(bidScore(base));
    expect(bidScore({ ...base, reputation: 120 })).toBeGreaterThan(bidScore(base));
    expect(bidScore({ ...base, sameCorp: true })).toBeGreaterThan(bidScore(base));
    expect(bidScore({ ...base, specialtyMatch: true })).toBeGreaterThan(bidScore(base));
  });
  it('a procurement perk sharpens the credit component', () => {
    expect(bidScore({ ...base, perk: 'procurement' })).toBeGreaterThan(bidScore({ ...base, perk: 'income' }));
  });
});

describe('holding a contract', () => {
  it('activates from an offer with a fresh deadline and zeroed progress', () => {
    const c = activateContract(offer({ deadlineWeeks: 7, researchRequired: 5 }));
    expect(c.weeksLeft).toBe(7);
    expect(c.researchDone).toBe(0);
    expect(c.winsDone).toBe(0);
    expect(c.researchRequired).toBe(5);
  });

  it('fulfils only when BOTH research and wins are met before the deadline', () => {
    let c = activateContract(offer({ researchRequired: 3, goalWins: 2, deadlineWeeks: 6 }));
    let t = advanceContract(c, 2, 1); // research 2/3, wins 1/2
    expect(t.fulfilled).toBe(false);
    c = t.contract;
    t = advanceContract(c, 2, 1); // research capped 3/3, wins 2/2 -> done
    expect(t.fulfilled).toBe(true);
    expect(t.contract.researchDone).toBe(3);
  });

  it('research alone does not fulfil it — the win goal must also be met', () => {
    const c = activateContract(offer({ researchRequired: 2, goalWins: 2, deadlineWeeks: 6 }));
    const t = advanceContract(c, 5, 0); // research overshoots, but no wins
    expect(t.fulfilled).toBe(false);
    expect(t.forfeited).toBe(false);
  });

  it('forfeits when the deadline runs out unmet', () => {
    let c = activateContract(offer({ researchRequired: 9, goalWins: 1, deadlineWeeks: 2 }));
    let t = advanceContract(c, 1, 0); // week 1, weeksLeft 1
    expect(t.forfeited).toBe(false);
    t = advanceContract(t.contract, 1, 0); // week 2, weeksLeft 0, still unmet
    expect(t.forfeited).toBe(true);
    expect(t.fulfilled).toBe(false);
  });
});

describe('specialization', () => {
  it('accumulates levels per domain and reads back', () => {
    let spec = grantSpecialization({}, 'melee', 1);
    spec = grantSpecialization(spec, 'melee', 2);
    spec = grantSpecialization(spec, 'ranged', 1);
    expect(specLevel(spec, 'melee')).toBe(3);
    expect(specLevel(spec, 'ranged')).toBe(1);
    expect(specLevel(spec, 'defence')).toBe(0);
    expect(specLevel(undefined, 'melee')).toBe(0);
  });
  it('bounty scales with reward', () => {
    expect(contractBounty(2)).toBeGreaterThan(contractBounty(1));
  });
});
