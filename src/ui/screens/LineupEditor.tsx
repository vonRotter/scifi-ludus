/**
 * Line-up editor: the controlled body of the line-up & tactics UI — pick six
 * fighters, assign roles, set posture and focus.
 *
 * Single responsibility: render the selection controls over a caller-owned
 * draft Lineup and report edits via onChange. It holds no state and saves
 * nothing — the Line-up tab and the pre-match team-selection step both wrap it.
 * Presentation only; no rules.
 */

import { GameState } from '../../state/gameState';
import { estimateCategories } from '../../engine/fog';
import { isInjured } from '../../engine/injury';
import { SQUAD_SIZE } from '../../engine/constants';
import { Focus, Lineup, Posture, Role } from '../../engine/types';
import { FOCUS_DESC, FOCUS_LABEL, POSTURE_DESC, POSTURE_LABEL, ROLE_DESC, ROLE_LABEL } from '../labels';
import { Info } from '../components/Info';

const POSTURES: Posture[] = ['aggressive', 'balanced', 'defensive'];
const FOCUSES: Focus[] = ['melee', 'ranged', 'objective'];
const ROLES: Role[] = ['frontline', 'skirmisher', 'holdback'];

export function LineupEditor({
  game,
  draft,
  onChange,
}: {
  game: GameState;
  draft: Lineup;
  onChange: (l: Lineup) => void;
}) {
  const teamIds = game.teams.find((t) => t.id === draft.teamId)?.fighterIds ?? [];
  const fielded = new Set(draft.fighterIds);

  const toggle = (id: string) => {
    // Injured fighters can't be called up; they can still be benched.
    if (!fielded.has(id) && isInjured(game.fighters[id])) return;
    if (fielded.has(id)) {
      const roles = { ...draft.tactics.roles };
      delete roles[id];
      onChange({ ...draft, fighterIds: draft.fighterIds.filter((x) => x !== id), tactics: { ...draft.tactics, roles } });
    } else if (draft.fighterIds.length < SQUAD_SIZE) {
      onChange({
        ...draft,
        fighterIds: [...draft.fighterIds, id],
        tactics: { ...draft.tactics, roles: { ...draft.tactics.roles, [id]: 'frontline' } },
      });
    }
  };

  const setRole = (id: string, role: Role) =>
    onChange({ ...draft, tactics: { ...draft.tactics, roles: { ...draft.tactics.roles, [id]: role } } });

  return (
    <>
      <h3>Posture <Info text="How hard your team pushes versus how much it protects itself, for everyone fielded." /></h3>
      <div className="row">
        {POSTURES.map((p) => (
          <button
            type="button"
            key={p}
            className={`pill${draft.tactics.posture === p ? ' on' : ''}`}
            aria-pressed={draft.tactics.posture === p}
            title={POSTURE_DESC[p]}
            onClick={() => onChange({ ...draft, tactics: { ...draft.tactics, posture: p } })}
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
            onClick={() => onChange({ ...draft, tactics: { ...draft.tactics, focus: fo } })}
          >
            {FOCUS_LABEL[fo]}
          </button>
        ))}
      </div>

      <h3>Squad — {draft.fighterIds.length}/{SQUAD_SIZE} fielded</h3>
      <div className="table-wrap">
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
            {teamIds.map((id) => {
              const f = game.fighters[id];
              const cat = estimateCategories(f);
              const on = fielded.has(id);
              const injured = isInjured(f);
              return (
                <tr key={id} className={on ? 'you' : ''}>
                  <td>
                    <input type="checkbox" checked={on} disabled={injured && !on} onChange={() => toggle(id)} />
                  </td>
                  <td>
                    {f.name}
                    {injured && (
                      <span className="tag" style={{ marginLeft: 6, color: 'var(--bad)' }}>injured {f.injuryWeeks}w</span>
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
    </>
  );
}
