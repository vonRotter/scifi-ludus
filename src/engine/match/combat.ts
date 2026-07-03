/**
 * Combat resolution: how one attack deals damage.
 *
 * Single responsibility: given attacker, defender, attack kind, posture
 * multipliers and an injected rng, compute damage and cooldown. All randomness
 * flows through the passed rng — never Math.random. No React, no state.
 */

import { Rng } from '../rng';
import { SPEC_ATTACK_STEP, SPEC_DEFENCE_STEP, SPEC_MENTAL_STEP, specLevel } from '../procurement';
import { Entity } from './internal';

export type AttackKind = 'melee' | 'ranged';

/** Ranges in field units. */
export const MELEE_RANGE = 12;
export const RANGED_RANGE = 90;

const BASE_DAMAGE = 16;

export interface PostureMods {
  /** Multiplier on outgoing damage. */
  atk: number;
  /** Multiplier on effective defence. */
  def: number;
}

/**
 * Resolve one attack. Returns damage dealt (0 on a miss). Mental governs the
 * hit chance and tightens variance, giving the "mental matters" feel without a
 * separate stat screen. Higher defence soaks damage via an attrition ratio.
 */
export function resolveAttack(
  attacker: Entity,
  defender: Entity,
  kind: AttackKind,
  atkMods: PostureMods,
  defMods: PostureMods,
  rng: Rng,
): number {
  // Specialization is CONDITIONAL: a melee-domain level only sharpens melee
  // attacks, a ranged level only ranged, and defence only lifts the defender's
  // guard — so a stable that pours contracts into one domain gets lopsidedly
  // good at exactly that, and nowhere else.
  const atkSpec = 1 + specLevel(attacker.spec, kind) * SPEC_ATTACK_STEP;
  const defSpec = 1 + specLevel(defender.spec, 'defence') * SPEC_DEFENCE_STEP;
  const power = (kind === 'melee' ? attacker.scores.melee : attacker.scores.ranged) * atkMods.atk * atkSpec;
  const guard = defender.scores.defence * defMods.def * defSpec;

  // Mental: hit chance 0.65..0.95, plus tighter variance when composed. A mental
  // specialization nudges the attacker's accuracy up.
  const hitChance = Math.min(0.98, 0.65 + Math.min(0.3, attacker.scores.mental * 0.015) + specLevel(attacker.spec, 'mental') * SPEC_MENTAL_STEP);
  if (!rng.chance(hitChance)) return 0;

  const ratio = power / (power + guard);
  const spread = 1 - Math.min(0.4, attacker.scores.mental * 0.02);
  const variance = rng.float(1 - spread * 0.5, 1 + spread * 0.5);
  return Math.max(1, BASE_DAMAGE * ratio * variance);
}

/** Cooldown (ticks) before the attacker may strike again. */
export function attackCooldown(attacker: Entity, kind: AttackKind): number {
  if (kind === 'melee') {
    // Agile, fast fighters swing more often.
    return Math.max(3, Math.round(7 - attacker.scores.speed * 0.15));
  }
  // Ranged is slower; handling (folded into ranged score) speeds reloads a bit.
  return Math.max(8, Math.round(16 - attacker.scores.ranged * 0.2));
}

/** Max hit points, driven by defence (toughness/armour live inside it). */
export function maxHpFor(defenceScore: number): number {
  return Math.round(60 + defenceScore * 6);
}
