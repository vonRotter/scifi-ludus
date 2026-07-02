/**
 * Cup: the season's knockout, run alongside the league. Shows the current
 * round's ties, the results so far, and the trophy once it's decided. Playing a
 * round resolves every tie at once (yours included, using your saved lineup) —
 * real bouts with real injury and morale stakes. Presentation + store action.
 */

import { GameState, teamById } from '../../state/gameState';
import { playCupRound } from '../../state/gameStore';

export function CupScreen({ game }: { game: GameState }) {
  const cup = game.cup;
  const decided = cup.championId !== null;
  const involvesPlayer = cup.ties.some(
    (t) => t.homeTeamId === game.playerTeamId || t.awayTeamId === game.playerTeamId,
  );

  return (
    <div>
      <h2>Cup — Season {game.season}</h2>

      {decided ? (
        <div className="panel" style={{ marginBottom: 12 }}>
          <strong>Winners: </strong>
          <span className={cup.championId === game.playerTeamId ? 'player' : 'rival'}>
            {teamById(game, cup.championId!).name}
          </span>
          {cup.championId === game.playerTeamId ? ' — the trophy is yours.' : '.'}
        </div>
      ) : (
        <div className="panel spread" style={{ marginBottom: 12 }}>
          <div>
            <div className="muted">Current round{involvesPlayer ? ' — you are still in it' : ' — you are out'}</div>
            <div style={{ fontSize: 15 }}>
              {cup.ties.map((t, i) => (
                <div key={t.id}>
                  {teamById(game, t.homeTeamId).name} <span className="muted">vs</span> {teamById(game, t.awayTeamId).name}
                  {i < cup.ties.length - 1 ? '' : ''}
                </div>
              ))}
            </div>
          </div>
          <button className="btn big" onClick={() => playCupRound()}>Play Cup Round →</button>
        </div>
      )}

      <h3>Results</h3>
      {cup.log.length === 0 ? (
        <div className="panel">No rounds played yet.</div>
      ) : (
        <table className="grid">
          <tbody>
            {cup.log.map((entry, i) => (
              <tr key={i}>
                <td>{entry.text}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
