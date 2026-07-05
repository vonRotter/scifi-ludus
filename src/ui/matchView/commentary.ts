/**
 * Commentary generator: turn the engine's event stream into a two-caster call.
 *
 * Single responsibility: PURE FLAVOUR TEXT over already-deterministic engine
 * output (a round's MatchEvent[] + its score-carrying frames). It's the booth's
 * script — like labels.ts, it decides how the match *sounds*, never what
 * happened. No engine rules, no state, no Math.random: variety comes from a
 * hash of each line's tick, so a replay of the same seed reads word-for-word
 * the same. Also owns the tiny on/off preference (localStorage), mirroring audio.ts.
 */

import { makeRng } from '../../engine/rng';
import { Frame, MatchEvent, Side } from '../../engine/types';

/** Who's talking: the play-by-play caller or the colour analyst. */
export type Caster = 'play' | 'color';

export interface CommentaryLine {
  t: number;
  speaker: Caster;
  text: string;
}

export interface CommentaryCtx {
  nameOf: (id: string) => string;
  teamName: Record<Side, string>;
  playerSide: Side;
  arenaName: string;
  round: 1 | 2;
}

// --- Preference (default on), persisted exactly like the sound toggle. --------
const KEY = 'ludus-commentary';
export function isCommentaryOn(): boolean {
  try { return localStorage.getItem(KEY) !== 'off'; } catch { return true; }
}
export function setCommentaryOn(on: boolean): void {
  try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* ignore */ }
}

/** Deterministic coin-flip for whether the colour man chimes in. */
function chime(t: number, salt: number): boolean {
  return makeRng(((t * 668265263) ^ salt) >>> 0).next() < 0.55;
}

// --- Template pools -----------------------------------------------------------

const OPEN_PLAY = [
  (a: string) => `Welcome to ${a} — the pits are packed and the plasma's humming!`,
  (a: string) => `Live from ${a}, and this crowd is ready for blood!`,
  (a: string) => `We are GO in ${a}. Six on six, no quarter asked.`,
];
const OPEN_COLOR = [
  (h: string, w: string) => `Two stables with everything to prove, ${w}. ${h} did NOT come here to lose.`,
  (_h: string, w: string) => `I've seen a hundred of these, ${w}, and I still get chills. Watch the corps pride out there.`,
  (_h: string, _w: string) => `Whoever blinks first loses this one. Simple as that.`,
];
const OPEN_R2_PLAY = [
  () => `And we are back underway for round two!`,
  () => `Round two, here we go — halftime's over, gloves are off.`,
  () => `They've regrouped, they've re-tooled — round two is LIVE.`,
];

const FIRST_BLOOD = [
  (team: string) => `FIRST BLOOD to ${team}! The stands go up!`,
  (team: string) => `${team} draw first — and this place ERUPTS!`,
  (team: string) => `There it is — first down of the match, and it's ${team}!`,
];

const DOWN_MELEE = [
  (k: string, v: string) => `${k} buries the blade — ${v} is DOWN!`,
  (k: string, v: string) => `Oh, ${k} put ${v} in the dirt with that one!`,
  (k: string, v: string) => `${v} never saw it coming — ${k} drops the hammer!`,
];
const DOWN_RANGED = [
  (k: string, v: string) => `${k} lines it up and ${v} crumples — clean shot!`,
  (k: string, v: string) => `From range! ${k} guns down ${v}!`,
  (k: string, v: string) => `${v} caught in the open and ${k} makes them pay!`,
];
const DOWN_HAZARD = [
  (v: string) => `The arena claims ${v}! Ohh, that's a nasty way to go.`,
  (v: string) => `${v} strays too close and the field does the rest — DOWN!`,
  (v: string) => `Never turn your back on the vents — ${v} learns the hard way!`,
];
const DOWN_COLOR = [
  (v: string) => `That'll leave a mark. ${v} won't be walking that off.`,
  (_v: string) => `Textbook. You LOVE to see it — well, unless it's your fighter.`,
  (_v: string) => `And THAT is what separates the stables from the scrap.`,
  (v: string) => `Somebody get the medbay warmed up for ${v}.`,
];

const FLIP = [
  (team: string) => `${team} surge into the zone and TAKE control!`,
  (team: string) => `Momentum shift — ${team} own the objective now!`,
  (team: string) => `${team} plant their flag in the middle of the pit!`,
];
const PULLING_AWAY = [
  (team: string) => `${team} are pulling away here — this could get ugly.`,
  (team: string) => `${team} have found another gear. The others need an answer, fast.`,
];
const CLAWBACK = [
  (team: string) => `${team} clawing it back! Don't write them off yet!`,
  (team: string) => `Here come ${team}! What a response!`,
];
const TENSION = [
  () => `Nothing between them and the clock is bleeding out — anyone's match!`,
  () => `You could cut this tension with a vibroblade. Down to the wire!`,
];
const LULL = [
  () => `Both packs circling, feeling each other out.`,
  () => `A tense lull — nobody wants to overcommit here.`,
  () => `Feints and footwork, the crowd getting restless.`,
];

