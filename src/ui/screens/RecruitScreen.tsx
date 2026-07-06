/**
 * Recruitment: you don't see the whole market — your scout has to track free
 * agents down over the season. This screen shows the scout's status, the agents
 * they've turned up so far, and lets you sign or further scout those.
 * Presentation + store actions only.
 */

import { GameState, discoveredAgentIds, playerTeam, teamById } from '../../state/gameState';
import { acceptTransfer, rejectTransfer, scout, sendScout, sign } from '../../state/gameStore';
import { estimateCategories, potentialBand } from '../../engine/fog';
import { canScout, scoutCost, scoutSearchTime, MAX_SCOUT_LEVEL } from '../../engine/scouting';
import { rosterCap } from '../../engine/facilities';
import { CATEGORIES } from '../../engine/types';
import { BODYTYPE_LABEL, CATEGORY_LABEL } from '../labels';
import { Navigate } from '../../App';
import { clickableProps } from '../a11y';

export function RecruitScreen({ game, navigate }: { game: GameState; navigate: Navigate }) {
  const team = playerTeam(game);
  const cap = rosterCap(team.facilities.housing);
  const full = team.fighterIds.length >= cap;
  const discovered = discoveredAgentIds(game).map((id) => game.fighters[id]);
  const search = game.scoutSearch;
  const undiscoveredCount = game.freeAgents.length - discovered.length;
  const searchWeeks = scoutSearchTime(team.facilities.scouting);
  const offers = (game.transferOffers ?? []).filter((o) => team.fighterIds.includes(o.fighterId));

  return (
    <div>
      <h2>Recruitment</h2>

      {offers.length > 0 && (
        <div className="panel" style={{ marginBottom: 12, borderColor: 'var(--good)' }}>
          <strong>📨 Incoming bids for your fighters</strong>
          <div className="table-wrap" style={{ marginTop: 6 }}>
            <table className="grid" style={{ width: '100%' }}>
              <tbody>
                {offers.map((o) => (
                  <tr key={o.id}>
                    <td><strong>{game.fighters[o.fighterId]?.name ?? '—'}</strong></td>
                    <td>from {teamById(game, o.fromTeamId).name}</td>
                    <td className="num"><strong style={{ color: 'var(--good)' }}>{o.amount}c</strong></td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="btn" style={{ marginRight: 6 }} onClick={() => acceptTransfer(o.id)}>Sell</button>
                      <button className="btn ghost" onClick={() => rejectTransfer(o.id)}>Keep</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Selling banks the credits; keeping a wanted fighter nudges their morale down.</div>
        </div>
      )}
      <p className="muted">
        You only know the free agents your scout has found. Send them into the
        field to turn up more — a better Recon Network finds them faster. Signed
        fighters draw a wage from your budget ({team.budget}c) each match week.
      </p>

      <div className="panel spread" style={{ marginBottom: 12, borderColor: 'var(--cyan)' }}>
        <div>
          {search ? (
            <><strong>🔎 Scout in the field</strong> — <strong>{search.weeksLeft}</strong> match week{search.weeksLeft === 1 ? '' : 's'} until they report back.</>
          ) : undiscoveredCount > 0 ? (
            <><strong>Scout idle.</strong> <span className="muted">{undiscoveredCount} agent{undiscoveredCount === 1 ? '' : 's'} still out there — a search takes ~{searchWeeks} week{searchWeeks === 1 ? '' : 's'}.</span></>
          ) : (
            <span className="muted">Your scout has turned up everyone in the market.</span>
          )}
        </div>
        <button className="btn" disabled={!!search || undiscoveredCount === 0} onClick={() => sendScout()}>
          Send scout
        </button>
      </div>

      <p className="muted">
        Roster: {team.fighterIds.length}/{cap} beds used.
        {full && ' Upgrade Housing for more beds before you can sign anyone else.'}
      </p>

      {discovered.length === 0 ? (
        <div className="panel">Your scout hasn’t turned anyone up yet — send them out.</div>
      ) : (
        <div className="table-wrap">
          <table className="grid">
            <thead>
              <tr>
                <th>Fighter</th>
                <th>Type</th>
                <th className="num" title="Years old. Youth-intake prospects are teenagers with room to grow.">Age</th>
                {CATEGORIES.map((c) => <th key={c} className="num">{CATEGORY_LABEL[c]}</th>)}
                <th>Potential</th>
                <th className="num">Wage</th>
                <th title="Each report narrows this prospect's fog a notch before you sign them.">Scouted</th>
                <th></th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {discovered.map((f) => {
                const cat = estimateCategories(f);
                const cost = scoutCost(f, team.facilities.scouting);
                const scoutable = canScout(f) && team.budget >= cost;
                return (
                  <tr key={f.id}>
                    <td className="clickable" {...clickableProps(() => navigate({ name: 'fighter', id: f.id }), `View ${f.name}`)}>{f.name}</td>
                    <td><span className="tag">{BODYTYPE_LABEL[f.bodyType]}</span></td>
                    <td className="num">{f.age}</td>
                    {CATEGORIES.map((c) => <td key={c} className="num">~{cat[c].mid}</td>)}
                    <td className="muted">{potentialBand(f)}</td>
                    <td className="num">{f.wage}c</td>
                    <td className="muted">{f.scoutLevel}/{MAX_SCOUT_LEVEL}</td>
                    <td>
                      <button className="btn" disabled={!scoutable} title="Each report costs more than the last." onClick={() => scout(f.id)}>
                        {canScout(f) ? `Report (${cost}c)` : 'Fully scouted'}
                      </button>
                    </td>
                    <td>
                      <button
                        className="btn"
                        disabled={full}
                        title={full ? 'Your roster is full — upgrade Housing for more beds.' : 'Add this fighter to your roster.'}
                        onClick={() => sign(f.id)}
                      >
                        Sign
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
