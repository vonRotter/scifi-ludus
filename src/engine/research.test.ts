import { describe, it, expect } from 'vitest';
import {
  advanceResearch,
  applyResearch,
  availableProjects,
  emptyResearch,
  nextProject,
  RESEARCH_PROJECTS,
  researchRate,
} from './research';
import { Fighter, SubStats, TeamResearch } from './types';

function research(over: Partial<TeamResearch> = {}): TeamResearch {
  return { ...emptyResearch(), ...over };
}

const flatStats = (): SubStats => ({
  strength: 10, technique: 10, agility: 10, eyesight: 10, steadiness: 10, handling: 10,
  toughness: 10, reflexes: 10, armourUse: 10, temperament: 10, awareness: 10, discipline: 10,
  acceleration: 10, stamina: 10, manoeuvre: 10,
});

function fighter(): Fighter {
  return {
    id: 'f', name: 'F', bodyType: 'brute', subStats: flatStats(),
    potential: 10, matchesPlayed: 0, wage: 0, scoutLevel: 0, injuryWeeks: 0, age: 25,
  };
}

describe('research rate & lab', () => {
  it('scales points per week with lab level; a bare lab does nothing', () => {
    expect(researchRate(0)).toBe(0);
    expect(researchRate(1)).toBe(1);
    expect(researchRate(3)).toBe(3);
  });
});

describe('advanceResearch', () => {
  it('accrues toward the active project and completes it at its cost', () => {
    const r0 = research({ active: 'edges', labLevel: 1 }); // edges costs 3
    const a = advanceResearch(r0, 1);
    expect(a.research.progress).toBe(1);
    expect(a.completedNow).toEqual([]);
    const b = advanceResearch(a.research, 2);
    expect(b.completedNow).toEqual(['edges']);
    expect(b.research.completed).toEqual(['edges']);
    expect(b.research.progress).toBe(0);
    expect(b.research.active).toBeNull(); // player leaves the next pick to the UI
  });

  it('an idle programme (no active project) banks nothing', () => {
    const a = advanceResearch(research({ active: null }), 5);
    expect(a.research.progress).toBe(0);
    expect(a.completedNow).toEqual([]);
  });

  it('carries overflow into the AI-picked next project', () => {
    // edges (3) then grips (4): 5 points finishes edges, banks 2 toward grips.
    const r0 = research({ active: 'edges' });
    const a = advanceResearch(r0, 5, nextProject);
    expect(a.completedNow).toEqual(['edges']);
    expect(a.research.active).toBe('grips');
    expect(a.research.progress).toBe(2);
  });

  it('nextProject walks the catalogue in order, skipping completed', () => {
    expect(nextProject(research())).toBe('edges');
    expect(nextProject(research({ completed: ['edges'] }))).toBe('grips');
  });
});

describe('applyResearch', () => {
  it('sums completed projects into a match-time bonus without touching the record', () => {
    const f = fighter();
    // edges: +1 strength +1 technique; plating: +1 armourUse +1 toughness.
    const buffed = applyResearch(f, ['edges', 'plating']);
    expect(buffed.subStats.strength).toBe(11);
    expect(buffed.subStats.technique).toBe(11);
    expect(buffed.subStats.armourUse).toBe(11);
    expect(buffed.subStats.toughness).toBe(11);
    // Original untouched.
    expect(f.subStats.strength).toBe(10);
  });

  it('is a no-op with nothing researched', () => {
    const f = fighter();
    expect(applyResearch(f, [])).toBe(f);
  });
});

describe('availableProjects', () => {
  it('drops completed projects from the pickable list', () => {
    const all = availableProjects(research());
    expect(all.length).toBe(Object.keys(RESEARCH_PROJECTS).length);
    const some = availableProjects(research({ completed: ['edges', 'optics'] }));
    expect(some.map((p) => p.key)).not.toContain('edges');
    expect(some.map((p) => p.key)).not.toContain('optics');
  });
});
