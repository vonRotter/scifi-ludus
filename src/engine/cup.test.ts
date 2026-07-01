import { describe, it, expect } from 'vitest';
import { cupWinner, pairRound } from './cup';

const arenas = ['a', 'b', 'c'];

describe('cup bracket', () => {
  it('pairs teams into ties two at a time', () => {
    const ties = pairRound(['t0', 't1', 't2', 't3'], 42, 0, arenas);
    expect(ties).toHaveLength(2);
    expect(ties[0].homeTeamId).toBe('t0');
    expect(ties[0].awayTeamId).toBe('t1');
    expect(ties[1].homeTeamId).toBe('t2');
    expect(ties[1].awayTeamId).toBe('t3');
    // Distinct, reproducible seeds.
    expect(ties[0].seed).not.toBe(ties[1].seed);
    expect(pairRound(['t0', 't1', 't2', 't3'], 42, 0, arenas)[0].seed).toBe(ties[0].seed);
  });

  it('decides a tie by scoreline, and a draw by a stable coin-flip', () => {
    const [tie] = pairRound(['t0', 't1'], 42, 0, arenas);
    expect(cupWinner(tie, 30, 10)).toBe('t0');
    expect(cupWinner(tie, 10, 30)).toBe('t1');
    const a = cupWinner(tie, 20, 20);
    const b = cupWinner(tie, 20, 20);
    expect(a).toBe(b); // deterministic
    expect([tie.homeTeamId, tie.awayTeamId]).toContain(a);
  });
});
