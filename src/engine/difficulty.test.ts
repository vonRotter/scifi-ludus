import { describe, it, expect } from 'vitest';
import { difficultyInjuryMult, DIFFICULTIES, DIFFICULTY_SETTINGS } from './difficulty';

describe('difficulty presets', () => {
  it('relaxed is kinder than brutal on both budget and injuries', () => {
    expect(DIFFICULTY_SETTINGS.relaxed.startingBudget).toBeGreaterThan(DIFFICULTY_SETTINGS.brutal.startingBudget);
    expect(DIFFICULTY_SETTINGS.relaxed.injuryMult).toBeLessThan(DIFFICULTY_SETTINGS.brutal.injuryMult);
    expect(DIFFICULTY_SETTINGS.standard.injuryMult).toBe(1);
  });

  it('exposes every preset with a label and description', () => {
    for (const d of DIFFICULTIES) {
      expect(DIFFICULTY_SETTINGS[d].label.length).toBeGreaterThan(0);
      expect(DIFFICULTY_SETTINGS[d].desc.length).toBeGreaterThan(0);
    }
  });

  it('defaults the injury multiplier to 1 for an unset (old-save) difficulty', () => {
    expect(difficultyInjuryMult(undefined)).toBe(1);
    expect(difficultyInjuryMult('brutal')).toBeGreaterThan(1);
  });
});
