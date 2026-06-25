/**
 * Roster table: the player's fighters with fog-estimated category scores.
 * Rows open the fighter's attribute sheet. Presentation only.
 */

import { GameState, playerTeam } from '../../state/gameState';
import { estimateCategories } from '../../engine/fog';
import { CATEGORIES } from '../../engine/types';
import { BODYTYPE_LABEL, CATEGORY_LABEL } from '../labels';
import { Navigate } from '../../App';

export function RosterScreen({ game, navigate }: { game: GameState; navigate: Navigate }) {
  const team = playerTeam(game);
  const fighters = team.fighterIds.map((id) => game.fighters[id]);

  return (
    <div>
      <h2>{team.name} — Roster</h2>
      <p className="muted">
        Estimated values. They sharpen as a fighter competes. Click a fighter for the full sheet.
      </p>
      <table className="grid">
        <thead>
          <tr>
            <th>Fighter</th>
            <th>Type</th>
            {CATEGORIES.map((c) => (
              <th key={c} className="num">{CATEGORY_LABEL[c]}</th>
            ))}
            <th className="num">Apps</th>
          </tr>
        </thead>
        <tbody>
          {fighters.map((f) => {
            const cat = estimateCategories(f);
            return (
              <tr key={f.id} className="clickable" onClick={() => navigate({ name: 'fighter', id: f.id })}>
                <td>{f.name}</td>
                <td><span className="tag">{BODYTYPE_LABEL[f.bodyType]}</span></td>
                {CATEGORIES.map((c) => (
                  <td key={c} className="num">
                    {cat[c].revealed ? cat[c].mid : `~${cat[c].mid}`}
                  </td>
                ))}
                <td className="num">{f.matchesPlayed}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
