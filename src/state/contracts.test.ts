import { describe, it, expect } from 'vitest';
import { createGame } from './newGame';
import { GameState, bidOnContract, fundContract, playerTeam, teamById, upgradeLab } from './gameState';
import { recordResult } from './recordResult';
import { buildMatchInputs } from './matchSetup';
import { mayBidOn } from '../engine/corporations';

function game() {
  return createGame(4242, 0);
}

/** Give the player team a big treasury so a maxed bid deterministically wins. */
function rich(g: GameState, budget = 100000): GameState {
  return { ...g, teams: g.teams.map((t) => (t.id === g.playerTeamId ? { ...t, budget } : t)) };
}

function firstEligibleOffer(g: GameState) {
  const corp = playerTeam(g).corpKey;
  return g.contractOffers.find((o) => mayBidOn(corp, o.sponsorCorp))!;
}

describe('the contract market', () => {
  it('a new game has a market and a corp-backed player stable', () => {
    const g = game();
    expect(g.contractOffers.length).toBeGreaterThan(0);
    expect(playerTeam(g).corpKey).toBeTruthy();
    expect(playerTeam(g).contract).toBeFalsy();
  });

  it('winning a bid takes the offer off the market and hands it to the player', () => {
    let g = rich(game());
    const offer = firstEligibleOffer(g);
    const budgetBefore = playerTeam(g).budget;
    g = bidOnContract(g, offer.id, 90000);
    expect(playerTeam(g).contract?.id).toBe(offer.id);
    expect(g.contractOffers.find((o) => o.id === offer.id)).toBeUndefined();
    expect(playerTeam(g).budget).toBe(budgetBefore - 90000); // winner pays their bid
  });

  it('refuses a bid on a rival corporation’s contract', () => {
    const g = rich(game());
    const corp = playerTeam(g).corpKey;
    const rivalOffer = g.contractOffers.find((o) => !mayBidOn(corp, o.sponsorCorp));
    if (!rivalOffer) return; // this seed happened to tender no rival contracts
    const after = bidOnContract(g, rivalOffer.id, 90000);
    expect(playerTeam(after).contract).toBeFalsy();
    expect(after.contractOffers.find((o) => o.id === rivalOffer.id)).toBeTruthy(); // still on the market
  });

  it('fulfils a held contract by researching and winning, granting the specialization', () => {
    let g = rich(game());
    g = upgradeLab(g); g = upgradeLab(g); g = upgradeLab(g); // level 3 = 3 research/week
    g = bidOnContract(g, firstEligibleOffer(g).id, 90000);
    const domain = playerTeam(g).contract!.domain;
    const before = playerTeam(g).specializations[domain] ?? 0;

    const pid = g.playerTeamId;
    const fixtures = g.fixtures.filter((f) => f.homeTeamId === pid || f.awayTeamId === pid);
    for (const f of fixtures) {
      if (!playerTeam(g).contract) break; // fulfilled
      const playerHome = f.homeTeamId === pid;
      const home = teamById(g, f.homeTeamId).fighterIds.slice(0, 6);
      const away = teamById(g, f.awayTeamId).fighterIds.slice(0, 6);
      // Player wins big either way.
      g = recordResult(g, f.id, playerHome ? 30 : 5, playerHome ? 5 : 30, [...home, ...away]);
    }
    expect(playerTeam(g).specializations[domain] ?? 0).toBeGreaterThan(before);
    expect(playerTeam(g).contract).toBeFalsy(); // cleared on fulfilment
    expect(g.news.some((n) => n.text.includes('Contract fulfilled'))).toBe(true);
  });

  it('funding a contract spends credits toward its research', () => {
    let g = rich(game());
    g = bidOnContract(g, firstEligibleOffer(g).id, 90000);
    const beforeResearch = playerTeam(g).contract!.researchDone;
    const beforeBudget = playerTeam(g).budget;
    g = fundContract(g);
    expect(playerTeam(g).budget).toBeLessThan(beforeBudget);
    expect(playerTeam(g).contract!.researchDone).toBeGreaterThan(beforeResearch);
  });
});

describe('specialization reaches the match engine', () => {
  it('passes the player stable’s spec into its squad input', () => {
    const g = game();
    const withSpec: GameState = {
      ...g,
      teams: g.teams.map((t) => (t.id === g.playerTeamId ? { ...t, specializations: { melee: 2 } } : t)),
    };
    const fixture = g.fixtures.find((f) => f.homeTeamId === g.playerTeamId)!;
    const inputs = buildMatchInputs(withSpec, fixture);
    expect(inputs.home.spec).toEqual({ melee: 2 });
  });
});
