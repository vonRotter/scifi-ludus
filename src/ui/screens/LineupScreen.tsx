/**
 * Lineup & tactics: choose six fighters, assign each a role, and set the team
 * posture and focus. Edits are local until saved to the store.
 * Presentation + store action only — no rules.
 */

import { useState } from 'react';
import { GameState, playerTeam } from '../../state/gameState';
import { saveLineup } from '../../state/gameStore';
import { estimateCategories } from '../../engine/fog';
import { isInjured } from '../../engine/injury';
import { SQUAD_SIZE } from '../../engine/constants';
import { Focus, Lineup, Posture, Role } from '../../engine/types';
import { FOCUS_DESC, FOCUS_LABEL, POSTURE_DESC, POSTURE_LABEL, ROLE_DESC, ROLE_LABEL } from '../labels';
import { Info } from '../components/Info';

const POSTURES: Posture[] = ['aggressive', 'balanced', 'defensive'];
const FOCUSES: Focus[] = ['melee', 'ranged', 'objective'];
const ROLES: Role[] = ['frontline', 'skirmisher', 'holdback'];

export function LineupScreen({ game }: { game: GameState }) {
  const team = playerTeam(game);
  const [draft, setDraft] = useState<Lineup>(game.playerLineup);
  const fielded = new Set(draft.fighterIds);
  const valid = draft.fighterIds.length === SQUAD_SIZE;

  const toggle = (id: string) => {
    // Injured fighters can't be called up; they can still be benched.
    if (!fielded.has(id) && isInjured(game.fighters[id])) return;
    if (fielded.has(id)) {
      const ids = draft.fighterIds.filter((x) => x !== id);
      const roles = { ...draft.tactics.roles };
      delete roles[id];
      setDraft({ ...draft, fighterIds: ids, tactics: { ...draft.tactics, roles } });
    } else if (draft.fighterIds.length < SQUAD_SIZE) {
      setDraft({
        ...draft,
        fighterIds: [...draft.fighterIds, id],
        tactics: { ...draft.tactics, roles: { ...draft.tactics.roles, [id]: 'frontline' } },
      });
    }
  };

  const setRole = (id: string, role: Role) =>
    setDraft({ ...draft, tactics: { ...draft.tactics, roles: { ...draft.tactics.roles, [id]: role } } });

  return (
    <div>
      <div className="spread">
        <h2 style={{ border: 'none', margin: 0 }}>Line-up &amp; Tactics</h2>
        <button className="btn" disabled={!valid} onClick={() => saveLineup(draft)}>
          {valid ? 'Save Line-up' : `Select ${SQUAD_SIZE - draft.fighterIds.length} more`}
        </button>
      </div>

      <h3>Posture <Info text="How hard your team pushes versus how much it protects itself, for everyone fielded." /></h3>
      <div className="row">
        {POSTURES.map((p) => (
          <button
            type="button"
            key={p}
            className={`pill${draft.tactics.posture === p ? ' on' : ''}`}
            aria-pressed={draft.tactics.posture === p}
            title={POSTURE_DESC[p]}
            onClick={() => setDraft({ ...draft, tactics: { ...draft.tactics, posture: p } })}
          >
            {POSTURE_LABEL[p]}
          </button>
        ))}
      </div>

      <h3>Focus <Info text="What the team is trying to achieve this match — where fighters position and what they prioritise." /></h3>
      <div className="row">
        {FOCUSES.map((fo) => (
          <button
            type="button"
            key={fo}
            className={`pill${draft.tactics.focus === fo ? ' on' : ''}`}
            aria-pressed={draft.tactics.focus === fo}
            title={FOCUS_DESC[fo]}
            onClick={() => setDraft({ ...draft, tactics: { ...draft.tactics, focus: fo } })}
          >
            {FOCUS_LABEL[fo]}
          </button>
        ))}
      </div>

      <h3>Squad — {draft.fighterIds.length}/{SQUAD_SIZE} fielded</h3>
      <table className="grid">
        <thead>
          <tr>
            <th>Field</th>
            <th>Fighter</th>
            <th className="num">Mel</th>
            <th className="num">Rng</th>
            <th className="num">Def</th>
            <th>Role <Info text="Where this fighter positions itself and what it does in a fight — hover a role pill for details." /></th>
          </tr>
        </thead>
        <tbody>
          {team.fighterIds.map((id) => {
            const f = game.fighters[id];
            const cat = estimateCategories(f);
            const on = fielded.has(id);
            const injured = isInjured(f);
            return (
              <tr key={id} className={on ? 'you' : ''}>
                <td>
                  <input
                    type="checkbox"
                    checked={on}
                    disabled={injured && !on}
                    onChange={() => toggle(id)}
                  />
                </td>
                <td>
                  {f.name}
                  {injured && (
                    <span className="tag" style={{ marginLeft: 6, color: 'var(--bad)' }}>
                      injured {f.injuryWeeks}w
                    </span>
                  )}
                </td>
                <td className="num">~{cat.melee.mid}</td>
                <td className="num">~{cat.ranged.mid}</td>
                <td className="num">~{cat.defence.mid}</td>
                <td>
                  {on
                    ? ROLES.map((r) => (
                        <button
                          type="button"
                          key={r}
                          className={`pill${draft.tactics.roles[id] === r ? ' on' : ''}`}
                          aria-pressed={draft.tactics.roles[id] === r}
                          title={ROLE_DESC[r]}
                          onClick={() => setRole(id, r)}
                        >
                          {ROLE_LABEL[r]}
                        </button>
                      ))
                    : <span className="muted">bench</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
