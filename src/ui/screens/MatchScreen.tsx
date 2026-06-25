/**
 * Match screen: drive the two-round bout — preview, round one, half-time
 * adjustment, round two, result — over the dot renderer.
 *
 * It calls the engine to simulate (deterministically) and the store to record
 * the result, but contains no match rules itself. Round two is re-simulated
 * from the same seed with the player's half-time tactics, exactly as the
 * engine's determinism contract intends.
 */

import { useEffect, useMemo, useState } from 'react';
import { GameState, teamById } from '../../state/gameState';
import { recordMatch } from '../../state/gameStore';
import { buildMatchInputs } from '../../state/matchSetup';
import { simulateMatch } from '../../engine/match/simulate';
import { Focus, Posture, Side } from '../../engine/types';
import { FOCUS_LABEL, POSTURE_LABEL } from '../labels';
import { DotField } from '../matchView/DotField';
import { useFramePlayer } from '../matchView/useFramePlayer';
import { Navigate } from '../../App';

type Phase = 'preview' | 'round1' | 'halftime' | 'round2' | 'done';
const POSTURES: Posture[] = ['aggressive', 'balanced', 'defensive'];
const FOCUSES: Focus[] = ['melee', 'ranged', 'objective'];

export function MatchScreen({
  game,
  fixtureId,
  navigate,
}: {
  game: GameState;
  fixtureId: string;
  navigate: Navigate;
}) {
  const fixture = game.fixtures.find((f) => f.id === fixtureId)!;
  const inputs = useMemo(() => buildMatchInputs(game, fixture), [game, fixtureId]);
  const playerSide: Side = fixture.homeTeamId === game.playerTeamId ? 'home' : 'away';
  const ownTactics = inputs[playerSide].tactics;

  const result1 = useMemo(
    () => simulateMatch(inputs.home, inputs.away, inputs.arena, fixture.seed),
    [inputs, fixture.seed],
  );

  const [phase, setPhase] = useState<Phase>('preview');
  const [result2, setResult2] = useState(result1);
  const [posture, setPosture] = useState<Posture>(ownTactics.posture);
  const [focus, setFocus] = useState<Focus>(ownTactics.focus);

  const frames =
    phase === 'round2' ? result2.rounds[1].frames : result1.rounds[0].frames;
  const player = useFramePlayer(frames.length);
  const frame = frames[Math.min(player.index, frames.length - 1)];

  // Start/replay the active round's playback whenever we enter it.
  useEffect(() => {
    if (phase === 'round1' || phase === 'round2') {
      player.reset();
      player.play();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Advance the phase when a round's playback reaches the end.
  useEffect(() => {
    if (!player.atEnd || player.playing) return;
    if (phase === 'round1') setPhase('halftime');
    else if (phase === 'round2') setPhase('done');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player.atEnd, player.playing, phase]);

  const home = teamById(game, fixture.homeTeamId);
  const away = teamById(game, fixture.awayTeamId);

  const r1Home = result1.rounds[0].homeScore;
  const r1Away = result1.rounds[0].awayScore;
  const priorHome = phase === 'round2' || phase === 'done' ? r1Home : 0;
  const priorAway = phase === 'round2' || phase === 'done' ? r1Away : 0;
  const aggHome = priorHome + (phase === 'done' ? result2.rounds[1].homeScore : frame.homeScore);
  const aggAway = priorAway + (phase === 'done' ? result2.rounds[1].awayScore : frame.awayScore);

  const startRound2 = () => {
    const edited = { ...ownTactics, posture, focus };
    const r2 = simulateMatch(inputs.home, inputs.away, inputs.arena, fixture.seed, {
      round2: {
        home: playerSide === 'home' ? edited : inputs.home.tactics,
        away: playerSide === 'away' ? edited : inputs.away.tactics,
      },
    });
    setResult2(r2);
    setPhase('round2');
  };

  const confirm = () => {
    recordMatch(fixtureId, result2.homeScore, result2.awayScore, inputs.fieldedIds);
    navigate({ name: 'fixtures' });
  };

  return (
    <div className="app">
      <div className="topbar">
        <h1 style={{ fontSize: 15 }}>{inputs.arena.name.toUpperCase()}</h1>
        <span className="sub">
          {phase === 'preview' ? 'PRE-MATCH' : phase === 'halftime' ? 'HALF-TIME' : phase === 'done' ? 'FULL-TIME' : phase === 'round2' ? 'ROUND 2' : 'ROUND 1'}
        </span>
      </div>

      <div className="screen">
        <div className="scorebar" style={{ background: 'var(--bar)' }}>
          <span className={playerSide === 'home' ? 'player' : 'rival'} style={{ padding: '0 8px' }}>
            {home.name}
          </span>
          <span className="big">{aggHome} – {aggAway}</span>
          <span className={playerSide === 'away' ? 'player' : 'rival'} style={{ padding: '0 8px' }}>
            {away.name}
          </span>
        </div>

        <div className="matchstage">
          <DotField arena={inputs.arena} frame={frame} playerSide={playerSide} />
        </div>

        <div className="row" style={{ marginTop: 10, justifyContent: 'center' }}>
          {phase === 'preview' && (
            <button className="btn big" onClick={() => setPhase('round1')}>Start Round 1 →</button>
          )}
          {(phase === 'round1' || phase === 'round2') && (
            <>
              <button className="btn ghost" onClick={() => (player.playing ? player.pause() : player.play())}>
                {player.playing ? 'Pause' : 'Play'}
              </button>
              <button className="btn" onClick={() => player.skip()}>Skip ⏭</button>
            </>
          )}
          {phase === 'done' && (
            <button className="btn big" onClick={confirm}>Confirm Result →</button>
          )}
        </div>

        {phase === 'halftime' && (
          <div className="panel" style={{ marginTop: 12 }}>
            <h3 style={{ marginTop: 0 }}>Half-time — adjust your tactics</h3>
            <p className="muted">
              Round one ended {r1Home}–{r1Away}. Change your approach for round two; it re-runs from here.
            </p>
            <div className="row"><strong style={{ width: 70 }}>Posture</strong>
              {POSTURES.map((p) => (
                <span key={p} className={`pill${posture === p ? ' on' : ''}`} onClick={() => setPosture(p)}>
                  {POSTURE_LABEL[p]}
                </span>
              ))}
            </div>
            <div className="row" style={{ marginTop: 6 }}><strong style={{ width: 70 }}>Focus</strong>
              {FOCUSES.map((fo) => (
                <span key={fo} className={`pill${focus === fo ? ' on' : ''}`} onClick={() => setFocus(fo)}>
                  {FOCUS_LABEL[fo]}
                </span>
              ))}
            </div>
            <div style={{ marginTop: 12 }}>
              <button className="btn big" onClick={startRound2}>Start Round 2 →</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
