/**
 * Roster table: the player's fighters with fog-estimated category scores.
 * Rows open the fighter's attribute sheet. Presentation only.
 */

import { GameState, playerTeam } from '../../state/gameState';
import { estimateCategories } from '../../engine/fog';
import { isInjured } from '../../engine/injury';
import { CATEGORIES } from '../../engine/types';
import { BODYTYPE_LABEL, CATEGORY_LABEL } from '../labels';
import { Navigate } from '../../App';
import { Info } from '../components/Info';

export function RosterScreen({ game, navigate }: { game: GameState; navigate: Navigate }) {
  const team = playerTeam(game);
  const fighters = team.fighterIds.map((id) => game.fighters[id]);

  return (
    <div>
      <h2>{team.name} — Roster</h2>
      <p className="muted">
        Estimated values. They sharpen as a fighter competes. Click a fighter for the full sheet.
        Budget: {team.budget}c. Weekly wage bill: {fighters.reduce((s, f) => s + f.wage, 0)}c.
      </p>
      <table className="grid">
        <thead>
          <tr>
            <th>Fighter</th>
            <th>Type</th>
            <th className="num" title="Years old. Fighters decline past 30 and may retire from 34.">Age</th>
            {CATEGORIES.map((c) => (
              <th key={c} className="num" title="Estimated — narrows with appearances and shows a wider band until it does.">{CATEGORY_LABEL[c]}</th>
            ))}
            <th className="num">Apps <Info text="Matches played. After enough appearances, a fighter's combat stats are fully revealed (temperament never is)." /></th>
            <th className="num">Wage <Info text="Deducted from your budget every match week, win or lose." /></th>
          </tr>
        </thead>
        <tbody>
          {fighters.map((f) => {
            const cat = estimateCategories(f);
            return (
              <tr key={f.id} className="clickable" onClick={() => navigate({ name: 'fighter', id: f.id })}>
                <td>
                  {f.name}
                  {isInjured(f) && (
                    <span className="tag" style={{ marginLeft: 6, color: 'var(--bad)' }} title="Out injured; can't be fielded until recovered.">
                      injured {f.injuryWeeks}w
                    </span>
                  )}
                </td>
                <td><span className="tag">{BODYTYPE_LABEL[f.bodyType]}</span></td>
                <td className="num">{f.age}</td>
                {CATEGORIES.map((c) => (
                  <td key={c} className="num">
                    {cat[c].revealed ? cat[c].mid : `~${cat[c].mid}`}
                  </td>
                ))}
                <td className="num">{f.matchesPlayed}</td>
                <td className="num">{f.wage}c</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
