/**
 * Phase 1 starting content: generate 3 teams of fighters plus a free-agent pool.
 *
 * Single responsibility: deterministic content generation. Body-type archetypes
 * reach comparable effectiveness by different stat routes (brute vs duellist).
 * All randomness flows through an injected rng (seeded) — no Math.random, no
 * React. This is data generation, not game rules.
 */

import { makeRng, deriveSeed } from '../engine/rng';
import { LEAGUE_SIZE, ROSTER_SIZE, STAT_MAX } from '../engine/constants';
import { emptyFacilities } from '../engine/facilities';
import { CORP_KEYS, corpByKey, ENDOWMENT_BONUS } from '../engine/corporations';
import { STARTING_BUDGET, wageFor } from '../engine/finance';
import { weakestCategory } from '../engine/training';
import { BodyType, Fighter, SubStatKey, SubStats, Team } from '../engine/types';
import { rollTraits } from '../engine/traits';
import { makeBeastName, makeFighterName, TEAM_NAMES } from './names';
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
  // Wild creatures: ferocious in melee and tough, hopeless with ranged arms,
  // and wildly variable — the bands are deliberately broad.
  beast: {
    strength: [10, 20], toughness: [10, 20], agility: [6, 18], acceleration: [6, 20],
    reflexes: [6, 18], stamina: [8, 20], technique: [4, 14], manoeuvre: [5, 16],
    eyesight: [1, 5], steadiness: [1, 4], handling: [1, 4],
    awareness: [3, 12], discipline: [2, 10], armourUse: [3, 12],
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
  const fighter: Fighter = {
    id,
    name: makeFighterName(rng),
    bodyType,
    subStats: rollStats(rng, bodyType),
    potential: rng.int(6, 18),
    matchesPlayed: rng.int(0, 3),
    wage: 0,
    scoutLevel: 0,
    injuryWeeks: 0,
    age: rng.int(18, 31),
    traits: rollTraits(rng, bodyType === 'beast'),
    morale: rng.int(52, 72),
    contractSeasons: rng.int(1, 3),
  };
  return { ...fighter, wage: wageFor(fighter) };
}

export interface GeneratedContent {
  teams: Team[];
  fighters: Record<string, Fighter>;
  freeAgents: string[];
  /** Wild creatures, acquirable only once a menagerie unlocks them. */
  beasts: string[];
}

/** How many beasts sit in the menagerie pool, gated by menagerie level. */
const BEAST_POOL_SIZE = 6;

function createBeast(rng: Rng, id: string): Fighter {
  return { ...createFighter(rng, 'beast', id), name: makeBeastName(rng), matchesPlayed: 0, isBeast: true };
}

const PROSPECT_BODY_TYPES: BodyType[] = ['brute', 'duellist', 'marksman', 'sentinel', 'skirmisher'];

/**
 * Generate a fresh crop of young, unproven prospects for the free-agent pool —
 * the off-season youth intake (Phase 4). They're 16–19, fully fogged (no
 * matches, no scouting), and deterministic in `seed`+`season` so a given career
 * always sees the same intake. Ids are namespaced by season to never collide.
 */
export function generateProspects(
  seed: number,
  season: number,
  count: number,
  potentialBoost = 0,
): Fighter[] {
  const rng = makeRng(deriveSeed(seed, 0x4040 + season));
  const out: Fighter[] = [];
  for (let i = 0; i < count; i++) {
    const bodyType = PROSPECT_BODY_TYPES[i % PROSPECT_BODY_TYPES.length];
    const base = createFighter(rng, bodyType, `yp-${season}-${i}`);
    const potential = Math.min(STAT_MAX, base.potential + potentialBoost);
    out.push({ ...base, potential, matchesPlayed: 0, scoutLevel: 0, age: rng.int(16, 19) });
  }
  return out;
}

/**
 * Generate the full league: LEAGUE_SIZE teams, each with ROSTER_SIZE
 * fighters, plus a small free-agent pool. Deterministic in `seed`. Which team
 * is the player's is decided later (see `playerIndex` callers) — generation
 * itself doesn't favour any slot.
 */
export function generateContent(seed: number, playerIndex = 0): GeneratedContent {
  const fighters: Record<string, Fighter> = {};
  const teams: Team[] = [];

  // Assign a distinct corporation to each stable (deterministic shuffle), so the
  // league's rivalries and perks are meaningful.
  const corpRng = makeRng(deriveSeed(seed, 0xc0));
  const corpPool = [...CORP_KEYS];
  for (let i = corpPool.length - 1; i > 0; i--) {
    const j = corpRng.int(0, i);
    [corpPool[i], corpPool[j]] = [corpPool[j], corpPool[i]];
  }

  for (let t = 0; t < LEAGUE_SIZE; t++) {
    const teamRng = makeRng(deriveSeed(seed, t + 1));
    const fighterIds: string[] = [];
    for (let i = 0; i < ROSTER_SIZE; i++) {
      const bodyType = TEAM_TEMPLATE[i % TEAM_TEMPLATE.length];
      const id = `t${t}-f${i}`;
      fighters[id] = createFighter(teamRng, bodyType, id);
      fighterIds.push(id);
    }
    const corpKey = corpPool[t % corpPool.length];
    const endowed = corpByKey(corpKey).perk === 'endowment' ? ENDOWMENT_BONUS : 0;
    teams.push({
      id: `team-${t}`,
      name: TEAM_NAMES[t],
      isPlayer: t === playerIndex,
      fighterIds,
      budget: STARTING_BUDGET + endowed,
      trainingFocus: weakestCategory(fighterIds.map((id) => fighters[id])),
      facilities: emptyFacilities(),
      reputation: 0,
      corpKey,
      labLevel: 0,
      contract: null,
      specializations: {},
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

  // The menagerie's wild creatures, gated behind that facility's level.
  const beastRng = makeRng(deriveSeed(seed, 0xbea5));
  const beasts: string[] = [];
  for (let i = 0; i < BEAST_POOL_SIZE; i++) {
    const id = `beast-${i}`;
    fighters[id] = createBeast(beastRng, id);
    beasts.push(id);
  }

  return { teams, fighters, freeAgents, beasts };
}
