/**
 * Match setup: build simulation entities and starting positions.
 *
 * Single responsibility: translate fighters + tactics into placed Entities and
 * resolve posture into combat multipliers. Pure, deterministic, no React.
 */

import { categoryScores } from '../attributes';
import { deriveSeed, hashString, makeRng } from '../rng';
import { Arena, Posture, Side, SquadInput, Role } from '../types';
import { maxHpFor } from './combat';
import { PostureMods } from './combat';
import { newStat } from './events';
import { Entity } from './internal';

/** Outgoing-damage / effective-defence multipliers for each posture. */
export function postureMods(posture: Posture): PostureMods {
  switch (posture) {
    case 'aggressive':
      return { atk: 1.25, def: 0.85 };
    case 'defensive':
      return { atk: 0.8, def: 1.25 };
    case 'balanced':
    default:
      return { atk: 1.0, def: 1.0 };
  }
}

/** Horizontal depth (0..1 across the field) for a role on a given side. */
function depthFor(role: Role, side: Side): number {
  const home = side === 'home';
  switch (role) {
    case 'frontline':
      return home ? 0.34 : 0.66;
    case 'skirmisher':
      return home ? 0.2 : 0.8;
    case 'holdback':
    default:
      return home ? 0.1 : 0.9;
  }
}

/**
 * Build the six placed entities for one squad. Fighters spread vertically and
 * are pushed forward/back by their assigned role, then nudged by a small
 * round-seeded jitter so the same lineup doesn't start in an identical spot
 * every round. The full true category scores are baked in here — the
 * simulation always runs on the truth, never the fog.
 */
export function buildEntities(
  squad: SquadInput,
  arena: Arena,
  seed: number,
  energyIn?: Record<string, number>,
): Entity[] {
  const n = squad.fighters.length;
  const spec = squad.spec ?? {};
  return squad.fighters.map((f, i) => {
    const role = squad.tactics.roles[f.id] ?? 'frontline';
    const scores = categoryScores(f.subStats);
    const seedBase = hashString(f.id);
    const jitter = makeRng(deriveSeed(seedBase ^ seed, 0xa11ce));
    const x = depthFor(role, squad.side) * arena.width + jitter.float(-6, 6);
    const y = ((i + 1) / (n + 1)) * arena.height + jitter.float(-10, 10);
    const maxHp = maxHpFor(scores.defence);
    return {
      id: f.id,
      side: squad.side,
      role,
      x,
      y,
      hp: maxHp,
      maxHp,
      alive: true,
      cooldown: 0,
      scores,
      spec,
      seedBase,
      facing: squad.side === 'home' ? 0 : Math.PI,
      action: 'idle',
      stat: newStat(squad.side),
      lastCredit: null,
      lastCause: null,
      // Fresh legs default to full; a carried snapshot (round two) starts tired.
      energy: energyIn?.[f.id] ?? 1,
      stamina: f.subStats.stamina,
      awareness: f.subStats.awareness,
      discipline: f.subStats.discipline,
      targetId: null,
    };
  });
}
