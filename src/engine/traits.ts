/**
 * Character traits: innate quirks that make each fighter more than a stat block.
 *
 * Single responsibility: the trait catalogue and the pure effects each trait
 * grants — match-time stat shifts, injury-proneness, and training aptitude.
 * Effects are side-neutral (they never depend on home/away), so they can't
 * disturb the engine's fairness invariant. No React, no state ownership; all
 * randomness (assignment) flows through an injected Rng.
 */

import { Rng } from './rng';
import { Fighter, SubStatKey, TraitKey } from './types';

interface TraitDef {
  key: TraitKey;
  label: string;
  desc: string;
  /** Match-time sub-stat deltas, applied like a loadout (the stored fighter is untouched). */
  substat: Partial<Record<SubStatKey, number>>;
  /** Multiplier on this fighter's chance to pick up an injury (1 = neutral). */
  injuryMult: number;
  /** Multiplier on this fighter's per-week training gains (1 = neutral). */
  trainingMult: number;
}

/** The catalogue. Each trait leans a fighter toward a fantasy without dominating. */
export const TRAITS: Record<TraitKey, TraitDef> = {
  berserker: {
    key: 'berserker', label: 'Berserker',
    desc: 'Hits harder in melee but leaves themselves open — deadlier and more fragile.',
    substat: { strength: 2, technique: 1, toughness: -2, armourUse: -1 },
    injuryMult: 1.15, trainingMult: 1,
  },
  stalwart: {
    key: 'stalwart', label: 'Stalwart',
    desc: 'An immovable wall — soaks punishment at the cost of quickness.',
    substat: { toughness: 2, armourUse: 2, acceleration: -2 },
    injuryMult: 1, trainingMult: 1,
  },
  deadeye: {
    key: 'deadeye', label: 'Deadeye',
    desc: 'Uncanny aim with ranged weapons.',
    substat: { eyesight: 2, steadiness: 2, handling: 1 },
    injuryMult: 1, trainingMult: 1,
  },
  fleet: {
    key: 'fleet', label: 'Fleet',
    desc: 'Lightning-quick across the sand.',
    substat: { acceleration: 2, manoeuvre: 2 },
    injuryMult: 1, trainingMult: 1,
  },
  composed: {
    key: 'composed', label: 'Composed',
    desc: 'Ice-cold under pressure — sharper judgement in the thick of it.',
    substat: { awareness: 2, discipline: 2 },
    injuryMult: 1, trainingMult: 1,
  },
  fragile: {
    key: 'fragile', label: 'Fragile',
    desc: 'Gets hurt easily — a worrying injury record.',
    substat: {},
    injuryMult: 1.5, trainingMult: 1,
  },
  ironhide: {
    key: 'ironhide', label: 'Iron-hide',
    desc: 'Shrugs off wounds that would sideline others.',
    substat: {},
    injuryMult: 0.55, trainingMult: 1,
  },
  prodigy: {
    key: 'prodigy', label: 'Prodigy',
    desc: 'A natural — improves faster in training than their peers.',
    substat: {},
    injuryMult: 1, trainingMult: 1.6,
  },
};

export const TRAIT_KEYS = Object.keys(TRAITS) as TraitKey[];

/** Traits that suit wild creatures — beasts only ever roll from these. */
const BEAST_TRAITS: TraitKey[] = ['berserker', 'ironhide', 'fleet', 'fragile'];

/** A fighter's traits, tolerating the field being absent (old saves / test stubs). */
export function traitsOf(fighter: Fighter): TraitKey[] {
  return fighter.traits ?? [];
}

/**
 * Roll a fighter's innate traits: usually none or one, occasionally two, never
 * a contradictory pair. Deterministic in `rng`. Beasts draw from a wilder pool.
 */
export function rollTraits(rng: Rng, isBeast = false): TraitKey[] {
  const roll = rng.next();
  const count = roll < 0.4 ? 0 : roll < 0.85 ? 1 : 2;
  if (count === 0) return [];

  const pool = isBeast ? [...BEAST_TRAITS] : [...TRAIT_KEYS];
  const picked: TraitKey[] = [];
  while (picked.length < count && pool.length > 0) {
    const t = rng.pick(pool);
    // Drop the chosen trait and any that would contradict it, so we never get
    // e.g. Fragile + Iron-hide on the same fighter.
    const opposites = OPPOSITES[t] ?? [];
    for (let i = pool.length - 1; i >= 0; i--) {
      if (pool[i] === t || opposites.includes(pool[i])) pool.splice(i, 1);
    }
    picked.push(t);
  }
  return picked;
}

const OPPOSITES: Partial<Record<TraitKey, TraitKey[]>> = {
  fragile: ['ironhide'],
  ironhide: ['fragile'],
  berserker: ['stalwart'],
  stalwart: ['berserker'],
};

/**
 * Apply a fighter's trait stat shifts for one match. Returns a new Fighter with
 * adjusted sub-stats; the stored record is never changed (match-time loadout,
 * exactly like the armoury/weaponsmith bonuses).
 */
export function applyTraits(fighter: Fighter): Fighter {
  const keys = traitsOf(fighter);
  if (keys.length === 0) return fighter;
  const subStats = { ...fighter.subStats };
  for (const key of keys) {
    for (const [stat, delta] of Object.entries(TRAITS[key].substat)) {
      const s = stat as SubStatKey;
      subStats[s] = subStats[s] + (delta as number);
    }
  }
  return { ...fighter, subStats };
}

/** Combined injury-chance multiplier from all of a fighter's traits. */
export function traitInjuryMult(fighter: Fighter): number {
  return traitsOf(fighter).reduce((m, k) => m * TRAITS[k].injuryMult, 1);
}

/** Combined training-gain multiplier from all of a fighter's traits. */
export function traitTrainingMult(fighter: Fighter): number {
  return traitsOf(fighter).reduce((m, k) => m * TRAITS[k].trainingMult, 1);
}

/** Appearances (or scouting) at which a fighter's traits come to light. */
const TRAIT_REVEAL_APPS = 4;
const TRAIT_REVEAL_SCOUT = 2;

/** Whether the player has seen enough of a fighter to know their traits. */
export function traitsRevealed(fighter: Fighter): boolean {
  return fighter.matchesPlayed >= TRAIT_REVEAL_APPS || fighter.scoutLevel >= TRAIT_REVEAL_SCOUT;
}

/** The traits the player currently knows about — empty until revealed. */
export function knownTraits(fighter: Fighter): TraitKey[] {
  return traitsRevealed(fighter) ? traitsOf(fighter) : [];
}
