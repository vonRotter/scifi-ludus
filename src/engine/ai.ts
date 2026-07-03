/**
 * AI opponent decisions: pick a lineup, assign roles, choose tactics.
 *
 * Single responsibility: deterministic team/tactics selection for non-player
 * teams. Pure — input fighters, output a Lineup. No React, no I/O. Randomness
 * only via an injected rng so a fixture's AI choices are reproducible.
 */

import { categoryScores, overall } from './attributes';
import { ROSTER_SIZE, SQUAD_SIZE } from './constants';
import { canUpgrade, facilityUpgradeCost, FACILITY_KINDS } from './facilities';
import { canUpgradeLab, labUpgradeCost } from './procurement';
import { corpByKey, mayBidOn } from './corporations';
import { isInjured } from './injury';
import { Rng } from './rng';
import { Category, ContractOffer, Facilities, FacilityKind, Fighter, Focus, Lineup, Posture, Role, Team, Tactics } from './types';

/** Assign a role from the fighter's single strongest combat category. */
function roleFor(fighter: Fighter): Role {
  const s = categoryScores(fighter.subStats);
  const ranked: [Category, number][] = [
    ['melee', s.melee],
    ['ranged', s.ranged],
    ['defence', s.defence],
  ];
  ranked.sort((a, b) => b[1] - a[1]);
  switch (ranked[0][0]) {
    case 'ranged':
      return 'skirmisher';
    case 'defence':
      return 'holdback';
    default:
      return 'frontline';
  }
}

/** A squad's melee/ranged lean, summed across its category scores. */
function lean(squad: Fighter[]): { melee: number; ranged: number } {
  let melee = 0;
  let ranged = 0;
  for (const f of squad) {
    const s = categoryScores(f.subStats);
    melee += s.melee;
    ranged += s.ranged;
  }
  return { melee, ranged };
}

/** Choose team focus from the squad's own offensive composition. */
function focusFor(squad: Fighter[]): Focus {
  const { melee, ranged } = lean(squad);
  if (ranged > melee * 1.1) return 'ranged';
  if (melee > ranged * 1.1) return 'melee';
  return 'objective';
}

/**
 * Pick tactics to counter the opponent: kite a melee-heavy foe from range
 * (defensive + hold), close down a shooting foe (aggressive + press), and
 * contest the objective against a balanced one. Without a read on the enemy,
 * fall back to playing to the squad's own strengths.
 */
function counterTactics(squad: Fighter[], opponent: Fighter[] | undefined, rng: Rng): { posture: Posture; focus: Focus } {
  if (!opponent || opponent.length === 0) {
    return { posture: rng.pick(['aggressive', 'balanced', 'defensive'] as Posture[]), focus: focusFor(squad) };
  }
  const opp = lean(opponent);
  if (opp.melee > opp.ranged * 1.1) return { posture: 'defensive', focus: 'ranged' };
  if (opp.ranged > opp.melee * 1.1) return { posture: 'aggressive', focus: 'melee' };
  return { posture: 'balanced', focus: 'objective' };
}

/**
 * Pick the AI's six fighters (best by overall), assign each a role from its
 * strengths, and choose posture/focus — countering `opponent` when a read on
 * them is supplied. Deterministic for a given rng.
 */
export function chooseLineup(
  teamId: string,
  fighterIds: string[],
  fightersById: Record<string, Fighter>,
  rng: Rng,
  opponent?: Fighter[],
): Lineup {
  const roster = fighterIds.map((id) => fightersById[id]);
  // Field the best six available, preferring fit fighters; only call up the
  // injured if there aren't six healthy bodies to make a full squad.
  const byOverall = (a: Fighter, b: Fighter) => overall(b) - overall(a);
  const fit = roster.filter((f) => !isInjured(f)).sort(byOverall);
  const hurt = roster.filter((f) => isInjured(f)).sort(byOverall);
  const squad = [...fit, ...hurt].slice(0, SQUAD_SIZE);

  const roles: Record<string, Role> = {};
  for (const f of squad) roles[f.id] = roleFor(f);

  const { posture, focus } = counterTactics(squad, opponent, rng);
  const tactics: Tactics = { posture, focus, roles };

  return { teamId, fighterIds: squad.map((f) => f.id), tactics };
}

