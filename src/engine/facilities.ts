/**
 * Ludus facilities: Phase 3's budget sink. Upgrading a facility makes an
 * existing system (training, scouting, combat) a little better — there is no
 * new mechanic here, just a multiplier the rest of the engine reads.
 *
 * Single responsibility: facility levels, their upgrade cost curve, and the
 * pure effect each level grants. No React, no state ownership, no
 * Math.random — the state layer holds the levels and the budget.
 */

import { Facilities, FacilityKind, Fighter, SubStats } from './types';

export const FACILITY_KINDS: readonly FacilityKind[] = ['training', 'scouting', 'armoury'];

export const MAX_FACILITY_LEVEL = 3;

/** Every team starts with no facilities built. */
export function emptyFacilities(): Facilities {
  return { training: 0, scouting: 0, armoury: 0 };
}

export function canUpgrade(facilities: Facilities, kind: FacilityKind): boolean {
  return facilities[kind] < MAX_FACILITY_LEVEL;
}

/** Credits to build the next level of a facility (steeper each level). */
export function facilityUpgradeCost(facilities: Facilities, kind: FacilityKind): number {
  const level = facilities[kind];
  return 500 + level * 700;
}

/** Bump one facility's level by one, leaving the others untouched. */
export function upgradeFacility(facilities: Facilities, kind: FacilityKind): Facilities {
  if (!canUpgrade(facilities, kind)) return facilities;
  return { ...facilities, [kind]: facilities[kind] + 1 };
}

/** Extra chance-to-gain added to every trained sub-stat roll, per training level. */
export function trainingBonus(level: number): number {
  return level * 0.08;
}

/** Scouting network discount applied to a report's credit cost. */
export function applyScoutingDiscount(cost: number, level: number): number {
  return Math.round(cost * (1 - level * 0.15));
}

/** Flat bonus the armoury adds to a fielded fighter's defensive sub-stats. */
const ARMOURY_BONUS_PER_LEVEL = 1;

/**
 * Equip a fighter with the armoury's bonus for one match. Returns a new
 * Fighter with boosted defensive sub-stats; the original record (and its
 * fog/training progress) is untouched — this is a match-time loadout, not a
 * permanent change.
 */
export function applyArmoury(fighter: Fighter, level: number): Fighter {
  if (level <= 0) return fighter;
  const bonus = level * ARMOURY_BONUS_PER_LEVEL;
  const subStats: SubStats = {
    ...fighter.subStats,
    toughness: fighter.subStats.toughness + bonus,
    armourUse: fighter.subStats.armourUse + bonus,
  };
  return { ...fighter, subStats };
}
