import { describe, it, expect } from 'vitest';
import { intelDetail, projectedSquad, readOpponent } from './intel';
import { generateContent } from '../data/seedFighters';
import { SQUAD_SIZE } from './constants';
import { Fighter } from './types';

function roster(): Fighter[] {
  const c = generateContent(999, 0);
  const team = c.teams[1];
  return team.fighterIds.map((id) => c.fighters[id]);
}

describe('opponent intel', () => {
  it('recon level gates how much detail is revealed', () => {
    expect(intelDetail(0)).toBe('coarse');
    expect(intelDetail(1)).toBe('lineup');
    expect(intelDetail(3)).toBe('detailed');
  });

  it('projects exactly a full squad, fit fighters preferred', () => {
    const r = roster();
    const squad = projectedSquad(r);
    expect(squad.length).toBe(SQUAD_SIZE);
    // An injured fighter is only projected if there aren't SQUAD_SIZE fit ones.
    const injured = { ...r[0], injuryWeeks: 3 };
    const withInjury = [injured, ...r.slice(1)];
    const squad2 = projectedSquad(withInjury);
    if (withInjury.filter((f) => f.injuryWeeks === 0).length >= SQUAD_SIZE) {
      expect(squad2.some((f) => f.id === injured.id)).toBe(false);
    }
  });

  it('reads a coherent profile, top category and tendency', () => {
    const intel = readOpponent(roster(), 2);
    expect(intel.detail).toBe('detailed');
    // Profile has every category and topCategory is genuinely the max.
    const cats = Object.keys(intel.profile) as (keyof typeof intel.profile)[];
    for (const c of cats) expect(intel.profile[intel.topCategory]).toBeGreaterThanOrEqual(intel.profile[c]);
    expect(['melee', 'ranged', 'objective']).toContain(intel.tendency);
  });

  it('a ranged-heavy squad reads as ranged-leaning', () => {
    const r = roster().map((f) => ({
      ...f,
      subStats: { ...f.subStats, eyesight: 19, steadiness: 18, handling: 18, strength: 3, technique: 3, agility: 3 },
    }));
    expect(readOpponent(r, 2).tendency).toBe('ranged');
  });
});
