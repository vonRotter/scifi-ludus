/**
 * Contracts: the stable's corporation, its R&D Lab, and the military procurement
 * market. The player bids on corporation-sponsored contracts (rivalries bar some
 * bids), fulfils a held contract by spending research + winning bouts before the
 * deadline, and banks a permanent, CONDITIONAL specialization in one domain.
 * Presentation + store actions only — every rule lives in engine/procurement and
 * engine/corporations.
 */

import { CSSProperties, useState } from 'react';
import { GameState, playerTeam, teamStanding } from '../../state/gameState';
import { bidContract, fundContract, upgradeLab } from '../../state/gameStore';
import {
  canUpgradeLab, contractBounty, FUND_COST, labUpgradeCost, MAX_LAB_LEVEL, researchRate, standingTier,
} from '../../engine/procurement';
import { CORP_KEYS, corpByKey, mayBidOn, PERK_DESC, PERK_LABEL } from '../../engine/corporations';
import { CATEGORY_LABEL } from '../labels';
import { ContractOffer, Domain } from '../../engine/types';

const DOMAIN_COLOR: Record<Domain, string> = {
  melee: 'var(--rival)', ranged: 'var(--rival)', defence: 'var(--good)',
  speed: 'var(--cyan)', mental: 'var(--accent)',
};

function specSummary(spec: Record<string, number | undefined>): string {
  const parts = (Object.keys(spec) as Domain[])
    .filter((d) => (spec[d] ?? 0) > 0)
    .map((d) => `${CATEGORY_LABEL[d]} ${spec[d]}`);
  return parts.length > 0 ? parts.join(' · ') : 'none yet';
}

