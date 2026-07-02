/**
 * Research & Development: the stable-wide programme that refines the weaponry
 * and armour its fighters already carry — a better edge geometry, a tuned laser
 * frequency, a reactive plating weave. Completed projects grant permanent,
 * team-wide sub-stat bonuses applied at match time (the same loadout pattern as
 * the armoury/weaponsmith/traits — the stored fighter is never mutated), so
 * they're fog-safe and side-neutral, and can't disturb the fairness invariant.
 *
 * Single responsibility: the project catalogue, the pure cost/rate maths, the
 * bonus each completed set grants, and the weekly accrual. No React, no state
 * ownership, no Math.random — the state layer holds each team's TeamResearch and
 * calls these.
 */

import { Category, Fighter, ResearchKey, SubStatKey, SubStats, TeamResearch } from './types';

interface ResearchDef {
  key: ResearchKey;
  name: string;
  /** Which combat area it refines, for grouping/labelling. */
  category: Category;
  desc: string;
  /** Research points needed to complete it. */
  cost: number;
  /** Permanent match-time sub-stat bonuses once completed. */
  substat: Partial<Record<SubStatKey, number>>;
}

/**
 * The catalogue. Two projects per combat area, each a small, believable
 * refinement to existing kit. Bonuses are deliberately modest (+1 to a couple
 * of sub-stats) — the programme is a long, multi-season progression, not a
 * shortcut, and rival stables research too.
 */
export const RESEARCH_PROJECTS: Record<ResearchKey, ResearchDef> = {
  edges: {
    key: 'edges', name: 'Monomolecular Edges', category: 'melee',
    desc: 'Reground blade geometry that bites deeper for the same swing.',
    cost: 3, substat: { strength: 1, technique: 1 },
  },
  grips: {
    key: 'grips', name: 'Servo-Assisted Grips', category: 'melee',
    desc: 'Powered grips that quicken and steady every close-quarters strike.',
    cost: 4, substat: { technique: 1, agility: 1 },
  },
  optics: {
    key: 'optics', name: 'Laser Frequency Tuning', category: 'ranged',
    desc: 'A retuned emitter frequency that lands tighter on target.',
    cost: 3, substat: { eyesight: 1, steadiness: 1 },
  },
  recoil: {
    key: 'recoil', name: 'Recoil Compensators', category: 'ranged',
    desc: 'Damped actions that reset the aim and reload faster.',
    cost: 4, substat: { handling: 1, steadiness: 1 },
  },
  plating: {
    key: 'plating', name: 'Reactive Plating', category: 'defence',
    desc: 'Plating that stiffens on impact, shrugging off more of each hit.',
    cost: 3, substat: { armourUse: 1, toughness: 1 },
  },
  weave: {
    key: 'weave', name: 'Ablative Weave', category: 'defence',
    desc: 'An under-suit weave that spreads a blow and speeds the flinch back.',
    cost: 4, substat: { toughness: 1, reflexes: 1 },
  },
  actuators: {
    key: 'actuators', name: 'Servo Actuators', category: 'speed',
    desc: 'Leg actuators that add a step of acceleration and agility on the turn.',
    cost: 4, substat: { acceleration: 1, manoeuvre: 1 },
  },
  hud: {
    key: 'hud', name: 'Tactical HUD', category: 'mental',
    desc: 'A heads-up overlay that sharpens read of the field and holds discipline.',
    cost: 4, substat: { awareness: 1, discipline: 1 },
  },
};

export const RESEARCH_KEYS = Object.keys(RESEARCH_PROJECTS) as ResearchKey[];

export const MAX_LAB_LEVEL = 3;

/** A fresh, empty research programme (no lab, nothing researched). */
export function emptyResearch(): TeamResearch {
  return { labLevel: 0, active: null, progress: 0, completed: [] };
}

/** Research points banked per match week, from the R&D Lab level (0 = none). */
export function researchRate(labLevel: number): number {
  return labLevel; // 1 point/week per level; a level-3 lab is 3x a level-1.
}

/** Credits to build the next R&D Lab level (steeper each level). */
export function labUpgradeCost(labLevel: number): number {
  return 600 + labLevel * 800;
}

export function canUpgradeLab(labLevel: number): boolean {
  return labLevel < MAX_LAB_LEVEL;
}

/** Credits to instantly commission a prototype: one research point of progress. */
export const FUND_COST = 250;
export const FUND_STEP = 1;

/**
 * A military backer's bounty for each breakthrough delivered — these stables
 * double as weapons test-beds, so a completed project pays out in credits and a
 * little standing. Applied by the state layer when the PLAYER completes one.
 */
export const BREAKTHROUGH_BOUNTY = 150;
export const BREAKTHROUGH_REP = 5;

/** Projects not yet completed, in catalogue order — the pickable list. */
export function availableProjects(research: TeamResearch): ResearchDef[] {
  return RESEARCH_KEYS.filter((k) => !research.completed.includes(k)).map((k) => RESEARCH_PROJECTS[k]);
}

/** The next project an AI stable will pursue: the first uncompleted, in order. */
export function nextProject(research: TeamResearch): ResearchKey | null {
  return RESEARCH_KEYS.find((k) => !research.completed.includes(k)) ?? null;
}

export interface ResearchTick {
  research: TeamResearch;
  /** Projects that completed on this tick (usually 0 or 1), for bounties/news. */
  completedNow: ResearchKey[];
}

/**
 * Advance a research programme by `points`, completing the active project (and
 * rolling any overflow into the next selected one) as thresholds are crossed.
 * Pure: returns a new TeamResearch and the list of keys completed this tick.
 * `pickNext` chooses the follow-on project once the active one finishes — the AI
 * auto-advances the catalogue; the player leaves it to null and re-picks by hand.
 */
export function advanceResearch(
  research: TeamResearch,
  points: number,
  pickNext: (r: TeamResearch) => ResearchKey | null = () => null,
): ResearchTick {
  let { active, progress, completed } = research;
  const { labLevel } = research;
  const completedNow: ResearchKey[] = [];
  let budget = points;

  while (active && budget > 0) {
    const need = RESEARCH_PROJECTS[active].cost - progress;
    if (budget < need) {
      progress += budget;
      budget = 0;
      break;
    }
    // Complete the active project; carry the remainder into the next choice.
    budget -= need;
    completed = [...completed, active];
    completedNow.push(active);
    progress = 0;
    active = pickNext({ labLevel, active: null, progress: 0, completed });
  }

  return { research: { labLevel, active, progress, completed }, completedNow };
}

/**
 * Apply a team's completed research to a fighter for one match: sum the sub-stat
 * bonuses of every finished project. Returns a new Fighter; the stored record is
 * untouched (match-time loadout, exactly like applyArmoury/applyTraits).
 */
export function applyResearch(fighter: Fighter, completed: ResearchKey[]): Fighter {
  if (completed.length === 0) return fighter;
  const subStats: SubStats = { ...fighter.subStats };
  for (const key of completed) {
    for (const [stat, delta] of Object.entries(RESEARCH_PROJECTS[key].substat)) {
      const s = stat as SubStatKey;
      subStats[s] = subStats[s] + (delta as number);
    }
  }
  return { ...fighter, subStats };
}
