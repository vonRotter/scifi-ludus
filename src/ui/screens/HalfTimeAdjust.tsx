/**
 * Half-time adjustment panel: posture, focus, per-fighter roles and up to two
 * substitutions before round two.
 *
 * Single responsibility: capture the player's break-time decisions and hand the
 * chosen round-two config back up. It renders controls and validates the sub
 * limit; it runs no match rules and simulates nothing — the engine consumes the
 * config it emits.
 */

import { useMemo, useState } from 'react';
import { Fighter, Focus, Posture, Role, Tactics } from '../../engine/types';
import { FOCUS_DESC, FOCUS_LABEL, POSTURE_DESC, POSTURE_LABEL, ROLE_DESC, ROLE_LABEL } from '../labels';

const POSTURES: Posture[] = ['aggressive', 'balanced', 'defensive'];
const FOCUSES: Focus[] = ['melee', 'ranged', 'objective'];
const ROLES: Role[] = ['frontline', 'skirmisher', 'holdback'];
const MAX_SUBS = 2;

export interface Round2Config {
  tactics: Tactics;
  fighters: Fighter[];
  subbedInIds: string[];
}

export function HalfTimeAdjust({
  fielded,
  bench,
  base,
  numbers,
  r1Home,
  r1Away,
  aiLine,
  onStart,
}: {
  /** The player's round-one six (loadout-applied), in field order. */
  fielded: Fighter[];
  /** Fit reserves available to bring on. */
  bench: Fighter[];
  /** The player's round-one tactics. */
  base: Tactics;
  numbers: Record<string, number>;
  r1Home: number;
  r1Away: number;
  /** Optional "opponent adjusts…" line to show. */
  aiLine?: string;
  onStart: (cfg: Round2Config) => void;
}) {
  const [posture, setPosture] = useState<Posture>(base.posture);
  const [focus, setFocus] = useState<Focus>(base.focus);
  // Per SLOT (not per fighter): the role stays with the position, and a sub
  // inherits the slot's role. Occupant ids can change; roles are index-aligned.
  const [slotIds, setSlotIds] = useState<string[]>(fielded.map((f) => f.id));
  const [roleBySlot, setRoleBySlot] = useState<Role[]>(
    fielded.map((f) => base.roles[f.id] ?? 'frontline'),
  );

  const byId = useMemo(() => {
    const m = new Map<string, Fighter>();
    for (const f of [...fielded, ...bench]) m.set(f.id, f);
    return m;
  }, [fielded, bench]);

  const startedIds = useMemo(() => new Set(fielded.map((f) => f.id)), [fielded]);
  const subCount = slotIds.filter((id, i) => id !== fielded[i].id).length;
  const usedBench = new Set(slotIds.filter((id) => !startedIds.has(id)));

  const setSlot = (i: number, id: string) => {
    setSlotIds((prev) => prev.map((v, j) => (j === i ? id : v)));
  };
  const setRole = (i: number, r: Role) => {
    setRoleBySlot((prev) => prev.map((v, j) => (j === i ? r : v)));
  };

  const start = () => {
    const roles: Record<string, Role> = {};
    slotIds.forEach((id, i) => (roles[id] = roleBySlot[i]));
    onStart({
      tactics: { posture, focus, roles },
      fighters: slotIds.map((id) => byId.get(id)!),
      subbedInIds: slotIds.filter((id) => !startedIds.has(id)),
    });
  };

  return (
    <div className="panel" style={{ marginTop: 12 }}>
      <h3 style={{ marginTop: 0 }}>Half-time — adjust your tactics</h3>
      <p className="muted">
        Round one ended {r1Home}–{r1Away}. Change your approach for round two; it re-runs from here.
        Fresh legs come on at full energy.
      </p>
      {aiLine && <p style={{ color: 'var(--rival)', fontSize: 12 }}>{aiLine}</p>}

      {/* A start button up top so on a phone you can tweak below, then scroll
          back here to kick off — no hunting for it at the bottom of the panel. */}
      <div style={{ margin: '4px 0 10px' }}>
        <button className="btn big" onClick={start}>Start Round 2 →</button>
      </div>

      <div className="row"><strong style={{ width: 70 }}>Posture</strong>
        {POSTURES.map((p) => (
          <button key={p} type="button" className={`pill${posture === p ? ' on' : ''}`}
            aria-pressed={posture === p} title={POSTURE_DESC[p]} onClick={() => setPosture(p)}>
            {POSTURE_LABEL[p]}
          </button>
        ))}
      </div>
      <div className="row" style={{ marginTop: 6 }}><strong style={{ width: 70 }}>Focus</strong>
        {FOCUSES.map((fo) => (
          <button key={fo} type="button" className={`pill${focus === fo ? ' on' : ''}`}
            aria-pressed={focus === fo} title={FOCUS_DESC[fo]} onClick={() => setFocus(fo)}>
            {FOCUS_LABEL[fo]}
          </button>
        ))}
      </div>

      <div className="spread" style={{ marginTop: 12 }}>
        <strong style={{ fontSize: 12 }}>Line-up — roles &amp; substitutions</strong>
        <span className="muted" style={{ fontSize: 11 }}>
          {bench.length === 0 ? 'No fit reserves' : `Subs used ${subCount}/${MAX_SUBS}`}
        </span>
      </div>
      <div className="table-wrap" style={{ marginTop: 4 }}>
        <table className="grid" style={{ fontSize: 11, width: '100%' }}>
          <tbody>
            {slotIds.map((id, i) => {
              const isSub = !startedIds.has(id);
              const canAddSub = subCount < MAX_SUBS || isSub;
              return (
                <tr key={i}>
                  <td className="num" style={{ width: 24 }}>{numbers[fielded[i].id]}</td>
                  <td style={{ minWidth: 150 }}>
                    <select
                      value={id}
                      aria-label={`Fighter in position ${i + 1}`}
                      onChange={(e) => setSlot(i, e.target.value)}
                    >
                      <option value={fielded[i].id}>{fielded[i].name}{isSub ? '' : ' (starter)'}</option>
                      {bench
                        .filter((b) => b.id === id || (!usedBench.has(b.id) && canAddSub))
                        .map((b) => (
                          <option key={b.id} value={b.id}>↑ {b.name}</option>
                        ))}
                    </select>
                    {isSub && <span className="player" style={{ marginLeft: 6, fontSize: 10 }}>SUB</span>}
                  </td>
                  <td>
                    <div className="row" style={{ gap: 4 }}>
                      {ROLES.map((r) => (
                        <button key={r} type="button" className={`pill${roleBySlot[i] === r ? ' on' : ''}`}
                          aria-pressed={roleBySlot[i] === r} title={ROLE_DESC[r]}
                          style={{ padding: '1px 6px', fontSize: 10 }} onClick={() => setRole(i, r)}>
                          {ROLE_LABEL[r]}
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 12 }}>
        <button className="btn big" onClick={start}>Start Round 2 →</button>
      </div>
    </div>
  );
}
