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
  /** Career wins — bouts the fighter's team won while they were fielded. */
  wins?: number;
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
  /** Morale 0..100 — moved by results, playing time, and injuries (Tier 2). */
  morale?: number;
  /** Seasons left on the fighter's deal; runs out and they walk to free agency. */
  contractSeasons?: number;
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

// ---------------------------------------------------------------------------
// Corporations, procurement contracts & specialization.
//
// Every stable is backed by a corporation. Corporations sponsor military
// procurement contracts: stables BID to win one (rivalries bar some bidders),
// then fulfil it by spending research + training time and hitting in-match
// goals. Fulfilment grants a permanent SPECIALIZATION level in a combat domain,
// applied CONDITIONALLY in the engine — a melee specialization only sharpens
// melee attacks, so a stable that pours contracts into one domain becomes
// lopsidedly, brilliantly good at exactly that. This is the whole R&D layer;
// there are no flat, always-on stat projects.
// ---------------------------------------------------------------------------

/** Combat domains a stable can specialize in via contracts. */
export type Domain = 'melee' | 'ranged' | 'defence' | 'speed' | 'mental';
export const DOMAINS: readonly Domain[] = ['melee', 'ranged', 'defence', 'speed', 'mental'];

/** Permanent specialization levels per domain — applied conditionally in combat. */
export type SpecLevels = Partial<Record<Domain, number>>;

/** A corporation's single mechanical advantage (one code hook each). */
export type CorpPerk = 'procurement' | 'logistics' | 'income' | 'training' | 'medical' | 'endowment';

export interface Corporation {
  key: string;
  name: string;
  blurb: string;
  /** The domain this corp has tech access to — biases the contracts it sponsors. */
  specialty: Domain;
  perk: CorpPerk;
  /** Corps it will never let a rival's stable bid on its contracts. */
  rivals: string[];
}

/** A procurement contract on the open market, up for bidding. */
export interface ContractOffer {
  id: string;
  sponsorCorp: string;
  domain: Domain;
  name: string;
  /** Research points that must be spent to fulfil it. */
  researchRequired: number;
  /** Bouts the holder must win while the contract is active. */
  goalWins: number;
  /** Weeks allowed to fulfil it once held. */
  deadlineWeeks: number;
  /** Base acquisition cost / minimum bid. */
  acquisitionCost: number;
  /** Specialization levels granted in `domain` on fulfilment. */
  reward: number;
}

/** A contract a stable holds and is working to fulfil. */
export interface ActiveContract {
  id: string;
  sponsorCorp: string;
  domain: Domain;
  name: string;
  researchRequired: number;
  researchDone: number;
  goalWins: number;
  winsDone: number;
  weeksLeft: number;
  reward: number;
}

/**
 * A rival stable's manager personality — sampled once at team creation and
 * threaded (as biases) through every AI decision, so each rival plays like a
 * character rather than sharing one brain. Each field is 0..1. A neutral 0.5
 * across the board reproduces the old personality-free behaviour exactly.
 */
export interface AiPersonality {
  /** Posture priors and how early it presses / how late it sits on a lead. */
  aggression: number;
  /** Cash hoarded before investing (scales the AI reserve). */
  patience: number;
  /** How hard it counter-picks the opponent vs playing its own game. */
  scheming: number;
  /** Signs prospects (young) vs proven veterans. */
  youthBias: number;
}

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
  /** The corporation backing this stable (CorpKey). */
  corpKey: string;
  /** R&D Lab level 0..MAX_LAB_LEVEL — research capacity toward the active contract. */
  labLevel: number;
  /** The procurement contract currently being fulfilled, if any. */
  contract?: ActiveContract | null;
  /** Permanent specialization levels earned from fulfilled contracts. */
  specializations: SpecLevels;
  /** Relationship with each corporation (CorpKey -> standing). Optional so
   *  early v22 saves still load; defaults to neutral via teamStanding(). */
  corpStanding?: Record<string, number>;
  /** The lanista (manager) running this stable — flavour + news attribution.
   *  Optional so older saves load; the player's team has none. */
  lanista?: string;
  /** AI manager personality (rivals only). Optional; absent = neutral behaviour. */
  personality?: AiPersonality;
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

