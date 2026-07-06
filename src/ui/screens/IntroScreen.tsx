/**
 * First-run intro: a one-time welcome that frames the core loop for a new
 * manager, shown by App until dismissed (the flag lives in the save). Full
 * takeover. Presentation + one store action (dismissIntro) only.
 */

import { GameState, playerTeam } from '../../state/gameState';
import { dismissIntro } from '../../state/gameStore';
import { corpByKey } from '../../engine/corporations';

export function IntroScreen({ game }: { game: GameState }) {
  const team = playerTeam(game);
  const corp = corpByKey(team.corpKey);

  return (
    <div className="app">
      <div className="menu wide">
        <div className="title">LUDUS</div>
        <div className="tagline">WELCOME, MANAGER</div>
        <div className="panel" style={{ textAlign: 'left' }}>
          <p style={{ marginTop: 0 }}>
            You've taken charge of <strong>{team.name}</strong>, backed by <strong>{corp.name}</strong>.
            You run the stable; your fighters run the arena. Here's the loop:
          </p>
          <ul style={{ lineHeight: 1.7, paddingLeft: 18 }}>
            <li><strong>Play your matches.</strong> Pick six fighters and their tactics on <em>Line-up</em>, then watch the bout as moving dots. You get one <strong>half-time</strong> adjustment — and your opponent adapts too.</li>
            <li><strong>Build the squad.</strong> Study your <em>Squad</em>, <em>Recruit</em> free agents (your scout tracks them down over a few weeks), set weekly <em>Training</em>, and upgrade <em>Facilities</em> (one build at a time). Fighters age, get hurt, and retire.</li>
            <li><strong>Work the market.</strong> Re-sign your stars before their deals lapse; rivals will bid for them, and you can poach theirs — all on <em>Recruit</em>. On <em>Contracts</em>, bid for corporation work and fulfil it (research + wins) for a permanent <strong>specialization</strong> — a melee edge only helps melee.</li>
            <li><strong>Read the numbers.</strong> You never see exact truth — stats show as estimates that sharpen with appearances and scouting, faster for the stats a fighter actually uses. Build balance, not one big number.</li>
            <li><strong>Answer to your sponsor.</strong> Each season they set an objective. Miss it too often and their confidence hits zero — and you're <strong>sacked</strong>.</li>
          </ul>
          <p className="muted" style={{ fontSize: 12 }}>
            Hover the little ⓘ marks anywhere for details, or open <strong>Help</strong> from the menu any time.
          </p>
          <button className="btn big" onClick={() => dismissIntro()}>Start managing →</button>
        </div>
      </div>
    </div>
  );
}
