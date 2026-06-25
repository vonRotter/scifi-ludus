/**
 * AI opponent decisions: pick a lineup, assign roles, choose tactics.
 *
 * Single responsibility: deterministic team/tactics selection for non-player
 * teams. Pure — input fighters, output a Lineup. No React, no I/O. Randomness
 * only via an injected rng so a fixture's AI choices are reproducible.
 */

import { categoryScores, overall } from './attributes';
import { SQUAD_SIZE } from './constants';
import { Rng } from './rng';
import { Category, Fighter, Focus, Lineup, Posture, Role, Tactics } from './types';

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
  const squad = [...roster].sort((a, b) => overall(b) - overall(a)).slice(0, SQUAD_SIZE);

  const roles: Record<string, Role> = {};
  for (const f of squad) roles[f.id] = roleFor(f);

  const posture: Posture = rng.pick(['aggressive', 'balanced', 'defensive'] as Posture[]);
  const tactics: Tactics = { posture, focus: focusFor(squad), roles };

  return { teamId, fighterIds: squad.map((f) => f.id), tactics };
}
