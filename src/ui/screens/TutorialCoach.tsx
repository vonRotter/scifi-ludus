/**
 * Tutorial coach: a small guided overlay that walks a new player through the
 * core loop on a real (curated) game.
 *
 * Single responsibility: present the current tutorial step and let the player
 * step through / jump to the relevant screen. It reads the route and calls
 * navigate + endTutorial, but holds no game rules — the guidance is static
 * content and the game underneath is an ordinary session.
 */

import { useEffect, useState } from 'react';
import type { Navigate, Route } from '../../App';
import { GameState } from '../../state/gameState';
import { endTutorial } from '../../state/gameStore';

interface Step {
  /** The screen this step is about; a shortcut button jumps here. */
  target?: Route['name'];
  /** Label for the jump button (omit to show no shortcut, e.g. the live match). */
  goLabel?: string;
  title: string;
  body: string;
}

const STEPS: Step[] = [
  {
    target: 'fixtures', goLabel: 'Schedule',
    title: 'Welcome to LUDUS',
    body: 'You run a stable of arena fighters through a season against three rival syndicates. The Schedule tab is your fixtures list — next match on top. Let’s get you match-ready.',
  },
  {
    target: 'lineup', goLabel: 'Line-up',
    title: 'Set your line-up & tactics',
    body: 'Your Squad is everyone you employ; your Line-up is the six who actually take the field. On the Line-up tab, pick your six, then set Posture (how aggressively you fight), Focus (melee / ranged / objective) and each fighter’s Role. Save when you’re happy.',
  },
  {
    target: 'fixtures', goLabel: 'Schedule',
    title: 'Play your first match',
    body: 'Back on the Schedule tab, hit “Play Match →”. You’ll watch the bout play out as neon dots — closer, wounded and dangerous enemies draw fire, tired fighters dim, and rattled ones wobble and pull back.',
  },
  {
    target: 'match',
    title: 'Half-time is your one big call',
    body: 'At half-time you get a single adjustment: change posture/focus, re-assign roles, and bring on up to two fresh reserves. Watch the commentary and the swings, then Confirm the result.',
  },
  {
    target: 'fixtures', goLabel: 'Schedule',
    title: 'Build the stable',
    body: 'Between matches (grouped in the nav): under Team you Train and Recruit; under Stable you upgrade Facilities and chase Contracts; under Season you follow the Table, Cup and News. Scout rivals before you face them.',
  },
  {
    title: 'You’re ready, lanista',
    body: 'That’s the loop: watch → understand → adjust → win. Finish here to keep playing this season, or start a fresh one anytime from the menu. Good luck in the pits.',
  },
];

const KEY = 'ludus-tutorial-step';

export function TutorialCoach({ route, navigate }: { game: GameState; route: Route; navigate: Navigate }) {
  const [step, setStep] = useState<number>(() => {
    try { return Math.max(0, Math.min(STEPS.length - 1, Number(localStorage.getItem(KEY)) || 0)); } catch { return 0; }
  });
  const [open, setOpen] = useState(true);
  useEffect(() => { try { localStorage.setItem(KEY, String(step)); } catch { /* ignore */ } }, [step]);

  const s = STEPS[step];
  const last = step >= STEPS.length - 1;
  const showJump = s.goLabel && s.target && route.name !== s.target;

  const finish = () => {
    try { localStorage.removeItem(KEY); } catch { /* ignore */ }
    endTutorial();
  };

  if (!open) {
    return (
      <button type="button" className="coach-fab" onClick={() => setOpen(true)} title="Reopen the tutorial">
        🎓 Tutorial
      </button>
    );
  }

  return (
    <div className="coach" role="dialog" aria-label="Tutorial">
      <div className="spread">
        <strong style={{ fontSize: 12, letterSpacing: 1 }}>🎓 TUTORIAL · {step + 1}/{STEPS.length}</strong>
        <button type="button" className="coach-min" onClick={() => setOpen(false)} aria-label="Minimize tutorial">▾</button>
      </div>
      <div style={{ fontWeight: 700, marginTop: 4 }}>{s.title}</div>
      <div className="muted" style={{ fontSize: 13, marginTop: 4, lineHeight: 1.5 }}>{s.body}</div>
      <div className="spread" style={{ marginTop: 10 }}>
        <button type="button" className="btn ghost" onClick={finish}>End tutorial</button>
        <div className="row" style={{ gap: 6 }}>
          {step > 0 && <button type="button" className="btn ghost" onClick={() => setStep(step - 1)}>Back</button>}
          {showJump && (
            <button type="button" className="btn ghost" onClick={() => navigate({ name: s.target } as Route)}>
              Go to {s.goLabel}
            </button>
          )}
          {last
            ? <button type="button" className="btn" onClick={finish}>Finish ✓</button>
            : <button type="button" className="btn" onClick={() => setStep(step + 1)}>Next →</button>}
        </div>
      </div>
    </div>
  );
}