export function ContractsScreen({ game }: { game: GameState }) {
  const team = playerTeam(game);
  const corp = corpByKey(team.corpKey);
  const rate = researchRate(team.labLevel);
  const labCost = labUpgradeCost(team.labLevel);
  const contract = team.contract;

  const [bids, setBids] = useState<Record<string, number>>({});
  const bidFor = (o: ContractOffer) => bids[o.id] ?? o.acquisitionCost;
  const raise = (o: ContractOffer, delta: number) =>
    setBids((b) => ({ ...b, [o.id]: Math.max(o.acquisitionCost, Math.min(team.budget, bidFor(o) + delta)) }));

  return (
    <div>
      <h2>Contracts</h2>

      {/* Corporation banner. */}
      <div className="panel" style={{ marginBottom: 12 }}>
        <div className="spread">
          <div>
            <strong>{corp.name}</strong>
            <span className="tag" style={{ marginLeft: 8 }}>{CATEGORY_LABEL[corp.specialty]} specialists</span>
            <span className="tag" style={{ marginLeft: 4 }} title={PERK_DESC[corp.perk]}>{PERK_LABEL[corp.perk]}</span>
          </div>
          <div className="muted" style={{ fontSize: 12 }}>
            Specializations: <strong>{specSummary(team.specializations)}</strong>
          </div>
        </div>
        <p className="muted" style={{ fontSize: 12, margin: '6px 0 0' }}>{corp.blurb}</p>
      </div>

      {/* Corporate relationships. */}
      <div className="panel" style={{ marginBottom: 12 }}>
        <strong style={{ fontSize: 12 }}>Corporate relationships</strong>
        <div className="row" style={{ flexWrap: 'wrap', marginTop: 6 }}>
          {CORP_KEYS.map((k) => {
            const c = corpByKey(k);
            const rival = !mayBidOn(team.corpKey, k);
            const s = teamStanding(team, k);
            return (
              <span
                key={k}
                className="tag"
                title={rival ? `${c.name} are your rivals — they won't tender to you.` : c.blurb}
                style={{ color: rival ? 'var(--bad)' : s > 0 ? 'var(--good)' : undefined }}
              >
                {c.name}: {rival ? 'Rival' : standingTier(s)}{s !== 0 ? ` (${s > 0 ? '+' : ''}${s})` : ''}
              </span>
            );
          })}
        </div>
      </div>

      {/* R&D Lab. */}
      <div className="panel spread" style={{ marginBottom: 12 }}>
        <div>
          <strong>R&amp;D Lab</strong>
          <div className="row" style={{ margin: '6px 0' }}>
            {Array.from({ length: MAX_LAB_LEVEL }, (_, i) => (
              <span key={i} style={{ fontSize: 18, color: i < team.labLevel ? 'var(--player)' : 'var(--muted)' }}>
                {i < team.labLevel ? '●' : '○'}
              </span>
            ))}
            <span className="muted" style={{ marginLeft: 6 }}>
              {team.labLevel > 0 ? `${rate} research/week` : 'not built — you cannot make contract progress yet'}
            </span>
          </div>
        </div>
        <button
          className="btn"
          disabled={!canUpgradeLab(team.labLevel) || team.budget < labCost}
          onClick={() => upgradeLab()}
        >
          {canUpgradeLab(team.labLevel) ? `Upgrade Lab (${labCost}c)` : 'Lab maxed'}
        </button>
      </div>

      {/* Active contract. */}
      {contract ? (
        <div className="panel" style={{ marginBottom: 12 }}>
          <div className="spread">
            <div>
              <span className="muted">Active contract: </span><strong>{contract.name}</strong>
              <span className="tag" style={{ marginLeft: 8 }}>{CATEGORY_LABEL[contract.domain]}</span>
              <span className="muted" style={{ marginLeft: 8, fontSize: 12 }}>for {corpByKey(contract.sponsorCorp).name}</span>
            </div>
            <button className="btn" disabled={team.budget < FUND_COST} onClick={() => fundContract()}>
              Commission prototype ({FUND_COST}c)
            </button>
          </div>
          <div style={{ margin: '8px 0 4px', height: 8, background: '#1a232c', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ width: `${Math.min(100, (contract.researchDone / contract.researchRequired) * 100)}%`, height: '100%', background: 'var(--player)' }} />
          </div>
          <div className="muted" style={{ fontSize: 12 }}>
            Research {Math.floor(contract.researchDone)}/{contract.researchRequired} ·
            {' '}Wins {contract.winsDone}/{contract.goalWins} ·
            {' '}<strong style={{ color: contract.weeksLeft <= 2 ? 'var(--bad)' : undefined }}>{contract.weeksLeft} weeks left</strong> ·
            {' '}reward: +{contract.reward} {CATEGORY_LABEL[contract.domain]} specialization
            {rate <= 0 && ' — build the R&D Lab to make research progress.'}
          </div>
        </div>
      ) : (
        <p className="muted" style={{ marginBottom: 12 }}>
          No active contract. Win a bid below to take one on — you can hold one at a time.
        </p>
      )}

      {/* The procurement market. */}
      <h3>Procurement market</h3>
      {game.contractOffers.length === 0 ? (
        <div className="panel">The market is quiet. New contracts are tendered each season.</div>
      ) : (
        <div className="cards">
          {game.contractOffers.map((o) => {
            const sponsor = corpByKey(o.sponsorCorp);
            const eligible = mayBidOn(team.corpKey, o.sponsorCorp);
            const bid = bidFor(o);
            const canBid = eligible && !contract && team.budget >= bid;
            const color = DOMAIN_COLOR[o.domain];
            return (
              <div key={o.id} className="card" style={{ '--card-accent': color } as CSSProperties}>
                <div className="cat">{sponsor.name}</div>
                <h3>{o.name}</h3>
                <div className="row" style={{ flexWrap: 'wrap', margin: '0 0 8px' }}>
                  <span className="tag">{CATEGORY_LABEL[o.domain]}</span>
                  <span className="tag">+{o.reward} spec</span>
                  {eligible && (
                    <span className="tag" title="Your standing with the sponsor sways the auction.">
                      {sponsor.name.split(' ')[0]}: {standingTier(teamStanding(team, o.sponsorCorp))}
                    </span>
                  )}
                </div>
                <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
                  Needs {o.researchRequired} research &amp; {o.goalWins} win{o.goalWins === 1 ? '' : 's'} within {o.deadlineWeeks} weeks.
                  {' '}Fulfil it to pay a {contractBounty(o.reward)}c bounty.
                </div>
                {eligible ? (
                  <>
                    <div className="row" style={{ alignItems: 'center', marginBottom: 8 }}>
                      <button className="btn ghost" disabled={bid <= o.acquisitionCost} onClick={() => raise(o, -100)}>−</button>
                      <span style={{ minWidth: 64, textAlign: 'center' }}>{bid}c</span>
                      <button className="btn ghost" disabled={bid + 100 > team.budget} onClick={() => raise(o, 100)}>+</button>
                    </div>
                    <button
                      className="btn full"
                      disabled={!canBid}
                      title={contract ? 'You already hold a contract.' : bid > team.budget ? 'Not enough credits.' : `Bid ${bid}c (floor ${o.acquisitionCost}c).`}
                      onClick={() => bidContract(o.id, bid)}
                    >
                      {contract ? 'Contract in progress' : `Place bid (${bid}c)`}
                    </button>
                  </>
                ) : (
                  <div className="muted" style={{ fontSize: 12 }}>
                    {sponsor.name} won't arm {corp.name} — you're rivals. Barred from bidding.
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
