/**
 * AI opponent decisions: pick a lineup, assign roles, choose tactics.
 *
 * Single responsibility: deterministic team/tactics selection for non-player
 * teams. Pure — input fighters, output a Lineup. No React, no I/O. Randomness
 * only via an injected rng so a fixture's AI choices are reproducible.
 */

import { categoryScores, overall } from './attributes';
import { ROSTER_SIZE, SQUAD_SIZE } from './constants';
import { canUpgrade, facilityUpgradeCost, FACILITY_KINDS } from './facilities';
import { isInjured } from './injury';
import { Rng } from './rng';
import { Category, Facilities, FacilityKind, Fighter, Focus, Lineup, Posture, Role, Team, Tactics } from './types';

/** Assign a role from the fighter's single strongest combat category. */
function roleFor(fighter: Fighter): Role {
  const s = categoryScores(fighter.subStats);
  const ranked: [Category, number][] = [
    ['melee', s.melee],
    ['ranged', s.ranged],
    ['defence', s.defence],
  ];
  ranked.sort((a, b) => b[1] - a[1]);
  switch (ranked[0][0]) {
    case 'ranged':
      return 'skirmisher';
    case 'defence':
      return 'holdback';
    default:
      return 'frontline';
  }
}

/** Choose team focus from the squad's offensive composition. */
function focusFor(squad: Fighter[]): Focus {
  let melee = 0;
  let ranged = 0;
  for (const f of squad) {
    const s = categoryScores(f.subStats);
    melee += s.melee;
    ranged += s.ranged;
  }
  if (ranged > melee * 1.1) return 'ranged';
  if (melee > ranged * 1.1) return 'melee';
  return 'objective';
}

/**
 * Pick the AI's six fighters (best by overall), assign each a role from its
 * strengths, and choose posture/focus. Deterministic for a given rng.
 */
export function chooseLineup(
  teamId: string,
  fighterIds: string[],
  fightersById: Record<string, Fighter>,
  rng: Rng,
): Lineup {
  const roster = fighterIds.map((id) => fightersById[id]);
  // Field the best six available, preferring fit fighters; only call up the
  // injured if there aren't six healthy bodies to make a full squad.
  const byOverall = (a: Fighter, b: Fighter) => overall(b) - overall(a);
  const fit = roster.filter((f) => !isInjured(f)).sort(byOverall);
  const hurt = roster.filter((f) => isInjured(f)).sort(byOverall);
  const squad = [...fit, ...hurt].slice(0, SQUAD_SIZE);

  const roles: Record<string, Role> = {};
  for (const f of squad) roles[f.id] = roleFor(f);

  const posture: Posture = rng.pick(['aggressive', 'balanced', 'defensive'] as Posture[]);
  const tactics: Tactics = { posture, focus: focusFor(squad), roles };

  return { teamId, fighterIds: squad.map((f) => f.id), tactics };
}

/** An AI school keeps this many credits in reserve before it invests. */
const AI_CASH_RESERVE = 800;

/**
 * Decide which facility an AI school upgrades after a match, if any. It only
 * spends above a cash reserve, and picks at random among the affordable,
 * not-yet-maxed facilities — so rivals slowly improve over a season instead of
 * hoarding prize money. Returns the facility to build, or null to save. Pure
 * and deterministic in `rng`.
 */
export function chooseFacilityUpgrade(
  facilities: Facilities,
  budget: number,
  rng: Rng,
): FacilityKind | null {
  const options = FACILITY_KINDS.filter(
    (k) => canUpgrade(facilities, k) && budget - facilityUpgradeCost(facilities, k) >= AI_CASH_RESERVE,
  );
  if (options.length === 0) return null;
  return rng.pick(options as FacilityKind[]);
}

/**
 * Decide which free agent an AI school signs in the off-season, if any. A team
 * below a full roster picks from the best few available (a little randomness so
 * rivals don't all chase the exact same fighter). Returns the fighter id to
 * sign, or null to pass. Pure and deterministic in `rng`. AI recruiting is what
 * keeps rival rosters — and the free-agent pool — alive between seasons.
 */
export function chooseSigning(team: Team, available: Fighter[], rng: Rng): string | null {
  if (team.fighterIds.length >= ROSTER_SIZE || available.length === 0) return null;
  const ranked = [...available].sort((a, b) => overall(b) - overall(a));
  const shortlist = ranked.slice(0, Math.min(3, ranked.length));
  return rng.pick(shortlist).id;
}
