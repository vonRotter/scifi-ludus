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

export const FACILITY_KINDS: readonly FacilityKind[] = [
  'training', 'scouting', 'armoury', 'weaponsmith', 'housing', 'stadium',
];

export const MAX_FACILITY_LEVEL = 3;

/** Every team starts with no facilities built. */
export function emptyFacilities(): Facilities {
  return { training: 0, scouting: 0, armoury: 0, weaponsmith: 0, housing: 0, stadium: 0 };
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

/** Flat bonus better housing adds to a fielded fighter's mental sub-stats. */
const HOUSING_BONUS_PER_LEVEL = 1;

/**
 * Better-rested fighters think more clearly: housing lifts the two visible
 * mental sub-stats (awareness, discipline) for the match, leaving the hidden
 * temperament untouched. Same match-time-only loadout pattern as the armoury
 * and weaponsmith — the stored fighter is never changed.
 */
export function applyHousing(fighter: Fighter, level: number): Fighter {
  if (level <= 0) return fighter;
  const bonus = level * HOUSING_BONUS_PER_LEVEL;
  const subStats: SubStats = {
    ...fighter.subStats,
    awareness: fighter.subStats.awareness + bonus,
    discipline: fighter.subStats.discipline + bonus,
  };
  return { ...fighter, subStats };
}

/** Beds a ludus has before any housing is built, and beds added per level. */
const BASE_ROSTER_CAP = 10;
const BEDS_PER_HOUSING_LEVEL = 2;

/**
 * How many fighters a ludus can keep on its books. Housing is the second
 * effect of better quarters: every level adds beds, so a maxed housing block
 * lets the player carry a deeper squad than a bare ludus.
 */
export function rosterCap(housingLevel: number): number {
  return BASE_ROSTER_CAP + housingLevel * BEDS_PER_HOUSING_LEVEL;
}

/** Gate receipts a team banks for playing at home, per stadium level. */
const STADIUM_GATE_PER_LEVEL = 120;

/**
 * Extra credits the home team earns from a fixture played at their stadium.
 * Away teams and unbuilt stadiums earn nothing — this is the one facility that
 * pays for itself rather than spending, rewarding the home half of the season's
 * double round-robin.
 */
export function stadiumGate(level: number): number {
  return level * STADIUM_GATE_PER_LEVEL;
}

/** Flat bonus the weaponsmith adds to a fielded fighter's offensive sub-stats. */
const WEAPONSMITH_BONUS_PER_LEVEL = 1;

/**
 * Equip a fighter with the weaponsmith's bonus for one match: better-made
 * weapons sharpen melee technique and ranged handling. Same match-time-only
 * loadout pattern as `applyArmoury` — the stored fighter is untouched.
 */
export function applyWeaponsmith(fighter: Fighter, level: number): Fighter {
  if (level <= 0) return fighter;
  const bonus = level * WEAPONSMITH_BONUS_PER_LEVEL;
  const subStats: SubStats = {
    ...fighter.subStats,
    technique: fighter.subStats.technique + bonus,
    handling: fighter.subStats.handling + bonus,
  };
  return { ...fighter, subStats };
}
