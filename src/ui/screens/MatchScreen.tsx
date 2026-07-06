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
import { GameState, NewsItem, teamById } from '../../state/gameState';
import { getState, recordMatch, saveLineup } from '../../state/gameStore';
import { buildMatchInputs, benchSquad } from '../../state/matchSetup';
import { simulateMatch } from '../../engine/match/simulate';
import { SQUAD_SIZE } from '../../engine/constants';
import { Arena, Category, CATEGORIES, Fighter, Focus, Lineup, Role, Side, Team } from '../../engine/types';
import { LineupEditor } from './LineupEditor';
import { categoryScores } from '../../engine/attributes';
import { corpByKey } from '../../engine/corporations';
import { adjustTactics, personalityOf } from '../../engine/ai';
import { fighterTopCategory, OpponentIntel, readOpponent } from '../../engine/intel';
import {
  CATEGORY_LABEL, FOCUS_LABEL, HAZARD_DESC, HAZARD_LABEL, lanistaBlurb, POSTURE_LABEL, ROLE_LABEL, specSummary,
} from '../labels';
import { DotField } from '../matchView/DotField';
import { MatchTicker } from '../matchView/MatchTicker';
import { Commentator } from '../matchView/Commentator';
import { generateCommentary, isCommentaryOn, setCommentaryOn } from '../matchView/commentary';
import { MatchReport } from './MatchReport';
import { HalfTimeAdjust, Round2Config } from './HalfTimeAdjust';
import { isSoundOn, playDown, setSoundOn, startMatchAmbience, stopMatchAmbience } from '../matchView/audio';
import { SPEEDS, useFramePlayer } from '../matchView/useFramePlayer';
import { Navigate } from '../../App';

type Phase = 'lineup' | 'preview' | 'round1' | 'halftime' | 'round2' | 'done';

