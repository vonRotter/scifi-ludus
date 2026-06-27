/**
 * Fixture list: every week's match, results so far, and the action for the next
 * unplayed fixture (play it yourself, or simulate an AI-vs-AI week).
 * Presentation + store actions only.
 */

import { GameState, teamById } from '../../state/gameState';
import { nextUnplayed, seasonComplete } from '../../engine/season';
import { nextSeason, simulateHeadless } from '../../state/gameStore';
import { Navigate } from '../../App';
import { Fixture } from '../../engine/types';

function teamCell(game: GameState, teamId: string) {
  const isYou = teamId === game.playerTeamId;
  return <span className={isYou ? 'player' : ''}>{teamById(game, teamId).name}</span>;
}

/** 1 -> "1st", 2 -> "2nd", etc. */
function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

export function FixturesScreen({ game, navigate }: { game: GameState; navigate: Navigate }) {
  const next = nextUnplayed(game.fixtures);
  const done = seasonComplete(game.fixtures);
  const involvesPlayer = (f: Fixture) =>
    f.homeTeamId === game.playerTeamId || f.awayTeamId === game.playerTeamId;

  return (
    <div>
      <h2>Fixtures — Season {game.season}</h2>
      {game.lastReview && game.lastReview.season === game.season - 1 && (
        <div className="panel" style={{ marginBottom: 12 }}>
          <strong>Season {game.lastReview.season} review</strong>
          <div className="muted" style={{ marginTop: 4 }}>
            Champions: {game.lastReview.championName}. You finished{' '}
            {ordinal(game.lastReview.playerRank)} — earning {game.lastReview.playerPrize}c and{' '}
            +{game.lastReview.playerRepGain} reputation.
          </div>
          <div className="muted">
            {game.lastReview.retiredNames.length > 0
              ? `Retired: ${game.lastReview.retiredNames.join(', ')}.`
              : 'No retirements.'}{' '}
            {game.lastReview.intakeCount} new prospects joined the free-agent pool.
          </div>
        </div>
      )}
      {done && (
        <div className="panel spread" style={{ marginBottom: 12 }}>
          <div>The season is over — see the final table. Prize money is paid out when you roll into the next season.</div>
          <button className="btn big" onClick={() => nextSeason()}>Start Season {game.season + 1} →</button>
        </div>
      )}
      {next && (
        <div className="panel spread" style={{ marginBottom: 12 }}>
          <div>
            <div className="muted">Next — Week {next.week}</div>
            <div style={{ fontSize: 15 }}>
              {teamCell(game, next.homeTeamId)} <span className="muted">vs</span> {teamCell(game, next.awayTeamId)}
            </div>
          </div>
          {involvesPlayer(next) ? (
            <button className="btn big" onClick={() => navigate({ name: 'match', fixtureId: next.id })}>
              Play Match →
            </button>
          ) : (
            <button className="btn ghost big" onClick={() => simulateHeadless(next.id)}>
              Simulate Week →
            </button>
          )}
        </div>
      )}
      <table className="grid">
        <thead>
          <tr>
            <th className="num">Wk</th>
            <th>Home</th>
            <th>Away</th>
            <th className="num">Result</th>
          </tr>
        </thead>
        <tbody>
          {game.fixtures.map((f) => (
            <tr key={f.id} className={involvesPlayer(f) ? 'you' : ''}>
              <td className="num">{f.week}</td>
              <td>{teamCell(game, f.homeTeamId)}</td>
              <td>{teamCell(game, f.awayTeamId)}</td>
              <td className="num">
                {f.played ? `${f.homeScore} – ${f.awayScore}` : <span className="muted">—</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
