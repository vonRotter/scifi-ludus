/**
 * The corporations that back the league's stables.
 *
 * Single responsibility: the corporation catalogue and the pure helpers that
 * read it — who a corp's rivals are, and the size of each corp's single perk.
 * A stable inherits its corp's specialty (which biases the contracts it can
 * chase) and its perk (one economic/logistics edge). No React, no state, no
 * randomness. Perk effects are applied by the modules they touch (finance,
 * training, injury, procurement), each reading the small multipliers here.
 */

import { Corporation, CorpPerk, Domain } from './types';

export const CORPORATIONS: Record<string, Corporation> = {
  helion: {
    key: 'helion', name: 'Helion Dynamics', specialty: 'melee', perk: 'procurement',
    blurb: 'Blade-and-servo prime contractor. Runs a deep skunkworks and wins procurement fights on merit.',
    rivals: ['vantor'],
  },
  vantor: {
    key: 'vantor', name: 'Vantor Combine', specialty: 'melee', perk: 'endowment',
    blurb: 'Sprawling old-money conglomerate. Bankrolls its stable lavishly and loathes Helion.',
    rivals: ['helion'],
  },
  volkov: {
    key: 'volkov', name: 'Volkov Ordnance', specialty: 'ranged', perk: 'income',
    blurb: 'Beam-weapons house that lives on broadcast revenue and hates ceding a firing lane to Aegis.',
    rivals: ['aegis'],
  },
  aegis: {
    key: 'aegis', name: 'Aegis Consortium', specialty: 'defence', perk: 'medical',
    blurb: 'Armour and life-support specialists; their fighters heal fast and hold the line against Volkov.',
    rivals: ['volkov'],
  },
  maru: {
    key: 'maru', name: 'Maru Freightways', specialty: 'speed', perk: 'logistics',
    blurb: 'Galactic hauler with reach into every market — talent and intel come cheap. No love for Nyx.',
    rivals: ['nyx'],
  },
  nyx: {
    key: 'nyx', name: 'Nyx Biotic', specialty: 'mental', perk: 'training',
    blurb: 'Neuro-conditioning lab that trains fighters harder and faster, and quietly undercuts Maru.',
    rivals: ['maru'],
  },
};

export const CORP_KEYS = Object.keys(CORPORATIONS);

export function corpByKey(key: string): Corporation {
  const c = CORPORATIONS[key];
  if (!c) throw new Error(`Unknown corporation: ${key}`);
  return c;
}

/** Whether two corporations are direct rivals (symmetric in the catalogue). */
export function areRivals(a: string, b: string): boolean {
  if (a === b) return false;
  return corpByKey(a).rivals.includes(b) || corpByKey(b).rivals.includes(a);
}

/**
 * A stable backed by `bidderCorp` may bid on a contract sponsored by
 * `sponsorCorp` unless the two corps are rivals — a corp never arms its enemy.
 * A corp always may bid on its own contracts.
 */
export function mayBidOn(bidderCorp: string, sponsorCorp: string): boolean {
  return !areRivals(bidderCorp, sponsorCorp);
}

// --- Perk magnitudes (each read by exactly the module that applies it) -------

/** Extra starting credits an `endowment` corp grants its stable. */
export const ENDOWMENT_BONUS = 600;

/** Prize-money multiplier for a corp's stable (income perk lifts it). */
export function incomeMultiplier(perk: CorpPerk): number {
  return perk === 'income' ? 1.2 : 1;
}

/** Signing/scouting cost multiplier (logistics perk discounts it). */
export function tradeMultiplier(perk: CorpPerk): number {
  return perk === 'logistics' ? 0.75 : 1;
}

/** Training-gain multiplier (training perk boosts it). */
export function trainingPerkMultiplier(perk: CorpPerk): number {
  return perk === 'training' ? 1.35 : 1;
}

/** Extra injury-recovery weeks per match week (medical perk speeds it). */
export function medicalPerkBonus(perk: CorpPerk): number {
  return perk === 'medical' ? 1 : 0;
}

/** Contract-research multiplier (procurement perk accelerates fulfilment). */
export function procurementResearchMultiplier(perk: CorpPerk): number {
  return perk === 'procurement' ? 1.5 : 1;
}

/** Bid-strength multiplier in the hybrid auction (procurement perk sharpens bids). */
export function procurementBidMultiplier(perk: CorpPerk): number {
  return perk === 'procurement' ? 1.25 : 1;
}

/** Whether a corp's specialty makes it likelier to sponsor a given domain. */
export function favoursDomain(corp: Corporation, domain: Domain): boolean {
  return corp.specialty === domain;
}

export const PERK_LABEL: Record<CorpPerk, string> = {
  procurement: 'Skunkworks',
  logistics: 'Logistics Network',
  income: 'Broadcast Rights',
  training: 'Neuro-Conditioning',
  medical: 'Med Division',
  endowment: 'Deep Pockets',
};

export const PERK_DESC: Record<CorpPerk, string> = {
  procurement: 'Faster contract research and stronger bids in the procurement auction.',
  logistics: 'Cheaper signings and scouting reports.',
  income: 'Richer prize money from every result.',
  training: 'Fighters improve faster in training.',
  medical: 'Injured fighters recover faster.',
  endowment: 'A larger treasury to start the career.',
};