export function MatchScreen({
  game,
  fixtureId,
  navigate,
  onMatchComplete,
}: {
  game: GameState;
  fixtureId: string;
  navigate: Navigate;
  /** Fresh news the match generated, handed up so it can pop for the player. */
  onMatchComplete?: (news: NewsItem[]) => void;
}) {
  const fixture = game.fixtures.find((f) => f.id === fixtureId)!;
  const inputs = useMemo(() => buildMatchInputs(game, fixture), [game, fixtureId]);
  const playerSide: Side = fixture.homeTeamId === game.playerTeamId ? 'home' : 'away';
  const ownTactics = inputs[playerSide].tactics;

  const result1 = useMemo(
    () => simulateMatch(inputs.home, inputs.away, inputs.arena, fixture.seed),
    [inputs, fixture.seed],
  );

  const [phase, setPhase] = useState<Phase>('lineup');
  // The player's editable line-up for this match — team selection is step one.
  const [draft, setDraft] = useState<Lineup>(game.playerLineup);
  const [result2, setResult2] = useState(result1);
  // Round-two substitutions the player made at half-time (null until they do).
  const [round2Info, setRound2Info] = useState<{ fighters: Fighter[]; subbedInIds: string[] } | null>(null);
  const [soundOn, setSoundOnState] = useState(isSoundOn());
  const [boothOn, setBoothOn] = useState(isCommentaryOn());
  // Show your own fighters' roles + stats under the field (a "who's who" you can
  // check any time, especially while paused).
  const [showStats, setShowStats] = useState(false);

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

  // The ambient bed plays only while a round is live; stop it otherwise and on leave.
  useEffect(() => {
    if (soundOn && (phase === 'round1' || phase === 'round2')) startMatchAmbience();
    else stopMatchAmbience();
  }, [phase, soundOn]);
  useEffect(() => () => stopMatchAmbience(), []);

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

  // Fit reserves the player may bring on at half-time.
  const bench = useMemo(
    () => benchSquad(game, game.playerTeamId, inputs[playerSide].fighters.map((f) => f.id)),
    [game, inputs, playerSide],
  );

  // Numbers extended with any subbed-in fighters (7, 8), so their round-two dots
  // and report rows are still identifiable.
  const numbersAll = useMemo(() => {
    if (!round2Info) return numbers;
    const ext = { ...numbers };
    round2Info.subbedInIds.forEach((id, i) => (ext[id] = 7 + i));
    return ext;
  }, [numbers, round2Info]);
  const subbedInFighters = round2Info
    ? round2Info.fighters.filter((f) => round2Info.subbedInIds.includes(f.id))
    : [];

  // Name lookup and side->team-name map, so the ticker can narrate the engine's
  // event stream without the engine ever knowing a fighter's name.
  const nameOf = useMemo(() => {
    const map: Record<string, string> = {};
    [...inputs.home.fighters, ...inputs.away.fighters].forEach((f) => (map[f.id] = f.name));
    return (id: string) => map[id] ?? '?';
  }, [inputs]);
  const teamName: Record<Side, string> = { home: home.name, away: away.name };
  // Round two owns the screen once it's under way AND after full-time; round one
  // otherwise (including at half-time, where you read back its full call).
  const isSecond = phase === 'round2' || phase === 'done';
  const activeRound = isSecond ? result2.rounds[1] : result1.rounds[0];
  const activeEvents = activeRound.events;

  // The booth's script for the active round — pure flavour over the same
  // deterministic events/frames the renderer consumes.
  const commentary = useMemo(
    () => generateCommentary(activeRound.events, activeRound.frames, {
      nameOf, teamName, playerSide, arenaName: inputs.arena.name, round: isSecond ? 2 : 1,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeRound, nameOf, playerSide, inputs.arena.name, isSecond],
  );

  const r1Home = result1.rounds[0].homeScore;
  const r1Away = result1.rounds[0].awayScore;
  const carried = phase === 'round2' || phase === 'done';
  const priorHome = carried ? r1Home : 0;
  const priorAway = carried ? r1Away : 0;
  const aggHome = priorHome + (phase === 'done' ? result2.rounds[1].homeScore : frame.homeScore);
  const aggAway = priorAway + (phase === 'done' ? result2.rounds[1].awayScore : frame.awayScore);
  // Split each side's running total into its two sources — points from downs
  // and points from holding the objective zone — so the scoring model is
  // visible live (the value of `objective` focus is otherwise the hardest to see).
  const homeDowns = (carried ? result1.rounds[0].homeDowns : 0) + (phase === 'done' ? result2.rounds[1].homeDowns : frame.homeDowns);
  const awayDowns = (carried ? result1.rounds[0].awayDowns : 0) + (phase === 'done' ? result2.rounds[1].awayDowns : frame.awayDowns);
  const homeZone = Math.max(0, aggHome - homeDowns);
  const awayZone = Math.max(0, aggAway - awayDowns);

  // The AI opponent adapts at the break, reacting to round one just as you can.
  const aiSide: Side = playerSide === 'home' ? 'away' : 'home';
  const aiAdjusted = useMemo(
    () => adjustTactics(inputs[aiSide].tactics, aiSide === 'home' ? r1Home : r1Away, aiSide === 'home' ? r1Away : r1Home, inputs[aiSide].fighters, personalityOf(oppTeam)),
    [inputs, aiSide, r1Home, r1Away, oppTeam],
  );
  const aiShifted = aiAdjusted.posture !== inputs[aiSide].tactics.posture || aiAdjusted.focus !== inputs[aiSide].tactics.focus;

  const startRound2 = (cfg: Round2Config) => {
    const subbed = cfg.subbedInIds.length > 0;
    const r2 = simulateMatch(inputs.home, inputs.away, inputs.arena, fixture.seed, {
      round2: {
        home: playerSide === 'home' ? cfg.tactics : aiAdjusted,
        away: playerSide === 'away' ? cfg.tactics : aiAdjusted,
      },
      round2Fighters: subbed
        ? playerSide === 'home' ? { home: cfg.fighters } : { away: cfg.fighters }
        : undefined,
    });
    setResult2(r2);
    if (subbed) setRound2Info({ fighters: cfg.fighters, subbedInIds: cfg.subbedInIds });
    setPhase('round2');
  };

  const confirm = () => {
    // Everyone who took the field earns an appearance — the starters plus any
    // fighter brought on at half-time.
    const fielded = round2Info ? [...inputs.fieldedIds, ...round2Info.subbedInIds] : inputs.fieldedIds;
    const beforeIds = new Set(game.news.map((n) => n.id));
    recordMatch(fixtureId, result2.homeScore, result2.awayScore, fielded, result2.stats);
    // Hand the just-filed headlines up so they pop before the player moves on.
    const fresh = (getState()?.news ?? []).filter((n) => !beforeIds.has(n.id));
    onMatchComplete?.(fresh);
    navigate({ name: 'fixtures' });
  };

  const aiLine = aiShifted
    ? `Opponent adjusts: ${POSTURE_LABEL[aiAdjusted.posture]} · ${FOCUS_LABEL[aiAdjusted.focus]}.`
    : undefined;

  // Step one of every match: pick your line-up and tactics. Confirming saves it
  // (so the sim below rebuilds from it) and moves on to the pre-match briefing.
  if (phase === 'lineup') {
    const valid = draft.fighterIds.length === SQUAD_SIZE;
    const confirmLineup = () => { saveLineup(draft); setPhase('preview'); };
    const cta = valid ? 'Confirm line-up →' : `Select ${SQUAD_SIZE - draft.fighterIds.length} more`;
    return (
      <div className="app">
        <div className="topbar">
          <h1 style={{ fontSize: 15 }}>{inputs.arena.name.toUpperCase()}</h1>
          <span className="sub">TEAM SELECTION</span>
          <button className="btn ghost" style={{ marginLeft: 'auto', padding: '2px 8px' }} onClick={() => navigate({ name: 'fixtures' })}>
            ← Back
          </button>
        </div>
        <div className="screen">
          <div className="spread">
            <h2 style={{ border: 'none', margin: 0 }}>
              Pick your line-up — <span className={playerSide === 'home' ? 'player' : 'rival'}>{home.name}</span> vs <span className={playerSide === 'away' ? 'player' : 'rival'}>{away.name}</span>
            </h2>
            <button className="btn big" disabled={!valid} onClick={confirmLineup}>{cta}</button>
          </div>
          <p className="muted">
            Choose the six who take the field, their roles, and your posture &amp; focus. You still get a half-time adjustment once the bout is under way.
          </p>
          <LineupEditor game={game} draft={draft} onChange={setDraft} />
          <div className="row" style={{ marginTop: 14, justifyContent: 'flex-end' }}>
            <button className="btn big" disabled={!valid} onClick={confirmLineup}>{cta}</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="topbar">
        <h1 style={{ fontSize: 15 }}>{inputs.arena.name.toUpperCase()}</h1>
        <span className="sub">
          {phase === 'preview' ? 'PRE-MATCH' : phase === 'halftime' ? 'HALF-TIME' : phase === 'done' ? 'FULL-TIME' : phase === 'round2' ? 'ROUND 2' : 'ROUND 1'}
        </span>
        <button
          type="button"
          className="btn ghost"
          style={{ marginLeft: 'auto', padding: '2px 8px' }}
          aria-pressed={boothOn}
          aria-label={boothOn ? 'Hide commentary' : 'Show commentary'}
          title={boothOn ? 'Commentary on' : 'Commentary off'}
          onClick={() => { const on = !boothOn; setCommentaryOn(on); setBoothOn(on); }}
        >
          {boothOn ? '🎙' : '🔕'}
        </button>
        <button
          type="button"
          className="btn ghost"
          style={{ padding: '2px 8px' }}
          aria-pressed={soundOn}
          aria-label={soundOn ? 'Mute match sound' : 'Unmute match sound'}
          title={soundOn ? 'Sound on' : 'Sound off'}
          onClick={() => { const on = !soundOn; setSoundOn(on); setSoundOnState(on); }}
        >
          {soundOn ? '🔊' : '🔇'}
        </button>
      </div>

      <div className="screen">
        <div className="scorebar" style={{ background: 'var(--bar)', flexWrap: 'wrap' }}>
          <span className={playerSide === 'home' ? 'player' : 'rival'} style={{ padding: '0 8px' }}>
            {home.name}
          </span>
          <span className="big">{aggHome} – {aggAway}</span>
          <span className={playerSide === 'away' ? 'player' : 'rival'} style={{ padding: '0 8px' }}>
            {away.name}
          </span>
          <div
            className="muted"
            style={{ flexBasis: '100%', textAlign: 'center', fontSize: 11, marginTop: 2 }}
            title="Points come from two sources: downing an opponent, and holding the objective zone. This splits each side's total between them."
          >
            <ScoreSplit downs={homeDowns} zone={homeZone} /> <span style={{ opacity: 0.5 }}>·</span> <ScoreSplit downs={awayDowns} zone={awayZone} />
          </div>
        </div>

        <div className="matchstage" style={{ display: 'flex', gap: 10, alignItems: 'stretch', justifyContent: 'center' }}>
          <DotField arena={inputs.arena} frame={frame} playerSide={playerSide} numbers={numbersAll} onDown={() => soundOn && playDown()} />
          {(phase === 'round1' || phase === 'round2') && (
            <MatchTicker events={activeEvents} tick={frame.t} nameOf={nameOf} teamName={teamName} playerSide={playerSide} />
          )}
        </div>

        {/* Primary action sits DIRECTLY under the map, so on a phone you never
            scroll to start a round, confirm, or reach the playback controls. */}
        <div className="row" style={{ marginTop: 10, justifyContent: 'center' }}>
          {phase === 'preview' && (
            <button className="btn big" onClick={() => setPhase('round1')}>Start Round 1 →</button>
          )}
          {(phase === 'round1' || phase === 'round2') && (
            <>
              <button className="btn ghost" onClick={() => (player.playing ? player.pause() : player.play())}>
                {player.playing ? 'Pause' : 'Play'}
              </button>
              <div className="row" style={{ gap: 4 }} role="group" aria-label="Playback speed">
                {SPEEDS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={`pill${player.speed === s ? ' on' : ''}`}
                    aria-pressed={player.speed === s}
                    title={`Play at ${s}× speed`}
                    onClick={() => player.setSpeed(s)}
                  >
                    {s}×
                  </button>
                ))}
              </div>
              <input
                type="range"
                min={0}
                max={frames.length - 1}
                value={Math.min(player.index, frames.length - 1)}
                aria-label="Scrub the match timeline"
                title="Scrub the timeline"
                style={{ flex: 1, minWidth: 160, maxWidth: 320 }}
                onChange={(e) => player.seek(Number(e.target.value))}
              />
              <button className="btn" onClick={() => player.skip()}>Skip ⏭</button>
            </>
          )}
          {phase === 'done' && (
            <button className="btn big" onClick={confirm}>Confirm Result →</button>
          )}
        </div>

        {phase === 'halftime' && (
          <HalfTimeAdjust
            fielded={inputs[playerSide].fighters}
            bench={bench}
            base={ownTactics}
            numbers={numbers}
            r1Home={r1Home}
            r1Away={r1Away}
            aiLine={aiLine}
            onStart={startRound2}
          />
        )}

        {boothOn && phase !== 'preview' && (
          <Commentator lines={commentary} tick={frame.t} full={phase === 'halftime' || phase === 'done'} />
        )}

        <div className="row" style={{ marginTop: 8, justifyContent: 'center' }}>
          <button type="button" className={`pill${showStats ? ' on' : ''}`} aria-pressed={showStats} onClick={() => setShowStats((v) => !v)}>
            {showStats ? 'Hide' : 'Show'} your squad’s stats
          </button>
        </div>
        <div className="row" style={{ marginTop: 8, gap: 24, justifyContent: 'center', alignItems: 'flex-start' }}>
          <RosterLegend team={home} fighters={inputs.home.fighters} numbers={numbers} isPlayer={playerSide === 'home'} roles={inputs.home.tactics.roles} showStats={showStats} />
          <ActionLegend />
          <HazardLegend arena={inputs.arena} />
          <RosterLegend team={away} fighters={inputs.away.fighters} numbers={numbers} isPlayer={playerSide === 'away'} roles={inputs.away.tactics.roles} showStats={showStats} />
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

        {phase === 'done' && (
          <MatchReport
            home={home}
            away={away}
            homeFighters={playerSide === 'home' ? [...inputs.home.fighters, ...subbedInFighters] : inputs.home.fighters}
            awayFighters={playerSide === 'away' ? [...inputs.away.fighters, ...subbedInFighters] : inputs.away.fighters}
            numbers={numbersAll}
            stats={result2.stats}
            ratings={result2.ratings}
            playerSide={playerSide}
          />
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
  const pulsing = (arena.hazards ?? []).some((h) => h.period && h.duty !== undefined);
  return (
    <div className="panel" style={{ marginTop: 12 }}>
      <h3 style={{ marginTop: 0 }}>Pre-match briefing</h3>
      <div className="muted" style={{ fontSize: 13 }}>
        Facing <strong className="rival">{opp.name}</strong>, backed by {oppCorp.name} — {CATEGORY_LABEL[oppCorp.specialty]} specialists.
      </div>
      {opp.lanista && opp.personality && (
        <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
          Run by <strong>{opp.lanista}</strong> — they tend to {lanistaBlurb(opp.personality)}.
        </div>
      )}
      <div className="row" style={{ flexWrap: 'wrap', marginTop: 8, gap: 20 }}>
        <div><span className="muted" style={{ fontSize: 12 }}>Your edge: </span><strong>{specSummary(you.specializations)}</strong></div>
        <div><span className="muted" style={{ fontSize: 12 }}>Their edge: </span><strong>{specSummary(opp.specializations)}</strong></div>
      </div>
      <div style={{ marginTop: 8, fontSize: 13 }}>
        <span className="muted">Arena: </span><strong>{arena.name}</strong>
        {kinds.length === 0
          ? ' — clear ground, no hazards.'
          : ` — ${kinds.map((k) => HAZARD_LABEL[k]).join(' & ')}. ${kinds.map((k) => HAZARD_DESC[k]).join(' ')}${pulsing ? ' These vents pulse on a cycle — time your crossing for when they go dark.' : ''}`}
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
/** A side's score broken into its two sources: downs (⚔) and objective zone (◎). */
function ScoreSplit({ downs, zone }: { downs: number; zone: number }) {
  return (
    <span>
      <span style={{ color: 'var(--rival)' }}>{downs}⚔</span>
      {' '}downs + {' '}
      <span style={{ color: 'var(--good)' }}>{zone}◎</span>
      {' '}zone
    </span>
  );
}

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
      <div className="muted">◍ dim glow: tiring (low stamina)</div>
      <div className="muted">× cross: down</div>
    </div>
  );
}

/** Short category codes for the in-match stat reference. */
const CAT_CODE: Record<Category, string> = {
  melee: 'ME', ranged: 'RA', defence: 'DE', mental: 'MN', speed: 'SP',
};

/**
 * The squad's numbers next to names, so the dots on the field are identifiable.
 * For the player's own side, an optional stat line (role + category scores) so
 * you can remember who each number is and what they do — handy while paused.
 */
function RosterLegend({
  team,
  fighters,
  numbers,
  isPlayer,
  roles,
  showStats,
}: {
  team: Team;
  fighters: Fighter[];
  numbers: Record<string, number>;
  isPlayer: boolean;
  roles?: Record<string, Role>;
  showStats?: boolean;
}) {
  const detailed = isPlayer && showStats;
  return (
    <div className="panel" style={{ padding: '6px 10px', minWidth: detailed ? 230 : 160 }}>
      <strong className={isPlayer ? 'player' : 'rival'} style={{ fontSize: 12 }}>{team.name}</strong>
      {specSummary(team.specializations) !== '—' && (
        <div className="muted" style={{ fontSize: 10, marginTop: 2 }}>Spec: {specSummary(team.specializations)}</div>
      )}
      <div style={{ marginTop: 4 }}>
        {fighters.map((f) => {
          const scores = detailed ? categoryScores(f.subStats) : null;
          return (
            <div key={f.id} style={{ marginTop: detailed ? 5 : 0 }}>
              <div className="muted" style={{ fontSize: 11 }}>
                {numbers[f.id]}. {f.name}
                {detailed && roles && <span style={{ color: 'var(--accent)' }}> · {ROLE_LABEL[roles[f.id] ?? 'frontline']}</span>}
              </div>
              {scores && (
                <div className="muted" style={{ fontSize: 10, fontVariantNumeric: 'tabular-nums', letterSpacing: 0.3 }}>
                  {CATEGORIES.map((c) => `${CAT_CODE[c]} ${Math.round(scores[c])}`).join('  ')}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
