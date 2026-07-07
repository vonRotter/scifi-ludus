import { describe, it, expect } from 'vitest';
import { generateCommentary, CommentaryCtx } from './commentary';
import { Frame, MatchEvent } from '../../engine/types';

const ctx: CommentaryCtx = {
  nameOf: (id) => ({ h1: 'Korr', a1: 'Vessia' }[id] ?? id),
  teamName: { home: 'Iron Meridian', away: 'Ferrous Dynamic' },
  playerSide: 'home',
  arenaName: 'The Crucible',
  round: 1,
};

const events: MatchEvent[] = [
  { t: 40, kind: 'first-blood', side: 'home' },
  { t: 40, kind: 'down', victim: 'a1', credit: 'h1', cause: 'melee' },
  { t: 120, kind: 'objective-flip', side: 'away' },
  { t: 200, kind: 'down', victim: 'h1', credit: null, cause: 'hazard' },
];

function frames(): Frame[] {
  const fs: Frame[] = [];
  for (let t = 0; t <= 600; t += 30) {
    fs.push({ t, fighters: [], homeScore: Math.min(30, t / 20), awayScore: Math.min(10, t / 60), homeDowns: 0, awayDowns: 0 });
  }
  return fs;
}

describe('commentary generator', () => {
  it('is deterministic — same inputs, identical script', () => {
    const a = generateCommentary(events, frames(), ctx);
    const b = generateCommentary(events, frames(), ctx);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('opens the broadcast and stays sorted by tick', () => {
    const lines = generateCommentary(events, frames(), ctx);
    expect(lines.length).toBeGreaterThan(3);
    expect(lines[0].t).toBe(0);
    for (let i = 1; i < lines.length; i++) {
      expect(lines[i].t).toBeGreaterThanOrEqual(lines[i - 1].t);
    }
  });

  it('names the killer and victim on a credited down', () => {
    const lines = generateCommentary(events, frames(), ctx);
    const down = lines.find((l) => l.speaker === 'play' && l.text.includes('Vessia'));
    expect(down).toBeTruthy();
    expect(down!.text).toContain('Korr');
  });

  it('handles a hazard down without a credit', () => {
    const lines = generateCommentary(events, frames(), ctx);
    const hazard = lines.find((l) => l.t === 200 && l.speaker === 'play');
    expect(hazard).toBeTruthy();
    expect(hazard!.text).toContain('Korr');
  });

  it('round two opens differently from round one', () => {
    const r1 = generateCommentary([], frames(), ctx)[0];
    const r2 = generateCommentary([], frames(), { ...ctx, round: 2 })[0];
    expect(r1.text).not.toBe(r2.text);
  });
});
