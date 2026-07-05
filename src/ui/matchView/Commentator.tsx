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

export function Commentator({ lines, tick }: { lines: CommentaryLine[]; tick: number }) {
  const shown = lines.filter((l) => l.t <= tick).slice(-5);
  const feedRef = useRef<HTMLDivElement>(null);

  // Keep the newest line in view as the booth talks.
  useEffect(() => {
    const el = feedRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [shown.length]);

  return (
    <div className="panel" style={{ marginTop: 8, padding: '8px 12px' }}>
      <div className="spread" style={{ marginBottom: 4 }}>
        <strong style={{ fontSize: 12, letterSpacing: 1 }}>🎙 THE BOOTH</strong>
        <span className="muted" style={{ fontSize: 10 }}>
          <span style={{ color: CASTERS.play.color }}>{CASTERS.play.name}</span>
          {' · '}
          <span style={{ color: CASTERS.color.color }}>{CASTERS.color.name}</span>
        </span>
      </div>
      <div ref={feedRef} aria-live="polite" style={{ maxHeight: 96, overflowY: 'auto', fontSize: 12, lineHeight: 1.5 }}>
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
