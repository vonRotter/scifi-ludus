/**
 * Training: pick the one category the roster drills this week. Presentation
 * only — the actual growth happens in the engine when a fixture is recorded.
 */

import { GameState, playerTeam } from '../../state/gameState';
import { setTraining } from '../../state/gameStore';
import { estimateCategories } from '../../engine/fog';
import { CATEGORIES, Category } from '../../engine/types';
import { CATEGORY_LABEL } from '../labels';

const CATEGORY_HINT: Record<Category, string> = {
  melee: 'Strength, technique, agility.',
  ranged: 'Eyesight, steadiness, handling.',
  defence: 'Toughness, reflexes, armour-use.',
  mental: 'Temperament, awareness, discipline.',
  speed: 'Acceleration, stamina, manoeuvre.',
};

export function TrainingScreen({ game }: { game: GameState }) {
  const team = playerTeam(game);
  const fighters = team.fighterIds.map((id) => game.fighters[id]);

  return (
    <div>
      <h2>Training</h2>
      <p className="muted">
        Pick one category to drill each week. Fighters gain in that category's
        sub-stats toward their hidden potential ceiling — the closer a fighter
        is to that ceiling, the slower the gains. Growth lands the moment a
        match week is played, whether you're fixtured or not.
      </p>
      <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
        {CATEGORIES.map((c) => (
          <button
            type="button"
            key={c}
            className={`pill${team.trainingFocus === c ? ' on' : ''}`}
            aria-pressed={team.trainingFocus === c}
            onClick={() => setTraining(c)}
            title={CATEGORY_HINT[c]}
          >
            {CATEGORY_LABEL[c]}
          </button>
        ))}
      </div>
      <p className="muted" style={{ marginTop: 6 }}>{CATEGORY_HINT[team.trainingFocus]}</p>

      <table className="grid" style={{ marginTop: 16 }}>
        <thead>
          <tr>
            <th>Fighter</th>
            <th>Potential</th>
            {CATEGORIES.map((c) => <th key={c} className="num">{CATEGORY_LABEL[c]}</th>)}
          </tr>
        </thead>
        <tbody>
          {fighters.map((f) => {
            const cat = estimateCategories(f);
            return (
              <tr key={f.id}>
                <td>{f.name}</td>
                <td className="muted">{'★'.repeat(Math.max(1, Math.round(f.potential / 4)))}</td>
                {CATEGORIES.map((c) => (
                  <td key={c} className={`num${c === team.trainingFocus ? ' player' : ''}`}>
                    {cat[c].revealed ? cat[c].mid : `~${cat[c].mid}`}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
