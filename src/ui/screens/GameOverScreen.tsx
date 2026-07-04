/**
 * Game over: the sponsor has sacked the manager. The career is finished — this
 * screen shows the legacy it leaves behind and offers a fresh start. Full
 * takeover (no nav), shown by App whenever game.careerOver is set.
 * Presentation + one store action (abandon) only.
 */

import { GameState, playerTeam } from '../../state/gameState';
import { abandonGame } from '../../state/gameStore';
import { reputationTier } from '../../engine/reputation';

export function GameOverScreen({ game }: { game: GameState }) {
  const team = playerTeam(game);
  const titles = game.champions.filter((c) => c.name === team.name).length;
  const legends = game.hallOfFame.length;

  return (
    <div className="app">
      <div className="menu">
        <div className="title" style={{ color: 'var(--bad)' }}>SACKED</div>
        <div className="tagline">CAREER OVER</div>
        <div className="panel">
          <p style={{ marginTop: 0 }}>{game.careerOver?.message}</p>

          <h3 style={{ marginBottom: 6 }}>Your legacy at {team.name}</h3>
          <table className="grid">
            <tbody>
              <tr><td>Seasons in charge</td><td className="num">{game.careerOver?.season ?? game.season}</td></tr>
              <tr><td>League titles</td><td className="num">{titles}</td></tr>
              <tr><td>Final standing</td><td className="num">{reputationTier(team.reputation)}</td></tr>
              <tr><td>Legends produced</td><td className="num">{legends}</td></tr>
            </tbody>
          </table>

          <p className="muted" style={{ fontSize: 12 }}>
            A sponsor's patience is finite — meet the board's objective, or the next
            one may not give you as long a leash.
          </p>
          <button className="btn big" onClick={() => abandonGame()}>Start a New Career</button>
        </div>
      </div>
    </div>
  );
}
