/**
 * Phase 1 starting content: generate 3 teams of fighters plus a free-agent pool.
 *
 * Single responsibility: deterministic content generation. Body-type archetypes
 * reach comparable effectiveness by different stat routes (brute vs duellist).
 * All randomness flows through an injected rng (seeded) — no Math.random, no
 * React. This is data generation, not game rules.
 */

import { makeRng, deriveSeed } from '../engine/rng';
import { ROSTER_SIZE } from '../engine/constants';
import { BodyType, Fighter, SubStatKey, SubStats, Team } from '../engine/types';
import { makeFighterName, TEAM_NAMES } from './names';
import { Rng } from '../engine/rng';

type Band = [number, number];
type Profile = Partial<Record<SubStatKey, Band>>;

const DEFAULT_BAND: Band = [6, 12];

/** Per-archetype sub-stat bands. Unlisted stats use DEFAULT_BAND. */
const PROFILES: Record<BodyType, Profile> = {
  brute: {
    strength: [15, 20], toughness: [14, 19], armourUse: [11, 16], stamina: [10, 15],
    technique: [6, 11], agility: [3, 8], acceleration: [4, 9], manoeuvre: [4, 9],
    eyesight: [3, 8], steadiness: [3, 8], handling: [3, 8],
  },
  duellist: {
    technique: [14, 19], agility: [14, 19], reflexes: [13, 18], manoeuvre: [12, 17],
    acceleration: [11, 16], strength: [8, 13], toughness: [8, 13], awareness: [10, 15],
    eyesight: [4, 9], steadiness: [4, 9], handling: [4, 9],
  },
  marksman: {
    eyesight: [15, 20], steadiness: [14, 19], handling: [13, 18], awareness: [12, 17],
    agility: [8, 13], technique: [6, 11], strength: [5, 10], toughness: [6, 11],
    acceleration: [8, 13], manoeuvre: [9, 14],
  },
  sentinel: {
    toughness: [16, 20], armourUse: [15, 20], discipline: [13, 18], strength: [11, 16],
    reflexes: [10, 15], technique: [9, 14], agility: [5, 10], acceleration: [4, 9],
    stamina: [11, 16], eyesight: [4, 9], steadiness: [5, 10], handling: [5, 10],
  },
  skirmisher: {
    acceleration: [15, 20], manoeuvre: [14, 19], stamina: [14, 19], agility: [13, 18],
    awareness: [12, 17], technique: [10, 15], strength: [8, 13], reflexes: [11, 16],
    eyesight: [9, 14], steadiness: [8, 13], handling: [8, 13],
  },
};

const ALL_KEYS: SubStatKey[] = [
  'strength', 'technique', 'agility', 'eyesight', 'steadiness', 'handling',
  'toughness', 'reflexes', 'armourUse', 'temperament', 'awareness', 'discipline',
  'acceleration', 'stamina', 'manoeuvre',
];

/** Roster body-type template per team: field six, bench three. */
const TEAM_TEMPLATE: BodyType[] = [
  'brute', 'brute', 'duellist', 'duellist', 'marksman',
  'marksman', 'sentinel', 'skirmisher', 'skirmisher',
];

function rollStats(rng: Rng, bodyType: BodyType): SubStats {
  const profile = PROFILES[bodyType];
  const out = {} as SubStats;
  for (const key of ALL_KEYS) {
    const [lo, hi] = profile[key] ?? DEFAULT_BAND;
    out[key] = rng.int(lo, hi);
  }
  return out;
}

function createFighter(rng: Rng, bodyType: BodyType, id: string): Fighter {
  return {
    id,
    name: makeFighterName(rng),
    bodyType,
    subStats: rollStats(rng, bodyType),
    potential: rng.int(6, 18),
    matchesPlayed: rng.int(0, 3),
  };
}

export interface GeneratedContent {
  teams: Team[];
  fighters: Record<string, Fighter>;
  freeAgents: string[];
}

/**
 * Generate the full Phase 1 league: 3 teams (first is the player's), each with
 * ROSTER_SIZE fighters, plus a small free-agent pool. Deterministic in `seed`.
 */
export function generateContent(seed: number): GeneratedContent {
  const fighters: Record<string, Fighter> = {};
  const teams: Team[] = [];

  for (let t = 0; t < 3; t++) {
    const teamRng = makeRng(deriveSeed(seed, t + 1));
    const fighterIds: string[] = [];
    for (let i = 0; i < ROSTER_SIZE; i++) {
      const bodyType = TEAM_TEMPLATE[i % TEAM_TEMPLATE.length];
      const id = `t${t}-f${i}`;
      fighters[id] = createFighter(teamRng, bodyType, id);
      fighterIds.push(id);
    }
    teams.push({
      id: `team-${t}`,
      name: TEAM_NAMES[t],
      isPlayer: t === 0,
      fighterIds,
    });
  }

  // Free agents for the minimal recruitment loop.
  const faRng = makeRng(deriveSeed(seed, 99));
  const bodyTypes: BodyType[] = ['brute', 'duellist', 'marksman', 'sentinel', 'skirmisher'];
  const freeAgents: string[] = [];
  for (let i = 0; i < 5; i++) {
    const id = `fa-${i}`;
    fighters[id] = createFighter(faRng, bodyTypes[i % bodyTypes.length], id);
    freeAgents.push(id);
  }

  return { teams, fighters, freeAgents };
}
