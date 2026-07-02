/**
 * Research & Development: fund the stable's weapons/armour research programme.
 * The player builds the R&D Lab (sets the weekly research rate), picks which
 * project to pursue, and can pay to commission a prototype. Completed projects
 * permanently sharpen every fielded fighter. Presentation + store actions only —
 * all the rules and numbers live in engine/research.
 */

import { CSSProperties } from 'react';
import { GameState, playerTeam, teamResearch } from '../../state/gameState';
import { fundResearch, setResearch, upgradeLab } from '../../state/gameStore';
import {
  availableProjects, BREAKTHROUGH_BOUNTY, canUpgradeLab, FUND_COST, FUND_STEP,
  labUpgradeCost, MAX_LAB_LEVEL, RESEARCH_PROJECTS, researchRate,
} from '../../engine/research';
import { CATEGORY_LABEL, SUBSTAT_LABEL } from '../labels';
import { ResearchKey, SubStatKey } from '../../engine/types';

const CATEGORY_COLOR: Record<string, string> = {
  melee: 'var(--rival)', ranged: 'var(--rival)', defence: 'var(--good)',
  speed: 'var(--cyan)', mental: 'var(--accent)',
};

function bonusText(key: ResearchKey): string {
  return Object.entries(RESEARCH_PROJECTS[key].substat)
    .map(([s, d]) => `+${d} ${SUBSTAT_LABEL[s as SubStatKey]}`)
    .join(', ');
}

export function ResearchScreen({ game }: { game: GameState }) {
  const team = playerTeam(game);
  const research = teamResearch(team);
  const rate = researchRate(research.labLevel);
  const active = research.active ? RESEARCH_PROJECTS[research.active] : null;
  const pickable = availableProjects(research).filter((p) => p.key !== research.active);
  const labCost = labUpgradeCost(research.labLevel);

  return (
    <div>
      <h2>Research &amp; Development</h2>
      <p className="muted">
        Your stable doubles as a weapons test-bed. Fund practical research into
        the kit your fighters already carry — a reground edge, a retuned laser, a
        reactive plate — and every breakthrough permanently sharpens the whole
        roster. Military backers pay a {BREAKTHROUGH_BOUNTY}c bounty for each one
        delivered. Budget: {team.budget}c.
      </p>

      {/* R&D Lab: sets the weekly research rate. */}
      <div className="panel spread" style={{ marginBottom: 12 }}>
        <div>
          <strong>R&amp;D Lab</strong>
          <div className="row" style={{ margin: '6px 0' }}>
            {Array.from({ length: MAX_LAB_LEVEL }, (_, i) => (
              <span key={i} style={{ fontSize: 18, color: i < research.labLevel ? 'var(--player)' : 'var(--muted)' }}>
                {i < research.labLevel ? '●' : '○'}
              </span>
            ))}
            <span className="muted" style={{ marginLeft: 6 }}>
              {research.labLevel > 0 ? `${rate} research/week` : 'not built — no research yet'}
            </span>
          </div>
        </div>
        <button
          className="btn"
          disabled={!canUpgradeLab(research.labLevel) || team.budget < labCost}
          title={canUpgradeLab(research.labLevel) ? `Raise the weekly research rate.` : 'Lab at maximum level.'}
          onClick={() => upgradeLab()}
        >
          {canUpgradeLab(research.labLevel) ? `Upgrade Lab (${labCost}c)` : 'Lab maxed'}
        </button>
      </div>

      {/* Active project + progress. */}
      {active ? (
        <div className="panel" style={{ marginBottom: 12 }}>
          <div className="spread">
            <div>
              <span className="muted">Now researching: </span><strong>{active.name}</strong>
              <span className="tag" style={{ marginLeft: 8 }}>{CATEGORY_LABEL[active.category]}</span>
            </div>
            <button
              className="btn"
              disabled={team.budget < FUND_COST}
              title={`Commission a prototype: +${FUND_STEP} progress now.`}
              onClick={() => fundResearch()}
            >
              Fund (+{FUND_STEP}) {FUND_COST}c
            </button>
          </div>
          <div style={{ margin: '8px 0 4px', height: 8, background: '#1a232c', borderRadius: 4, overflow: 'hidden' }}>
            <div
              style={{
                width: `${Math.min(100, (research.progress / active.cost) * 100)}%`,
                height: '100%',
                background: 'var(--player)',
              }}
            />
          </div>
          <div className="muted" style={{ fontSize: 12 }}>
            {research.progress.toFixed(0)}/{active.cost} — grants {bonusText(active.key)}.
            {rate <= 0 && ' Build the R&D Lab to make progress each week.'}
          </div>
        </div>
      ) : (
        <div className="panel" style={{ marginBottom: 12 }}>
          No active project — pick one below to start researching.
        </div>
      )}

      {/* Pickable projects. */}
      <h3>Projects</h3>
      <div className="cards">
        {pickable.map((p) => {
          const color = CATEGORY_COLOR[p.category] ?? 'var(--player)';
          return (
            <div key={p.key} className="card" style={{ '--card-accent': color } as CSSProperties}>
              <div className="cat">{CATEGORY_LABEL[p.category]}</div>
              <h3>{p.name}</h3>
              <p className="muted" style={{ fontSize: 12 }}>{p.desc}</p>
              <div style={{ fontSize: 12, margin: '2px 0 10px' }}>
                <span className="muted">Grants: </span>{bonusText(p.key)}
                <div className="muted">Cost: {p.cost} research</div>
              </div>
              <button className="btn full" onClick={() => setResearch(p.key)}>
                Research this
              </button>
            </div>
          );
        })}
      </div>

      {/* Completed. */}
      {research.completed.length > 0 && (
        <>
          <h3>In service</h3>
          <table className="grid">
            <thead>
              <tr><th>Project</th><th>Area</th><th>Effect</th></tr>
            </thead>
            <tbody>
              {research.completed.map((key) => (
                <tr key={key}>
                  <td>{RESEARCH_PROJECTS[key].name}</td>
                  <td><span className="tag">{CATEGORY_LABEL[RESEARCH_PROJECTS[key].category]}</span></td>
                  <td className="muted">{bonusText(key)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
