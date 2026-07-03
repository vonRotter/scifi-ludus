/**
 * Fixture list: every week's match, results so far, and the action for the next
 * unplayed fixture (play it yourself, or simulate an AI-vs-AI week).
 * Presentation + store actions only.
 */

import { GameState, teamById } from '../../state/gameState';
import { nextUnplayed, seasonComplete } from '../../engine/season';
import { nextSeason, simulateHeadless } from '../../state/gameStore';
import { buildMatchInputs } from '../../state/matchSetup';
import { estimateCategories } from '../../engine/fog';
import { confidenceLabel } from '../../engine/patron';
import { BODYTYPE_LABEL } from '../labels';
import { Navigate } from '../../App';
import { Fixture } from '../../engine/types';
import { clickableProps } from '../a11y';

function teamCell(game: GameState, teamId: string) {
  const isYou = teamId === game.playerTeamId;
  return <span className={isYou ? 'player' : ''}>{teamById(game, teamId).name}</span>;
}

/**
 * A pre-match scouting report on the opponent's likely six — their fogged
 * combat estimates and the tactical lean the player might plan around. Reads
 * the same deterministic setup the match will use, so the intel is honest.
 */
function ScoutingReport({ game, fixture, navigate }: { game: GameState; fixture: Fixture; navigate: Navigate }) {
  const oppId = fixture.homeTeamId === game.playerTeamId ? fixture.awayTeamId : fixture.homeTeamId;
  const inputs = buildMatchInputs(game, fixture);
  const oppSide = fixture.homeTeamId === game.playerTeamId ? inputs.away : inputs.home;
  const oppFighters = oppSide.fighters.map((f) => game.fighters[f.id]).filter(Boolean);

  // Infer their lean from estimated melee vs ranged across the likely six.
  let melee = 0;
  let ranged = 0;
  for (const f of oppFighters) {
    const c = estimateCategories(f);
    melee += c.melee.mid;
    ranged += c.ranged.mid;
  }
  const leanLabel = ranged > melee * 1.1 ? 'a ranged side' : melee > ranged * 1.1 ? 'a melee side' : 'a balanced side';

  return (
    <div style={{ marginTop: 10, borderTop: '1px solid var(--line)', paddingTop: 8 }}>
      <div className="spread">
        <strong style={{ fontSize: 12 }}>Scouting — {teamById(game, oppId).name}</strong>
        <span className="muted" style={{ fontSize: 11 }}>Looks like {leanLabel}.</span>
      </div>
      <table className="grid" style={{ marginTop: 6 }}>
        <thead>
          <tr>
            <th>Likely fielder</th>
            <th>Type</th>
            <th className="num">Mel</th>
            <th className="num">Rng</th>
            <th className="num">Def</th>
          </tr>
        </thead>
        <tbody>
          {oppFighters.map((f) => {
            const c = estimateCategories(f);
            return (
              <tr key={f.id} className="clickable" {...clickableProps(() => navigate({ name: 'fighter', id: f.id }), `View ${f.name}`)}>
                <td>{f.name}</td>
                <td><span className="tag">{BODYTYPE_LABEL[f.bodyType]}</span></td>
                <td className="num">~{c.melee.mid}</td>
                <td className="num">~{c.ranged.mid}</td>
                <td className="num">~{c.defence.mid}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
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
      <div className="panel spread" style={{ marginBottom: 12 }}>
        <div>
          <span className="muted">Sponsor's objective: </span>
          <strong>{game.objective.text}</strong>
        </div>
        <div
          title="How much faith your sponsor has in you. Meet objectives to keep it up; miss them and patience wears thin."
        >
          <span className="muted">Confidence: </span>
          <strong style={{ color: game.patronConfidence < 40 ? 'var(--bad)' : undefined }}>
            {confidenceLabel(game.patronConfidence)}
          </strong>
        </div>
      </div>
      {game.patronConfidence <= 18 ? (
        <div className="panel" style={{ marginBottom: 12, borderColor: 'var(--bad)', color: 'var(--bad)' }}>
          ⚠ Your seat is under serious threat. Miss the objective ({game.objective.text}) once more and the sponsor will sack you.
        </div>
      ) : game.patronConfidence < 40 ? (
        <div className="panel" style={{ marginBottom: 12 }}>
          Your sponsor is uneasy. Deliver the objective to steady your position.
        </div>
      ) : null}
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
        <div className="panel" style={{ marginBottom: 12 }}>
          <div className="spread">
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
          {involvesPlayer(next) && <ScoutingReport game={game} fixture={next} navigate={navigate} />}
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
