/**
 * Post-match report: the dry FM-style table of who did what.
 *
 * Single responsibility: present the engine's per-fighter MatchStats and derived
 * ratings. It decides how the numbers look, never how they were computed — the
 * engine produced every value here. Pure presentation.
 */

import { Fighter, MatchStats, Side, Team } from '../../engine/types';

/** Rating colour: green for a strong game, red for a poor one, ink otherwise. */
function ratingColor(r: number): string {
  if (r >= 7) return 'var(--good)';
  if (r < 5) return 'var(--rival)';
  return 'var(--ink)';
}

function accuracy(hits: number, attempts: number): string {
  return attempts === 0 ? '—' : `${Math.round((hits / attempts) * 100)}%`;
}

function TeamTable({
  team,
  fighters,
  numbers,
  stats,
  ratings,
  isPlayer,
}: {
  team: Team;
  fighters: Fighter[];
  numbers: Record<string, number>;
  stats: MatchStats;
  ratings: Record<string, number>;
  isPlayer: boolean;
}) {
  return (
    <div style={{ flex: 1, minWidth: 320 }}>
      <div className="spread" style={{ marginBottom: 4 }}>
        <strong className={isPlayer ? 'player' : 'rival'} style={{ fontSize: 12 }}>{team.name}</strong>
      </div>
      <div className="table-wrap">
        <table className="grid" style={{ fontSize: 11, width: '100%' }}>
          <thead>
            <tr>
              <th>#</th>
              <th>Fighter</th>
              <th className="num" title="Match rating">Rtg</th>
              <th className="num" title="Damage dealt">Dmg</th>
              <th className="num" title="Damage taken">Taken</th>
              <th className="num" title="Downs scored">Dn</th>
              <th className="num" title="Ranged/melee accuracy">Acc</th>
              <th className="num" title="Seconds holding the objective">Zone</th>
            </tr>
          </thead>
          <tbody>
            {fighters.map((f) => {
              const s = stats[f.id];
              const rtg = ratings[f.id];
              return (
                <tr key={f.id}>
                  <td className="num">{numbers[f.id]}</td>
                  <td>{f.name}</td>
                  <td className="num" style={{ color: ratingColor(rtg ?? 6), fontWeight: 600 }}>
                    {rtg != null ? rtg.toFixed(1) : '—'}
                  </td>
                  <td className="num">{s ? Math.round(s.damageDealt) : 0}</td>
                  <td className="num">{s ? Math.round(s.damageTaken) : 0}</td>
                  <td className="num">{s ? s.downsScored : 0}</td>
                  <td className="num">{s ? accuracy(s.hitsLanded, s.attempts) : '—'}</td>
                  <td className="num">{s ? Math.round(s.zoneTicks / 10) : 0}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function MatchReport({
  home,
  away,
  homeFighters,
  awayFighters,
  numbers,
  stats,
  ratings,
  playerSide,
}: {
  home: Team;
  away: Team;
  homeFighters: Fighter[];
  awayFighters: Fighter[];
  numbers: Record<string, number>;
  stats: MatchStats;
  ratings: Record<string, number>;
  playerSide: Side;
}) {
  // Player of the match: the top rating across both sides.
  const all = [...homeFighters, ...awayFighters];
  const motm = all.reduce<Fighter | null>((best, f) => {
    if (ratings[f.id] == null) return best;
    return !best || ratings[f.id] > (ratings[best.id] ?? 0) ? f : best;
  }, null);
  const motmSide: Side | null = motm ? (homeFighters.includes(motm) ? 'home' : 'away') : null;

  return (
    <div className="panel" style={{ marginTop: 12 }}>
      <h3 style={{ marginTop: 0 }}>Match report</h3>
      {motm && (
        <div style={{ fontSize: 12, marginBottom: 8 }}>
          <span className="muted">Player of the match: </span>
          <strong className={motmSide === playerSide ? 'player' : 'rival'}>{motm.name}</strong>
          <span className="muted"> ({ratings[motm.id].toFixed(1)})</span>
        </div>
      )}
      <div className="row" style={{ alignItems: 'flex-start', gap: 20 }}>
        <TeamTable team={home} fighters={homeFighters} numbers={numbers} stats={stats} ratings={ratings} isPlayer={playerSide === 'home'} />
        <TeamTable team={away} fighters={awayFighters} numbers={numbers} stats={stats} ratings={ratings} isPlayer={playerSide === 'away'} />
      </div>
    </div>
  );
}
