/**
 * Lineup & tactics: choose six fighters, assign each a role, and set the team
 * posture and focus. Edits are local until saved to the store.
 * Presentation + store action only — no rules.
 */

import { useState } from 'react';
import { GameState, playerTeam } from '../../state/gameState';
import { saveLineup } from '../../state/gameStore';
import { estimateCategories } from '../../engine/fog';
import { SQUAD_SIZE } from '../../engine/constants';
import { Focus, Lineup, Posture, Role } from '../../engine/types';
import { FOCUS_LABEL, POSTURE_LABEL, ROLE_LABEL } from '../labels';

const POSTURES: Posture[] = ['aggressive', 'balanced', 'defensive'];
const FOCUSES: Focus[] = ['melee', 'ranged', 'objective'];
const ROLES: Role[] = ['frontline', 'skirmisher', 'holdback'];

export function LineupScreen({ game }: { game: GameState }) {
  const team = playerTeam(game);
  const [draft, setDraft] = useState<Lineup>(game.playerLineup);
  const fielded = new Set(draft.fighterIds);
  const valid = draft.fighterIds.length === SQUAD_SIZE;

  const toggle = (id: string) => {
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
        <h2 style={{ border: 'none', margin: 0 }}>Lineup &amp; Tactics</h2>
        <button className="btn" disabled={!valid} onClick={() => saveLineup(draft)}>
          {valid ? 'Save Lineup' : `Select ${SQUAD_SIZE - draft.fighterIds.length} more`}
        </button>
      </div>

      <h3>Posture</h3>
      <div className="row">
        {POSTURES.map((p) => (
          <span
            key={p}
            className={`pill${draft.tactics.posture === p ? ' on' : ''}`}
            onClick={() => setDraft({ ...draft, tactics: { ...draft.tactics, posture: p } })}
          >
            {POSTURE_LABEL[p]}
          </span>
        ))}
      </div>

      <h3>Focus</h3>
      <div className="row">
        {FOCUSES.map((fo) => (
          <span
            key={fo}
            className={`pill${draft.tactics.focus === fo ? ' on' : ''}`}
            onClick={() => setDraft({ ...draft, tactics: { ...draft.tactics, focus: fo } })}
          >
            {FOCUS_LABEL[fo]}
          </span>
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
            <th>Role</th>
          </tr>
        </thead>
        <tbody>
          {team.fighterIds.map((id) => {
            const f = game.fighters[id];
            const cat = estimateCategories(f);
            const on = fielded.has(id);
            return (
              <tr key={id} className={on ? 'you' : ''}>
                <td>
                  <input type="checkbox" checked={on} onChange={() => toggle(id)} />
                </td>
                <td>{f.name}</td>
                <td className="num">~{cat.melee.mid}</td>
                <td className="num">~{cat.ranged.mid}</td>
                <td className="num">~{cat.defence.mid}</td>
                <td>
                  {on
                    ? ROLES.map((r) => (
                        <span
                          key={r}
                          className={`pill${draft.tactics.roles[id] === r ? ' on' : ''}`}
                          onClick={() => setRole(id, r)}
                        >
                          {ROLE_LABEL[r]}
                        </span>
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