/** An AI school keeps this many credits in reserve before it invests. */
const AI_CASH_RESERVE = 800;

/**
 * Decide which facility an AI school upgrades after a match, if any. It only
 * spends above a cash reserve, and picks at random among the affordable,
 * not-yet-maxed facilities — so rivals slowly improve over a season instead of
 * hoarding prize money. Returns the facility to build, or null to save. Pure
 * and deterministic in `rng`.
 */
export function chooseFacilityUpgrade(
  facilities: Facilities,
  budget: number,
  rng: Rng,
): FacilityKind | null {
  const options = FACILITY_KINDS.filter(
    (k) => canUpgrade(facilities, k) && budget - facilityUpgradeCost(facilities, k) >= AI_CASH_RESERVE,
  );
  if (options.length === 0) return null;
  return rng.pick(options as FacilityKind[]);
}

/**
 * Whether an AI stable invests in its R&D Lab this settlement — same cash
 * reserve as facility spending, and only sometimes, so rivals build research
 * capacity over a career rather than rushing it. Pure/deterministic in `rng`.
 */
export function chooseLabUpgrade(labLevel: number, budget: number, rng: Rng): boolean {
  if (!canUpgradeLab(labLevel)) return false;
  if (budget - labUpgradeCost(labLevel) < AI_CASH_RESERVE) return false;
  return rng.chance(0.5);
}

/**
 * How much an AI stable bids on a contract offer in the sealed auction — 0 if it
 * passes. It only bids on contracts it's eligible for and can afford above its
 * reserve, keener when the domain matches its corp's specialty. The bid is the
 * acquisition cost plus a margin scaled by how much it wants the tech and what
 * it can spare. Pure and deterministic in `rng`.
 */
export function chooseContractBid(team: Team, offer: ContractOffer, rng: Rng): number {
  if (team.contract) return 0; // already working one
  if (!mayBidOn(team.corpKey, offer.sponsorCorp)) return 0;
  const spare = team.budget - AI_CASH_RESERVE;
  if (spare < offer.acquisitionCost) return 0;
  const corp = corpByKey(team.corpKey);
  const wants = corp.specialty === offer.domain;
  // Pass on off-specialty contracts fairly often; chase on-specialty ones.
  if (!wants && rng.chance(0.5)) return 0;
  const margin = Math.round((spare - offer.acquisitionCost) * (wants ? 0.4 : 0.2) * rng.float(0.5, 1));
  return offer.acquisitionCost + margin;
}

/**
 * Which offer an AI stable proactively pursues at season's turn, if any — the
 * most on-specialty affordable eligible one, and only sometimes (so the market
 * isn't emptied instantly). Returns the offer id, or null to wait. Deterministic.
 */
export function chooseContractToPursue(team: Team, offers: ContractOffer[], rng: Rng): string | null {
  if (team.contract) return null;
  const spare = team.budget - AI_CASH_RESERVE;
  const corp = corpByKey(team.corpKey);
  const eligible = offers.filter(
    (o) => mayBidOn(team.corpKey, o.sponsorCorp) && o.acquisitionCost <= spare,
  );
  if (eligible.length === 0) return null;
  if (rng.chance(0.35)) return null; // often bides its time
  // Prefer specialty matches, then the richer reward.
  eligible.sort((a, b) => {
    const av = (corp.specialty === a.domain ? 10 : 0) + a.reward;
    const bv = (corp.specialty === b.domain ? 10 : 0) + b.reward;
    return bv - av;
  });
  return eligible[0].id;
}

/**
 * Decide which free agent an AI school signs in the off-season, if any. A team
 * below a full roster picks from the best few available (a little randomness so
 * rivals don't all chase the exact same fighter). Returns the fighter id to
 * sign, or null to pass. Pure and deterministic in `rng`. AI recruiting is what
 * keeps rival rosters — and the free-agent pool — alive between seasons.
 */
export function chooseSigning(team: Team, available: Fighter[], rng: Rng): string | null {
  if (team.fighterIds.length >= ROSTER_SIZE || available.length === 0) return null;
  const ranked = [...available].sort((a, b) => overall(b) - overall(a));
  const shortlist = ranked.slice(0, Math.min(3, ranked.length));
  return rng.pick(shortlist).id;
}
