/**
 * Live match ticker: narrate the engine's event stream as playback advances.
 *
 * Single responsibility: pure presentation of MatchEvent[] — it phrases the
 * coarse events the engine already emitted and shows those whose tick has
 * passed. It computes nothing about the match; it only reads engine output and
 * a name lookup. Swap it for a text log and the engine is untouched.
 */

import { MatchEvent, Side } from '../../engine/types';

/** Turn one engine event into a short broadcast line. */
export function eventLine(
  e: MatchEvent,
  nameOf: (id: string) => string,
  teamName: Record<Side, string>,
): { icon: string; text: string; side: Side | null } {
  switch (e.kind) {
    case 'first-blood':
      return { icon: '🩸', text: `First blood to ${teamName[e.side]}`, side: e.side };
    case 'objective-flip':
      return { icon: '⚑', text: `${teamName[e.side]} seize the objective`, side: e.side };
    case 'down': {
      const victim = nameOf(e.victim);
      if (e.cause === 'hazard') return { icon: '☠', text: `${victim} falls to the arena`, side: null };
      const verb = e.cause === 'ranged' ? 'guns down' : 'downs';
      return { icon: '⚡', text: e.credit ? `${nameOf(e.credit)} ${verb} ${victim}` : `${victim} goes down`, side: null };
    }
    case 'shaken':
      return { icon: '😰', text: `${nameOf(e.fighter)} is rattled`, side: null };
  }
}

export function MatchTicker({
  events,
  tick,
  nameOf,
  teamName,
  playerSide,
}: {
  events: MatchEvent[];
  /** Current playback tick; only events at or before it are shown. */
  tick: number;
  nameOf: (id: string) => string;
  teamName: Record<Side, string>;
  playerSide: Side;
}) {
  // Newest first, capped — a ticker, not a transcript.
  const shown = events.filter((e) => e.t <= tick).slice(-6).reverse();
  return (
    <div className="panel ticker" aria-live="polite" style={{ minWidth: 220, maxWidth: 320, alignSelf: 'stretch' }}>
      <strong style={{ fontSize: 12 }}>Commentary</strong>
      {shown.length === 0 ? (
        <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>Awaiting the first exchange…</div>
      ) : (
        shown.map((e, i) => {
          const line = eventLine(e, nameOf, teamName);
          const cls = line.side ? (line.side === playerSide ? 'player' : 'rival') : 'muted';
          return (
            <div key={`${e.t}-${i}`} style={{ fontSize: 11, marginTop: 4 }}>
              <span style={{ opacity: 0.7 }}>{Math.round(e.t / 10)}s </span>
              <span aria-hidden>{line.icon} </span>
              <span className={cls}>{line.text}</span>
            </div>
          );
        })
      )}
    </div>
  );
}
