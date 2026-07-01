/**
 * History: the ludus's legacy — its departed greats and the roll of league
 * champions across the career. Pays off the multi-season loop with memory.
 * Presentation only.
 */

import { GameState } from '../../state/gameState';
import { BODYTYPE_LABEL } from '../labels';
import { BodyType } from '../../engine/types';

export function HistoryScreen({ game }: { game: GameState }) {
  return (
    <div>
      <h2>History</h2>

      <h3>Hall of Fame</h3>
      {game.hallOfFame.length === 0 ? (
        <div className="panel">No legends yet — your fighters' stories are still being written.</div>
      ) : (
        <table className="grid">
          <thead>
            <tr>
              <th>Fighter</th>
              <th>Type</th>
              <th className="num">Apps</th>
              <th className="num">Wins</th>
              <th>Fate</th>
            </tr>
          </thead>
          <tbody>
            {game.hallOfFame.map((h) => (
              <tr key={h.id}>
                <td>{h.name}</td>
                <td><span className="tag">{BODYTYPE_LABEL[h.bodyType as BodyType] ?? h.bodyType}</span></td>
                <td className="num">{h.apps}</td>
                <td className="num">{h.wins}</td>
                <td className={h.cause === 'fell' ? 'rival' : 'muted'}>
                  {h.cause === 'fell' ? `Fell in the arena, S${h.season}` : `Retired, S${h.season}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h3>League Champions</h3>
      {game.champions.length === 0 ? (
        <div className="panel">No seasons completed yet.</div>
      ) : (
        <table className="grid">
          <thead>
            <tr>
              <th className="num">Season</th>
              <th>Champions</th>
            </tr>
          </thead>
          <tbody>
            {game.champions.map((c) => (
              <tr key={c.season}>
                <td className="num">{c.season}</td>
                <td className={c.name === game.teams.find((t) => t.isPlayer)?.name ? 'player' : ''}>{c.name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