// --- Generation ---------------------------------------------------------------

/**
 * Build the booth's call for one round. Merges three deterministic passes —
 * the opening, the play-by-play over events, and colour reads of the scoreline
 * arc from the frames — into one timeline sorted by tick.
 */
export function generateCommentary(
  events: MatchEvent[],
  frames: Frame[],
  ctx: CommentaryCtx,
): CommentaryLine[] {
  const lines: CommentaryLine[] = [];
  const { nameOf, teamName } = ctx;
  const homeName = teamName.home;
  const rivalName = teamName[ctx.playerSide === 'home' ? 'away' : 'home'];

  // 1. Opening.
  if (ctx.round === 2) {
    lines.push({ t: 0, speaker: 'play', text: pick2(OPEN_R2_PLAY, 0, 1)() });
  } else {
    lines.push({ t: 0, speaker: 'play', text: pick2(OPEN_PLAY, 0, 1)(ctx.arenaName) });
    lines.push({ t: 1, speaker: 'color', text: pick2(OPEN_COLOR, 1, 2)(homeName, rivalName) });
  }

  // 2. Play-by-play over the events, with the odd colour reaction.
  for (const e of events) {
    if (e.kind === 'first-blood') {
      lines.push({ t: e.t, speaker: 'play', text: pick2(FIRST_BLOOD, e.t, 3)(teamName[e.side]) });
    } else if (e.kind === 'objective-flip') {
      lines.push({ t: e.t, speaker: 'play', text: pick2(FLIP, e.t, 4)(teamName[e.side]) });
    } else if (e.kind === 'down') {
      const victim = nameOf(e.victim);
      if (e.cause === 'hazard') {
        lines.push({ t: e.t, speaker: 'play', text: pick2(DOWN_HAZARD, e.t, 5)(victim) });
      } else {
        const pool = e.cause === 'ranged' ? DOWN_RANGED : DOWN_MELEE;
        const killer = e.credit ? nameOf(e.credit) : 'Someone';
        lines.push({ t: e.t, speaker: 'play', text: pick2(pool, e.t, 6)(killer, victim) });
      }
      if (chime(e.t, 8)) {
        lines.push({ t: e.t, speaker: 'color', text: pick2(DOWN_COLOR, e.t, 7)(victim) });
      }
    }
  }

  // 3. Colour reads of the scoreline arc from the frames.
  addArcLines(lines, frames, teamName);

  return lines.sort((a, b) => a.t - b.t);
}

/** A pick that returns the chosen template *function* from a pool. */
function pick2<T>(pool: readonly T[], t: number, salt: number): T {
  return makeRng(((t * 2654435761) ^ (salt * 40503)) >>> 0).pick(pool);
}

/**
 * Walk the frames and narrate the shape of the game: a side pulling away, the
 * trailing side clawing back, and late tension when it's close. Throttled so
 * the colour man doesn't talk over himself, and driven only by score deltas.
 */
function addArcLines(lines: CommentaryLine[], frames: Frame[], teamName: Record<Side, string>): void {
  if (frames.length < 2) return;
  const lastT = frames[frames.length - 1].t;
  let lastSpoke = -200;
  let peakMargin = 0; // widest lead seen so far (signed: + = home ahead)
  let saidTension = false;

  for (const f of frames) {
    const margin = f.homeScore - f.awayScore;
    if (Math.abs(margin) > Math.abs(peakMargin)) peakMargin = margin;

    if (f.t - lastSpoke < 90) continue;

    // Pulling away: a fresh, decisive lead.
    if (Math.abs(margin) >= 16 && Math.abs(margin) >= Math.abs(peakMargin)) {
      const leader = margin > 0 ? teamName.home : teamName.away;
      lines.push({ t: f.t, speaker: 'color', text: pick2(PULLING_AWAY, f.t, 9)(leader) });
      lastSpoke = f.t;
      continue;
    }
    // Clawing back: the deficit has shrunk a lot from its peak.
    if (Math.abs(peakMargin) >= 16 && Math.abs(margin) <= Math.abs(peakMargin) - 8 && Math.abs(margin) >= 2) {
      const chaser = peakMargin > 0 ? teamName.away : teamName.home;
      lines.push({ t: f.t, speaker: 'color', text: pick2(CLAWBACK, f.t, 10)(chaser) });
      lastSpoke = f.t;
      continue;
    }
    // Late tension in a tight match.
    if (!saidTension && f.t >= lastT * 0.8 && Math.abs(margin) <= 6) {
      lines.push({ t: f.t, speaker: 'play', text: pick2(TENSION, f.t, 11)() });
      saidTension = true;
      lastSpoke = f.t;
    }
  }

  // A single early lull line if the opening stretch was quiet.
  const firstEventT = lines.reduce((m, l) => (l.t > 1 ? Math.min(m, l.t) : m), Infinity);
  if (firstEventT === Infinity || firstEventT > 120) {
    lines.push({ t: 60, speaker: 'color', text: pick2(LULL, 60, 12)() });
  }
}
