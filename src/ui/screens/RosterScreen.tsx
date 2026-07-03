/**
 * Roster table: the player's fighters with fog-estimated category scores.
 * Rows open the fighter's attribute sheet. Presentation only.
 */

import { GameState, playerTeam } from '../../state/gameState';
import { estimateCategories } from '../../engine/fog';
import { isInjured } from '../../engine/injury';
import { moraleLabel, moraleOf } from '../../engine/morale';
import { contractSeasonsOf, isExpiring } from '../../engine/contracts';
import { CATEGORIES } from '../../engine/types';
import { BODYTYPE_LABEL, CATEGORY_LABEL } from '../labels';
import { Navigate } from '../../App';
import { Info } from '../components/Info';
import { clickableProps } from '../a11y';

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
      <div className="table-wrap">
      <table className="grid">
        <thead>
          <tr>
            <th>Fighter</th>
            <th>Type</th>
            <th className="num" title="Years old. Fighters decline past 30 and may retire from 34.">Age</th>
            {CATEGORIES.map((c) => (
              <th key={c} className="num" title="Estimated — narrows with appearances and shows a wider band until it does.">{CATEGORY_LABEL[c]}</th>
            ))}
            <th title="How the fighter feels — lifted by wins and playing time, dented by losses, injuries, and warming the bench.">Morale</th>
            <th className="num">Apps <Info text="Matches played. After enough appearances, a fighter's combat stats are fully revealed (temperament never is)." /></th>
            <th className="num">Wage <Info text="Deducted from your budget every match week, win or lose." /></th>
            <th className="num" title="Seasons left on their deal. When it lapses they walk to free agency — re-sign them from the fighter's page.">Deal</th>
          </tr>
        </thead>
        <tbody>
          {fighters.map((f) => {
            const cat = estimateCategories(f);
            return (
              <tr key={f.id} className="clickable" {...clickableProps(() => navigate({ name: 'fighter', id: f.id }), `View ${f.name}`)}>
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
                <td className="muted">{moraleLabel(moraleOf(f))}</td>
                <td className="num">{f.matchesPlayed}</td>
                <td className="num">{f.wage}c</td>
                <td className="num" style={isExpiring(f) ? { color: 'var(--bad)' } : undefined}>
                  {contractSeasonsOf(f)}y
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
    </div>
  );
}
