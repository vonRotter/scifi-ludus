/**
 * Menagerie: tame wild creatures and add them to your roster. Beasts are
 * ferocious in melee and tough but hopeless with ranged arms and wildly
 * variable — high risk, high reward. Access is gated by the Menagerie facility.
 * Presentation + store action only.
 */

import { GameState, BEAST_TAME_FEE, playerTeam } from '../../state/gameState';
import { tame } from '../../state/gameStore';
import { estimateCategories } from '../../engine/fog';
import { beastsUnlocked, rosterCap } from '../../engine/facilities';
import { CATEGORIES } from '../../engine/types';
import { CATEGORY_LABEL } from '../labels';
import { Navigate } from '../../App';

export function MenagerieScreen({ game, navigate }: { game: GameState; navigate: Navigate }) {
  const team = playerTeam(game);
  const unlocked = beastsUnlocked(team.facilities.menagerie);
  const full = team.fighterIds.length >= rosterCap(team.facilities.housing);

  return (
    <div>
      <h2>Menagerie</h2>
      <p className="muted">
        Wild creatures for the arena — savage in melee and hard to put down, but
        no use with ranged weapons and wildly unpredictable. Taming one costs
        {' '}{BEAST_TAME_FEE}c plus its weekly wage. Build the Menagerie facility
        to unlock more of the pack. Budget: {team.budget}c.
      </p>
      {team.facilities.menagerie === 0 ? (
        <div className="panel">
          No menagerie yet. Build one on the Facilities screen to start taming beasts.
        </div>
      ) : (
        <table className="grid">
          <thead>
            <tr>
              <th>Creature</th>
              {CATEGORIES.map((c) => <th key={c} className="num">{CATEGORY_LABEL[c]}</th>)}
              <th className="num">Wage</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {game.beasts.map((id, i) => {
              const b = game.fighters[id];
              const cat = estimateCategories(b);
              const caged = i >= unlocked;
              return (
                <tr key={id}>
                  <td className="clickable" onClick={() => navigate({ name: 'fighter', id })}>{b.name}</td>
                  {CATEGORIES.map((c) => <td key={c} className="num">~{cat[c].mid}</td>)}
                  <td className="num">{b.wage}c</td>
                  <td>
                    <button
                      className="btn"
                      disabled={caged || full || team.budget < BEAST_TAME_FEE}
                      title={
                        caged ? 'Upgrade the Menagerie to unlock this beast.'
                        : full ? 'Roster full — upgrade Housing for more beds.'
                        : `Tame for ${BEAST_TAME_FEE}c.`
                      }
                      onClick={() => tame(id)}
                    >
                      {caged ? 'Caged' : `Tame (${BEAST_TAME_FEE}c)`}
                    </button>
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
