/**
 * Military procurement: the contract market that IS the game's R&D layer.
 *
 * Stables bid to win a corporation-sponsored contract, then fulfil it by
 * spending research (from their R&D Lab) and winning bouts before a deadline.
 * Fulfilment grants a permanent SPECIALIZATION level in one combat domain,
 * applied conditionally by the match engine (see match/combat & movement).
 *
 * Single responsibility: the pure rules — lab capacity, contract generation,
 * the hybrid bid score, contract advancement, and the specialization step
 * sizes. No React, no state ownership; randomness only via an injected Rng.
 */

import { makeRng, deriveSeed } from './rng';
import { ActiveContract, ContractOffer, CorpPerk, Domain, DOMAINS, SpecLevels } from './types';
import { CORP_KEYS, corpByKey } from './corporations';

// --- R&D Lab: research capacity toward the active contract -------------------

export const MAX_LAB_LEVEL = 3;

/** Research points banked per match week, from the R&D Lab level (0 = none). */
export function researchRate(labLevel: number): number {
  return labLevel;
}

export function canUpgradeLab(labLevel: number): boolean {
  return labLevel < MAX_LAB_LEVEL;
}

/** Credits to build the next R&D Lab level (steeper each level). */
export function labUpgradeCost(labLevel: number): number {
  return 600 + labLevel * 800;
}

/** Credits to commission a prototype: one research point toward the contract. */
export const FUND_COST = 250;
export const FUND_STEP = 1;

// --- Specialization: the conditional combat payoff ---------------------------

/** Per-level multipliers/bonuses a domain specialization grants IN CONTEXT. */
export const SPEC_ATTACK_STEP = 0.06; // melee/ranged outgoing damage, per level
export const SPEC_DEFENCE_STEP = 0.06; // effective defence, per level
export const SPEC_SPEED_STEP = 0.05; // move speed, per level
export const SPEC_MENTAL_STEP = 0.02; // hit chance (additive), per level

export function specLevel(spec: SpecLevels | undefined, domain: Domain): number {
  return spec?.[domain] ?? 0;
}

/** Add a fulfilled contract's reward to a team's specialization tally. */
export function grantSpecialization(spec: SpecLevels, domain: Domain, levels: number): SpecLevels {
  return { ...spec, [domain]: (spec[domain] ?? 0) + levels };
}

// --- Contract market ---------------------------------------------------------

/** How many contracts sit on the market at once. */
export const OFFER_COUNT = 4;

const CONTRACT_NAMES: Record<Domain, string[]> = {
  melee: ['Blade-Servo Field Trial', 'Close-Assault Doctrine', 'Monoedge Certification'],
  ranged: ['Beam Coherence Program', 'Long-Lance Munitions Trial', 'Targeting-Array Contract'],
  defence: ['Ablative Hull Program', 'Bulwark Plating Trial', 'Hardpoint Survivability Study'],
  speed: ['Rapid-Deploy Doctrine', 'Servo-Mobility Trial', 'Skirmish-Envelope Program'],
  mental: ['Battle-Cognition Study', 'Tac-Net Integration Trial', 'Command-Link Program'],
};

/**
 * Generate the season's market: OFFER_COUNT contracts, each sponsored by a
 * corporation and (usually) in that corp's specialty domain. Deterministic in
 * `seed`+`season` so a career always sees the same market. Difficulty and
 * reward scale together — a pricier, longer contract pays a bigger reward.
 */
export function generateOffers(seed: number, season: number): ContractOffer[] {
  const rng = makeRng(deriveSeed(seed, 0x600ffe + season));
  const offers: ContractOffer[] = [];
  for (let i = 0; i < OFFER_COUNT; i++) {
    const sponsorCorp = rng.pick(CORP_KEYS);
    const corp = corpByKey(sponsorCorp);
    // Mostly the sponsor's specialty; sometimes a stretch into another domain.
    const domain: Domain = rng.chance(0.7) ? corp.specialty : rng.pick(DOMAINS as Domain[]);
    const reward = rng.chance(0.25) ? 2 : 1;
    const researchRequired = 3 + reward + rng.int(0, 2);
    const goalWins = reward + rng.int(0, 1);
    const acquisitionCost = 300 + reward * 250 + rng.int(0, 200);
    offers.push({
      id: `ct-${season}-${i}`,
      sponsorCorp,
      domain,
      name: rng.pick(CONTRACT_NAMES[domain]),
      researchRequired,
      goalWins,
      deadlineWeeks: 6 + reward * 2,
      acquisitionCost,
      reward,
    });
  }
  return offers;
}