/**
 * A circular environmental hazard on the field.
 * - `plasma`: an ion vent that burns anyone standing in it — `intensity` HP per tick.
 * - `gravwell`: a gravity shear that drags on movement — `intensity` is the speed
 *   multiplier inside it (0..1; e.g. 0.5 = half speed).
 * Hazards must always be placed as left-right mirror pairs (see data/arenas.ts)
 * so neither side of the field is structurally advantaged — the engine's
 * fairness invariant depends on it.
 */
export type HazardKind = 'plasma' | 'gravwell';

export interface Hazard {
  x: number;
  y: number;
  r: number;
  kind: HazardKind;
  intensity: number;
}

export interface Arena {
  id: string;
  name: string;
  width: number;
  height: number;
  obstacles: Obstacle[];
  /** Central objective zone; controlling it scores over time. */
  objective: { x: number; y: number; r: number };
  /** Environmental hazards (optional; absent on older/plain arenas). */
  hazards?: Hazard[];
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
  /** Fatigue 0..1 — the renderer dims a tiring fighter. */
  energy: number;
  /** True while the fighter's nerve is broken — the renderer flags the wobble. */
  shaken: boolean;
}

/** A single rendered tick of a round. */
export interface Frame {
  t: number; // tick index
  fighters: FighterFrame[];
  homeScore: number;
  awayScore: number;
}

/** What ended a fighter: a melee blow, a ranged shot, or an arena hazard. */
export type DownCause = 'melee' | 'ranged' | 'hazard';

/**
 * A coarse, outcome-level thing that happened in a round, timestamped by tick.
 * Deliberately not per-attack — this is FM-style commentary granularity, the
 * stuff a live ticker or a match report narrates. Pure engine data-out.
 */
export type MatchEvent =
  | { t: number; kind: 'down'; victim: string; credit: string | null; cause: DownCause }
  | { t: number; kind: 'first-blood'; side: Side }
  | { t: number; kind: 'objective-flip'; side: Side }
  | { t: number; kind: 'shaken'; fighter: string };

/**
 * One fighter's accumulated tally over a round (or, merged, a whole match).
 * Every field is counted from facts the tick loop already computes, so it costs
 * nothing extra and stays deterministic.
 */
export interface FighterStat {
  side: Side;
  damageDealt: number;
  damageTaken: number;
  downsScored: number;
  timesDowned: number;
  hitsLanded: number;
  attempts: number;
  /** Ticks spent alive inside the objective zone. */
  zoneTicks: number;
  /** Damage taken specifically from arena hazards. */
  hazardDamage: number;
  /** Ticks spent shaken (nerve broken) — the seed of a composure read. */
  shakenTicks: number;
}

/** Per-fighter tallies for a round or match, keyed by fighter id. */
export type MatchStats = Record<string, FighterStat>;

export interface RoundResult {
  homeScore: number;
  awayScore: number;
  frames: Frame[];
  /** Coarse, timestamped commentary events for this round. */
  events: MatchEvent[];
  /** Per-fighter tallies accumulated over this round. */
  stats: MatchStats;
}

export interface MatchResult {
  homeScore: number;
  awayScore: number;
  winner: Side | 'draw';
  rounds: [RoundResult, RoundResult];
  /** Per-fighter tallies summed across both rounds. */
  stats: MatchStats;
  /** 0–10 performance rating per fielded fighter, derived from `stats`. */
  ratings: Record<string, number>;
}

/** Everything the engine needs to resolve one side of a bout. */
export interface SquadInput {
  side: Side;
  fighters: Fighter[]; // exactly SQUAD_SIZE
  tactics: Tactics;
  /** The stable's earned specialization levels, applied conditionally in combat. */
  spec?: SpecLevels;
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
