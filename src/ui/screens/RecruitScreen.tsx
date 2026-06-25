/**
 * Recruitment: the free-agent pool with fog estimates; sign one onto the
 * roster. The minimal Phase 1 recruitment loop. Presentation + store action.
 */

import { GameState, playerTeam } from '../../state/gameState';
import { scout, sign } from '../../state/gameStore';
import { estimateCategories, potentialBand } from '../../engine/fog';
import { canScout, scoutCost, MAX_SCOUT_LEVEL } from '../../engine/scouting';
import { CATEGORIES } from '../../engine/types';
import { BODYTYPE_LABEL, CATEGORY_LABEL } from '../labels';
import { Navigate } from '../../App';

export function RecruitScreen({ game, navigate }: { game: GameState; navigate: Navigate }) {
  const agents = game.freeAgents.map((id) => game.fighters[id]);
  const team = playerTeam(game);

  return (
    <div>
      <h2>Free Agents</h2>
      <p className="muted">
        Unsigned fighters. No signing fee, but each draws a wage from your
        budget ({team.budget}c) every match week. Their values are heavily
        fogged until they compete for you — or until you pay for a scouting
        report, which narrows the fog before you commit. Sign carefully.
      </p>
      {agents.length === 0 ? (
        <div className="panel">No free agents remain in the pool.</div>
      ) : (
        <table className="grid">
          <thead>
            <tr>
              <th>Fighter</th>
              <th>Type</th>
              {CATEGORIES.map((c) => <th key={c} className="num">{CATEGORY_LABEL[c]}</th>)}
              <th>Potential</th>
              <th className="num">Wage</th>
              <th title="Each report narrows this prospect's fog a notch before you sign them.">Scouted</th>
              <th></th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {agents.map((f) => {
              const cat = estimateCategories(f);
              const cost = scoutCost(f);
              const scoutable = canScout(f) && team.budget >= cost;
              return (
                <tr key={f.id}>
                  <td className="clickable" onClick={() => navigate({ name: 'fighter', id: f.id })}>{f.name}</td>
                  <td><span className="tag">{BODYTYPE_LABEL[f.bodyType]}</span></td>
                  {CATEGORIES.map((c) => <td key={c} className="num">~{cat[c].mid}</td>)}
                  <td className="muted">{potentialBand(f)}</td>
                  <td className="num">{f.wage}c</td>
                  <td className="muted">{f.scoutLevel}/{MAX_SCOUT_LEVEL}</td>
                  <td>
                    <button
                      className="btn"
                      disabled={!scoutable}
                      title="Each report costs more than the last."
                      onClick={() => scout(f.id)}
                    >
                      {canScout(f) ? `Scout (${cost}c)` : 'Fully scouted'}
                    </button>
                  </td>
                  <td>
                    <button className="btn" onClick={() => sign(f.id)}>Sign</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
