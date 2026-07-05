import { describe, it, expect } from 'vitest';
import { updateNerve } from './nerve';
import { simulateMatch } from './simulate';
import { generateContent } from '../../data/seedFighters';
import { ARENAS } from '../../data/arenas';
import { SQUAD_SIZE } from '../constants';
import { Entity } from './internal';
import { Fighter, Role, Side, SquadInput, Tactics } from '../types';

function stub(over: Partial<Entity> = {}): Entity {
  return {
    x: 0, y: 0, side: 'home', alive: true, maxHp: 100, nerve: 1, shaken: false,
    temperament: 10, ...over,
  } as unknown as Entity;
}

describe('updateNerve', () => {
  it('erodes on a heavy hit and recovers on a calm tick', () => {
    const hit = stub();
    updateNerve(hit, [hit], 40, 0); // lost 40% of max HP
    expect(hit.nerve).toBeLessThan(1);

    const calm = stub({ nerve: 0.5 });
    updateNerve(calm, [calm], 0, 0);
    expect(calm.nerve).toBeGreaterThan(0.5);
  });

  it('ignores a glancing hit (below the heavy threshold)', () => {
    const graze = stub();
    updateNerve(graze, [graze], 5, 0); // 5% of max HP, under the 12% bar
    expect(graze.nerve).toBe(1); // recovery caps at 1, no net loss
  });

  it('drops when an ally falls nearby and when locally outnumbered', () => {
    const ally = stub();
    updateNerve(ally, [ally], 0, 2);
    expect(ally.nerve).toBeLessThan(1);

    const self = stub();
    const foes = [self, stub({ side: 'away', x: 5 }), stub({ side: 'away', x: 8 })];
    const before = stub().nerve;
    updateNerve(self, foes, 0, 0);
    expect(self.nerve).toBeLessThan(before);
  });

  it('high temperament resists nerve loss', () => {
    const meek = stub({ temperament: 2 });
    const stoic = stub({ temperament: 19 });
    updateNerve(meek, [meek], 40, 1);
    updateNerve(stoic, [stoic], 40, 1);
    expect(meek.nerve).toBeLessThan(stoic.nerve);
  });

  it('sets shaken below the break point and clears it only above steady (hysteresis)', () => {
    const e = stub({ nerve: 0.4 });
    expect(updateNerve(e, [e], 20, 1)).toBe(true); // crosses below BREAK, first break
    expect(e.shaken).toBe(true);
    // A small recovery keeps it shaken (still under the STEADY clear line).
    updateNerve(e, [e], 0, 0);
    expect(e.shaken).toBe(true);
    // Force it well above STEADY and it composes itself.
    e.nerve = 0.7;
    updateNerve(e, [e], 0, 0);
    expect(e.shaken).toBe(false);
  });
});

function squad(fighters: Fighter[], side: Side): SquadInput {
  const roles: Record<string, Role> = {};
  for (const f of fighters) roles[f.id] = 'frontline';
  const tactics: Tactics = { posture: 'aggressive', focus: 'melee', roles };
  return { side, fighters: fighters.slice(0, SQUAD_SIZE), tactics };
}

describe('nerve over a match', () => {
  it('rattles someone and emits shaken events, deterministically', () => {
    const c = generateContent(555);
    const home = c.teams[0].fighterIds.map((id) => c.fighters[id]);
    const away = c.teams[1].fighterIds.map((id) => c.fighters[id]);
    const a = simulateMatch(squad(home, 'home'), squad(away, 'away'), ARENAS[0], 6);
    const b = simulateMatch(squad(home, 'home'), squad(away, 'away'), ARENAS[0], 6);

    const shakenEvents = [...a.rounds[0].events, ...a.rounds[1].events].filter((e) => e.kind === 'shaken');
    const anyShakenTicks = Object.values(a.stats).some((s) => s.shakenTicks > 0);
    expect(shakenEvents.length).toBeGreaterThan(0);
    expect(anyShakenTicks).toBe(true);
    // A shaken event's fighter accrued shaken ticks in the totals.
    expect(JSON.stringify(a.stats)).toBe(JSON.stringify(b.stats));
  });
});
