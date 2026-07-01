/**
 * Shared domain types for the whole game.
 *
 * Single responsibility: define the data shapes that the engine, state, and
 * UI all agree on. MUST NOT contain logic, React, or browser APIs — types only.
 */

// ---------------------------------------------------------------------------
// Attributes: five categories, three sub-stats each = fifteen sub-stats.
// ---------------------------------------------------------------------------

export type Category = 'melee' | 'ranged' | 'defence' | 'mental' | 'speed';

export const CATEGORIES: readonly Category[] = [
  'melee',
  'ranged',
  'defence',
  'mental',
  'speed',
];

export type SubStatKey =
  // Melee
  | 'strength'
  | 'technique'
  | 'agility'
  // Ranged
  | 'eyesight'
  | 'steadiness'
  | 'handling'
  // Defence
  | 'toughness'
  | 'reflexes'
  | 'armourUse'
  // Mental
  | 'temperament'
  | 'awareness'
  | 'discipline'
  // Speed
  | 'acceleration'
  | 'stamina'
  | 'manoeuvre';

/** Which three sub-stats compose each category. */
export const CATEGORY_SUBSTATS: Record<Category, [SubStatKey, SubStatKey, SubStatKey]> = {
  melee: ['strength', 'technique', 'agility'],
  ranged: ['eyesight', 'steadiness', 'handling'],
  defence: ['toughness', 'reflexes', 'armourUse'],
  mental: ['temperament', 'awareness', 'discipline'],
  speed: ['acceleration', 'stamina', 'manoeuvre'],
};

export type SubStats = Record<SubStatKey, number>;

/** Derived effective score (0..20-ish) for each category. */
export type CategoryScores = Record<Category, number>;

// ---------------------------------------------------------------------------
// Fighters and teams
// ---------------------------------------------------------------------------

export type BodyType = 'brute' | 'duellist' | 'marksman' | 'sentinel' | 'skirmisher' | 'beast';

export interface Fighter {
  id: string;
  name: string;
  bodyType: BodyType;
  subStats: SubStats;
  /** Hidden growth ceiling (Phase 2). Never shown as an exact number. */
  potential: number;
  /** Bouts contested. Drives fog reveal — more matches, tighter estimates. */
  matchesPlayed: number;
  /** Per-fixture wage, deducted from the team's budget each match week. */
  wage: number;
  /** Times this prospect has been scouted; narrows fog before signing. */
  scoutLevel: number;
  /** Match weeks until recovered from injury; 0 means fit to field. */
  injuryWeeks: number;
  /** Years old. Ages a year each season; drives decline and retirement (Phase 4). */
  age: number;
  /** Innate character traits that bend stats, injury odds, and growth. Fogged until revealed. */
  traits?: TraitKey[];
  /** A beast (menagerie creature) rather than a human fighter. Cosmetic + gated acquisition. */
  isBeast?: boolean;
}

/** Named character traits a fighter can carry (see engine/traits.ts for effects). */
export type TraitKey =
  | 'berserker' | 'stalwart' | 'deadeye' | 'fleet' | 'composed'
  | 'fragile' | 'ironhide' | 'prodigy';

/** Ludus facilities the player can upgrade (Phase 3 budget sink). */
export type FacilityKind =
  | 'training' | 'scouting' | 'armoury' | 'weaponsmith' | 'housing' | 'stadium' | 'medbay'
  | 'menagerie';
export type Facilities = Record<FacilityKind, number>;

export interface Team {
  id: string;
  name: string;
  isPlayer: boolean;
  fighterIds: string[];
  /** Credits on hand; spent on wages, earned via prize money. */
  budget: number;
  /** Category the roster trains each week (Phase 2 growth). */
  trainingFocus: Category;
  /** Ludus facility levels (Phase 3 budget sink). */
  facilities: Facilities;
  /** Standing built up across seasons (Phase 4); drives the ludus's prestige tier. */
  reputation: number;
}

// ---------------------------------------------------------------------------
// Tactics
// ---------------------------------------------------------------------------

export type Posture = 'aggressive' | 'balanced' | 'defensive';
export type Focus = 'melee' | 'ranged' | 'objective';
export type Role = 'frontline' | 'skirmisher' | 'holdback';

export interface Tactics {
  posture: Posture;
  focus: Focus;
  /** Role per fielded fighter id. */
  roles: Record<string, Role>;
}

/** A team's committed selection for a match: six fighters and their tactics. */
export interface Lineup {
  teamId: string;
  fighterIds: string[]; // exactly SQUAD_SIZE
  tactics: Tactics;
}

// ---------------------------------------------------------------------------
// Arena / terrain
// ---------------------------------------------------------------------------

export interface Obstacle {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Arena {
  id: string;
  name: string;
  width: number;
  height: number;
  obstacles: Obstacle[];
  /** Central objective zone; controlling it scores over time. */
  objective: { x: number; y: number; r: number };
}

// ---------------------------------------------------------------------------
// Match simulation output
// ---------------------------------------------------------------------------

export type Side = 'home' | 'away';

/** What a fighter is visibly doing at one rendered tick, for the renderer. */
export type FighterAction = 'melee' | 'ranged' | 'guarding' | 'chasing' | 'idle';

/** One fighter's state at one rendered tick. The renderer only reads this. */
export interface FighterFrame {
  id: string;
  side: Side;
  x: number;
  y: number;
  hp: number; // 0..1 fraction
  alive: boolean;
  /** Radians, for which way to point the fighter on screen. */
  facing: number;
  /** What the fighter is doing right now, for the dot renderer to convey it. */
  action: FighterAction;
}

/** A single rendered tick of a round. */
export interface Frame {
  t: number; // tick index
  fighters: FighterFrame[];
  homeScore: number;
  awayScore: number;
}

export interface RoundResult {
  homeScore: number;
  awayScore: number;
  frames: Frame[];
}

export interface MatchResult {
  homeScore: number;
  awayScore: number;
  winner: Side | 'draw';
  rounds: [RoundResult, RoundResult];
}

/** Everything the engine needs to resolve one side of a bout. */
export interface SquadInput {
  side: Side;
  fighters: Fighter[]; // exactly SQUAD_SIZE
  tactics: Tactics;
}

// ---------------------------------------------------------------------------
// Season
// ---------------------------------------------------------------------------

export interface Fixture {
  id: string;
  week: number;
  homeTeamId: string;
  awayTeamId: string;
  arenaId: string;
  /** Per-match seed, fixed when the fixture is created. */
  seed: number;
  played: boolean;
  homeScore?: number;
  awayScore?: number;
}

export interface TableRow {
  teamId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  pointsFor: number;
  pointsAgainst: number;
  points: number;
}
