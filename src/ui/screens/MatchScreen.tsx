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
import { Arena, CATEGORIES, Fighter, Focus, Posture, Side, Team } from '../../engine/types';
import { corpByKey } from '../../engine/corporations';
import { fighterTopCategory, OpponentIntel, readOpponent } from '../../engine/intel';
import {
  CATEGORY_LABEL, FOCUS_DESC, FOCUS_LABEL, HAZARD_DESC, HAZARD_LABEL, POSTURE_DESC, POSTURE_LABEL, specSummary,
} from '../labels';
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
  const oppTeam = playerSide === 'home' ? away : home;
  const reconLevel = teamById(game, game.playerTeamId).facilities.scouting;
  const intel = useMemo(
    () => readOpponent(oppTeam.fighterIds.map((id) => game.fighters[id]).filter(Boolean) as Fighter[], reconLevel),
    [oppTeam, game, reconLevel],
  );
  const oppForm = useMemo(() => recentForm(game, oppTeam.id), [game, oppTeam.id]);

  // Stable squad numbers (1..6), assigned by lineup order, for the dot field
  // and the roster legend underneath it.
  const numbers = useMemo(() => {
    const map: Record<string, number> = {};
    inputs.home.fighters.forEach((f, i) => (map[f.id] = i + 1));
    inputs.away.fighters.forEach((f, i) => (map[f.id] = i + 1));
    return map;
  }, [inputs]);

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
          <DotField arena={inputs.arena} frame={frame} playerSide={playerSide} numbers={numbers} />
        </div>

        <div className="row" style={{ marginTop: 8, gap: 24, justifyContent: 'center' }}>
          <RosterLegend team={home} fighters={inputs.home.fighters} numbers={numbers} isPlayer={playerSide === 'home'} />
          <ActionLegend />
          <HazardLegend arena={inputs.arena} />
          <RosterLegend team={away} fighters={inputs.away.fighters} numbers={numbers} isPlayer={playerSide === 'away'} />
        </div>

        {phase === 'preview' && (
          <PreMatchBriefing
            you={playerSide === 'home' ? home : away}
            opp={oppTeam}
            arena={inputs.arena}
            intel={intel}
            form={oppForm}
            reconLevel={reconLevel}
          />
        )}

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
                <span key={p} className={`pill${posture === p ? ' on' : ''}`} title={POSTURE_DESC[p]} onClick={() => setPosture(p)}>
                  {POSTURE_LABEL[p]}
                </span>
              ))}
            </div>
            <div className="row" style={{ marginTop: 6 }}><strong style={{ width: 70 }}>Focus</strong>
              {FOCUSES.map((fo) => (
                <span key={fo} className={`pill${focus === fo ? ' on' : ''}`} title={FOCUS_DESC[fo]} onClick={() => setFocus(fo)}>
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

/**
 * Pre-match briefing: who you're facing (and their corporation), each stable's
 * earned specialization edge, and what the arena will throw at you. This is
 * where the contract/corp/hazard systems become legible at the moment they pay
 * off. Presentation only.
 */
const TENDENCY_TEXT: Record<Focus, string> = {
  melee: 'press in melee', ranged: 'hold at range', objective: 'contest the objective',
};
const DETAIL_TEXT: Record<OpponentIntel['detail'], string> = {
  coarse: 'coarse read', lineup: 'line-up projected', detailed: 'detailed dossier',
};

function PreMatchBriefing({
  you, opp, arena, intel, form, reconLevel,
}: {
  you: Team; opp: Team; arena: Arena; intel: OpponentIntel; form: string[]; reconLevel: number;
}) {
  const oppCorp = corpByKey(opp.corpKey);
  const kinds = [...new Set((arena.hazards ?? []).map((h) => h.kind))];
  return (
    <div className="panel" style={{ marginTop: 12 }}>
      <h3 style={{ marginTop: 0 }}>Pre-match briefing</h3>
      <div className="muted" style={{ fontSize: 13 }}>
        Facing <strong className="rival">{opp.name}</strong>, backed by {oppCorp.name} — {CATEGORY_LABEL[oppCorp.specialty]} specialists.
      </div>
      <div className="row" style={{ flexWrap: 'wrap', marginTop: 8, gap: 20 }}>
        <div><span className="muted" style={{ fontSize: 12 }}>Your edge: </span><strong>{specSummary(you.specializations)}</strong></div>
        <div><span className="muted" style={{ fontSize: 12 }}>Their edge: </span><strong>{specSummary(opp.specializations)}</strong></div>
      </div>
      <div style={{ marginTop: 8, fontSize: 13 }}>
        <span className="muted">Arena: </span><strong>{arena.name}</strong>
        {kinds.length === 0
          ? ' — clear ground, no hazards.'
          : ` — ${kinds.map((k) => HAZARD_LABEL[k]).join(' & ')}. ${kinds.map((k) => HAZARD_DESC[k]).join(' ')}`}
      </div>

      {/* Recon dossier — how much shows is gated by the Recon Network. */}
      <div style={{ marginTop: 10, borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 8 }}>
        <div className="spread">
          <strong style={{ fontSize: 12 }}>Recon dossier</strong>
          <span className="muted" style={{ fontSize: 11 }}>Network Lvl {reconLevel} · {DETAIL_TEXT[intel.detail]}</span>
        </div>
        <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
          Recent form: <strong>{form.length ? form.join(' ') : '—'}</strong> · likely to {TENDENCY_TEXT[intel.tendency]}.
        </div>
        {intel.detail === 'coarse' ? (
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
            Reads as a <strong>{CATEGORY_LABEL[intel.topCategory]}</strong>-strong side. Upgrade the Recon Network to project their line-up.
          </div>
        ) : (
          <>
            <div className="row" style={{ flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
              {CATEGORIES.map((c) => (
                <span key={c} className="tag" style={c === intel.topCategory ? { borderColor: 'var(--rival)' } : undefined}>
                  {CATEGORY_LABEL[c]} ~{intel.profile[c]}
                </span>
              ))}
            </div>
            <div style={{ marginTop: 6, fontSize: 12 }}>
              <span className="muted">Projected six: </span>
              {intel.projected.map((f, i) => (
                <span key={f.id}>
                  {i > 0 ? ', ' : ''}{f.name}
                  {intel.detail === 'detailed' ? ` (${CATEGORY_LABEL[fighterTopCategory(f)]})` : ''}
                </span>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** The team's last three results, newest first, as W/D/L from their view. */
function recentForm(game: GameState, teamId: string): string[] {
  return game.fixtures
    .filter((f) => f.played && (f.homeTeamId === teamId || f.awayTeamId === teamId))
    .sort((a, b) => b.week - a.week)
    .slice(0, 3)
    .map((f) => {
      const atHome = f.homeTeamId === teamId;
      const gf = (atHome ? f.homeScore : f.awayScore) ?? 0;
      const ga = (atHome ? f.awayScore : f.homeScore) ?? 0;
      return gf > ga ? 'W' : gf < ga ? 'L' : 'D';
    });
}

/** A persistent key for the arena's hazard zones, shown only when there are any. */
function HazardLegend({ arena }: { arena: Arena }) {
  const kinds = [...new Set((arena.hazards ?? []).map((h) => h.kind))];
  if (kinds.length === 0) return null;
  return (
    <div className="panel" style={{ padding: '6px 10px', minWidth: 160, fontSize: 11 }}>
      <strong style={{ fontSize: 12 }}>Arena hazards</strong>
      {kinds.map((k) => (
        <div key={k} className="muted" style={{ marginTop: 4 }}>
          {k === 'plasma' ? '◍' : '◎'} {HAZARD_LABEL[k]}: {HAZARD_DESC[k]}
        </div>
      ))}
    </div>
  );
}

/** Explains the little marks the dot renderer draws around fighters mid-action. */
function ActionLegend() {
  return (
    <div className="panel" style={{ padding: '6px 10px', minWidth: 160, fontSize: 11 }}>
      <strong style={{ fontSize: 12 }}>Reading the field</strong>
      <div className="muted" style={{ marginTop: 4 }}>⟶ bright tracer: firing ranged</div>
      <div className="muted">⟶ yellow spike: striking in melee</div>
      <div className="muted">○ dashed ring: guarding the zone</div>
      <div className="muted">▷ wedge: chasing a target</div>
      <div className="muted">× cross: down</div>
    </div>
  );
}

/** The squad's numbers next to names, so the dots on the field are identifiable. */
function RosterLegend({
  team,
  fighters,
  numbers,
  isPlayer,
}: {
  team: Team;
  fighters: Fighter[];
  numbers: Record<string, number>;
  isPlayer: boolean;
}) {
  return (
    <div className="panel" style={{ padding: '6px 10px', minWidth: 160 }}>
      <strong className={isPlayer ? 'player' : 'rival'} style={{ fontSize: 12 }}>{team.name}</strong>
      {specSummary(team.specializations) !== '—' && (
        <div className="muted" style={{ fontSize: 10, marginTop: 2 }}>Spec: {specSummary(team.specializations)}</div>
      )}
      <div style={{ marginTop: 4 }}>
        {fighters.map((f) => (
          <div key={f.id} className="muted" style={{ fontSize: 11 }}>
            {numbers[f.id]}. {f.name}
          </div>
        ))}
      </div>
    </div>
  );
}