// --- The hybrid auction ------------------------------------------------------

export interface BidInput {
  /** Credits the stable stakes on this offer. */
  credits: number;
  /** The bidding stable's standing. */
  reputation: number;
  perk: CorpPerk;
  /** The bidder's corp is the sponsor. */
  sameCorp: boolean;
  /** The bidder's corp specialty matches the contract domain. */
  specialtyMatch: boolean;
  /** Auction noise in [0,1), from the caller's rng. */
  noise: number;
}

const REP_WEIGHT = 2.5;
const FAVOUR_SAME_CORP = 350;
const FAVOUR_SPECIALTY = 150;
const NOISE_WEIGHT = 200;

/**
 * The hybrid bid score: credits (sharpened by a procurement perk) + standing +
 * corp favour + a dash of noise. Highest score wins the sealed auction.
 */
export function bidScore(b: BidInput): number {
  const creditPart = b.credits * (b.perk === 'procurement' ? 1.25 : 1);
  const favour = (b.sameCorp ? FAVOUR_SAME_CORP : 0) + (b.specialtyMatch ? FAVOUR_SPECIALTY : 0);
  return creditPart + b.reputation * REP_WEIGHT + favour + b.noise * NOISE_WEIGHT;
}

// --- Holding & fulfilling a contract -----------------------------------------

/** Turn a won offer into the active contract its holder now works to fulfil. */
export function activateContract(offer: ContractOffer): ActiveContract {
  return {
    id: offer.id,
    sponsorCorp: offer.sponsorCorp,
    domain: offer.domain,
    name: offer.name,
    researchRequired: offer.researchRequired,
    researchDone: 0,
    goalWins: offer.goalWins,
    winsDone: 0,
    weeksLeft: offer.deadlineWeeks,
    reward: offer.reward,
  };
}

export interface ContractTick {
  contract: ActiveContract;
  fulfilled: boolean;
  forfeited: boolean;
}

/**
 * Advance a held contract by one match week: bank `researchPoints` toward its
 * requirement, credit `winsThisWeek` bouts won, and burn a week of the
 * deadline. Fulfilled once BOTH research and the win goal are met; forfeited if
 * the deadline runs out first. Pure — returns a new contract and the outcome.
 */
export function advanceContract(c: ActiveContract, researchPoints: number, winsThisWeek: number): ContractTick {
  const researchDone = Math.min(c.researchRequired, c.researchDone + researchPoints);
  const winsDone = Math.min(c.goalWins, c.winsDone + winsThisWeek);
  const weeksLeft = c.weeksLeft - 1;
  const contract: ActiveContract = { ...c, researchDone, winsDone, weeksLeft };
  const met = researchDone >= c.researchRequired && winsDone >= c.goalWins;
  if (met) return { contract, fulfilled: true, forfeited: false };
  if (weeksLeft <= 0) return { contract, fulfilled: false, forfeited: true };
  return { contract, fulfilled: false, forfeited: false };
}

/**
 * Add research to a held contract WITHOUT burning a deadline week — the effect
 * of paying to commission a prototype. May fulfil the contract (if the win goal
 * is already met) but never forfeits it. Pure.
 */
export function addContractResearch(c: ActiveContract, points: number): ContractTick {
  const researchDone = Math.min(c.researchRequired, c.researchDone + points);
  const contract: ActiveContract = { ...c, researchDone };
  const met = researchDone >= c.researchRequired && c.winsDone >= c.goalWins;
  return { contract, fulfilled: met, forfeited: false };
}

/** The military bounty (credits) a fulfilled contract pays, scaling with reward. */
export function contractBounty(reward: number): number {
  return 150 * reward;
}
