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
import { clickableProps } from '../a11y';

export function MenagerieScreen({ game, navigate }: { game: GameState; navigate: Navigate }) {
  const team = playerTeam(game);
  const unlocked = beastsUnlocked(team.facilities.menagerie);
  const full = team.fighterIds.length >= rosterCap(team.facilities.housing);

  return (
    <div>
      <h2>Genelab</h2>
      <p className="muted">
        Gene-forged war-forms for the arena — savage in melee and hard to put
        down, but no use with ranged weapons and wildly unpredictable. Decanting
        one costs {BEAST_TAME_FEE}c plus its weekly upkeep. Upgrade the Genelab
        facility to bring more vats online. Budget: {team.budget}c.
      </p>
      {team.facilities.menagerie === 0 ? (
        <div className="panel">
          No genelab yet. Build one on the Facilities screen to start decanting war-forms.
        </div>
      ) : (
        <table className="grid">
          <thead>
            <tr>
              <th>War-form</th>
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
                  <td className="clickable" {...clickableProps(() => navigate({ name: 'fighter', id }), `View ${b.name}`)}>{b.name}</td>
                  {CATEGORIES.map((c) => <td key={c} className="num">~{cat[c].mid}</td>)}
                  <td className="num">{b.wage}c</td>
                  <td>
                    <button
                      className="btn"
                      disabled={caged || full || team.budget < BEAST_TAME_FEE}
                      title={
                        caged ? 'Upgrade the Genelab to bring this vat online.'
                        : full ? 'Roster full — upgrade Crew Quarters for more berths.'
                        : `Decant for ${BEAST_TAME_FEE}c.`
                      }
                      onClick={() => tame(id)}
                    >
                      {caged ? 'Offline' : `Decant (${BEAST_TAME_FEE}c)`}
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
