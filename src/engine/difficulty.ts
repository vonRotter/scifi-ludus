/**
 * Difficulty: a small set of presets that tilt the economy and the arena's
 * cruelty at the start of a career.
 *
 * Single responsibility: name the presets and hold their pure settings. No
 * React, no randomness, no state ownership — newGame reads the starting budget,
 * and the injury/patron systems read their multipliers.
 */

export type Difficulty = 'relaxed' | 'standard' | 'brutal';

export const DIFFICULTIES: readonly Difficulty[] = ['relaxed', 'standard', 'brutal'];

export interface DifficultySettings {
  label: string;
  desc: string;
  /** Credits every team starts a career with. */
  startingBudget: number;
  /** Multiplier on injury odds (and thus career-enders). */
  injuryMult: number;
}

export const DIFFICULTY_SETTINGS: Record<Difficulty, DifficultySettings> = {
  relaxed: {
    label: 'Relaxed',
    desc: 'A fat war-chest and a gentler arena — room to experiment.',
    startingBudget: 7500,
    injuryMult: 0.6,
  },
  standard: {
    label: 'Standard',
    desc: 'The intended balance of coin and risk.',
    startingBudget: 5000,
    injuryMult: 1,
  },
  brutal: {
    label: 'Brutal',
    desc: 'A lean purse and a savage arena — every bout bites.',
    startingBudget: 3500,
    injuryMult: 1.5,
  },
};

/** Injury-odds multiplier for a difficulty (1 when unset, for old saves). */
export function difficultyInjuryMult(difficulty: Difficulty | undefined): number {
  return difficulty ? DIFFICULTY_SETTINGS[difficulty].injuryMult : 1;
}
