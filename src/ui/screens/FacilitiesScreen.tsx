/**
 * Facilities: spend credits to permanently upgrade the ludus's training
 * ground, scouting network, and armoury. Presentation + store action only —
 * the cost curve and the effect of each level live in engine/facilities.
 */

import { CSSProperties } from 'react';
import { GameState, playerTeam } from '../../state/gameState';
import { upgradeFacility } from '../../state/gameStore';
import { canUpgrade, facilityUpgradeCost, FACILITY_KINDS, MAX_FACILITY_LEVEL } from '../../engine/facilities';
import { facilityEffect, FACILITY_CATEGORY, FACILITY_DESC, FACILITY_LABEL } from '../labels';

export function FacilitiesScreen({ game }: { game: GameState }) {
  const team = playerTeam(game);
  const build = team.facilityBuild;

  return (
    <div>
      <h2>Facilities</h2>
      <p className="muted">
        Permanent upgrades to your stable. Each level costs more than the last
        and pays off for the rest of the game. Your crew builds one at a time and
        it takes several match weeks. Budget: {team.budget}c.
      </p>
      {build && (
        <div className="panel" style={{ marginBottom: 12, borderColor: 'var(--cyan)' }}>
          <strong>🏗 Under construction:</strong> {FACILITY_LABEL[build.kind]} —{' '}
          <strong>{build.weeksLeft}</strong> match week{build.weeksLeft === 1 ? '' : 's'} left.
          <span className="muted"> Only one build at a time.</span>
        </div>
      )}
      <div className="cards">
        {FACILITY_KINDS.map((kind) => {
          const level = team.facilities[kind];
          const cost = facilityUpgradeCost(team.facilities, kind);
          const maxed = !canUpgrade(team.facilities, kind);
          const affordable = team.budget >= cost;
          const building = build?.kind === kind;
          const busy = !!build;
          const category = FACILITY_CATEGORY[kind];
          return (
            <div key={kind} className="card" style={{ '--card-accent': category.color } as CSSProperties}>
              <div className="cat">{category.label}</div>
              <h3>{FACILITY_LABEL[kind]}</h3>
              <p className="muted" style={{ fontSize: 12 }}>{FACILITY_DESC[kind]}</p>
              <div className="row" style={{ margin: '8px 0' }}>
                {Array.from({ length: MAX_FACILITY_LEVEL }, (_, i) => (
                  <span key={i} style={{ fontSize: 18, color: i < level ? category.color : 'var(--muted)' }}>
                    {i < level ? '●' : '○'}
                  </span>
                ))}
                <span className="muted" style={{ marginLeft: 6 }}>{level}/{MAX_FACILITY_LEVEL}</span>
              </div>
              <div style={{ fontSize: 12, margin: '2px 0 10px' }}>
                <span className="muted">Now: </span>{facilityEffect(kind, level)}
                {!maxed && <div className="muted">Next: {facilityEffect(kind, level + 1)}</div>}
              </div>
              <button
                className="btn full"
                disabled={maxed || !affordable || busy}
                title={maxed ? 'Already at maximum level.' : busy ? 'Your crew can only build one thing at a time.' : `Commission level ${level + 1}.`}
                onClick={() => upgradeFacility(kind)}
              >
                {maxed
                  ? 'Maxed out'
                  : building
                    ? `Building — ${build!.weeksLeft}w`
                    : busy
                      ? 'Crew busy'
                      : `Build (${cost}c)`}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
