/**
 * The commentary booth: a two-caster broadcast feed over the match.
 *
 * Single responsibility: pure presentation of CommentaryLine[] as playback
 * advances — it shows the lines whose tick has passed, attributed to the two
 * named casters. It generates nothing; the script comes from commentary.ts,
 * which itself only reads engine output. Toggle it off and the match is silent.
 */

import { useEffect, useRef } from 'react';
import { Caster, CommentaryLine } from './commentary';

/** The two personalities in the booth: a play-by-play caller and a colour man. */
const CASTERS: Record<Caster, { name: string; color: string }> = {
  play: { name: 'VAYLE', color: 'var(--cyan)' },
  color: { name: 'KRUNG', color: '#e0a44a' },
};

export function Commentator({ lines, tick, full }: { lines: CommentaryLine[]; tick: number; full?: boolean }) {
  // During playback show what's been said so far; when the round is over (half-
  // time / full-time) show the whole call so you can read back through it.
  const shown = full ? lines : lines.filter((l) => l.t <= tick);
  const feedRef = useRef<HTMLDivElement>(null);

  // Follow the newest line while the match is live; once it's over, leave the
  // scroll alone so you can read from the top at your own pace.
  useEffect(() => {
    if (full) return;
    const el = feedRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [shown.length, full]);

  return (
    <div className="panel" style={{ marginTop: 8, padding: '8px 12px' }}>
      <div className="spread" style={{ marginBottom: 4 }}>
        <strong style={{ fontSize: 12, letterSpacing: 1 }}>🎙 THE BOOTH{full ? ' — FULL CALL' : ''}</strong>
        <span className="muted" style={{ fontSize: 10 }}>
          <span style={{ color: CASTERS.play.color }}>{CASTERS.play.name}</span>
          {' · '}
          <span style={{ color: CASTERS.color.color }}>{CASTERS.color.name}</span>
        </span>
      </div>
      <div ref={feedRef} aria-live="polite" style={{ maxHeight: full ? 220 : 150, overflowY: 'auto', fontSize: 12, lineHeight: 1.6 }}>
        {shown.length === 0 ? (
          <div className="muted" style={{ fontSize: 11 }}>The booth settles in…</div>
        ) : (
          shown.map((l, i) => {
            const c = CASTERS[l.speaker];
            return (
              <div key={`${l.t}-${i}`} style={{ marginTop: i ? 3 : 0 }}>
                <strong style={{ color: c.color, marginRight: 6 }}>{c.name}:</strong>
                <span>{l.text}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
