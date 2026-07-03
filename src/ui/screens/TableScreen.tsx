/**
 * League table: standings computed from played fixtures, plus the champion
 * banner once the season is complete. Presentation only — tallying is in
 * engine/season.
 */

import { GameState, teamById } from '../../state/gameState';
import { champion, computeTable } from '../../engine/season';

export function TableScreen({ game }: { game: GameState }) {
  const table = computeTable(game.teams, game.fixtures);
  const champId = champion(game.teams, game.fixtures);

  return (
    <div>
      <h2>League Table</h2>
      {champId && (
        <div className="panel" style={{ marginBottom: 12 }}>
          <strong>Season complete.</strong> Champions:{' '}
          <span className={champId === game.playerTeamId ? 'player' : 'rival'}>
            {teamById(game, champId).name}
          </span>
          {champId === game.playerTeamId ? ' — your stable takes the crown.' : '.'}
        </div>
      )}
      <div className="table-wrap">
      <table className="grid">
        <thead>
          <tr>
            <th>#</th>
            <th>Team</th>
            <th className="num" title="Played">P</th>
            <th className="num" title="Won">W</th>
            <th className="num" title="Drawn">D</th>
            <th className="num" title="Lost">L</th>
            <th className="num" title="Arena points scored">PF</th>
            <th className="num" title="Arena points conceded">PA</th>
            <th className="num" title="Points scored minus points conceded">Diff</th>
            <th className="num" title="League points: 3 for a win, 1 for a draw">Pts</th>
            <th className="num" title="Credits on hand after wages and prize money">Budget</th>
          </tr>
        </thead>
        <tbody>
          {table.map((row, i) => {
            const isYou = row.teamId === game.playerTeamId;
            return (
              <tr key={row.teamId} className={isYou ? 'you' : ''}>
                <td className="num">{i + 1}</td>
                <td className={isYou ? 'player' : ''}>{teamById(game, row.teamId).name}</td>
                <td className="num">{row.played}</td>
                <td className="num">{row.won}</td>
                <td className="num">{row.drawn}</td>
                <td className="num">{row.lost}</td>
                <td className="num">{row.pointsFor}</td>
                <td className="num">{row.pointsAgainst}</td>
                <td className="num">{row.pointsFor - row.pointsAgainst}</td>
                <td className="num"><strong>{row.points}</strong></td>
                <td className="num">{teamById(game, row.teamId).budget}c</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
      <p className="muted">
        Win = 3 pts, draw = 1. PF/PA are arena points for and against. Budget
        is credits on hand after wages and prize money.
      </p>
    </div>
  );
}
