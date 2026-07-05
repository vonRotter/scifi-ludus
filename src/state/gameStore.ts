/**
 * The game store: holds the single current GameState and the named actions
 * that change it. Framework-agnostic (no React) so the rules/state never depend
 * on the UI. The UI subscribes via a thin hook (ui/useGame.ts).
 *
 * Single responsibility: own the current state, broadcast changes, autosave.
 * It orchestrates engine calls (headless sim) but contains no game rules itself.
 */

import { simulateMatch } from '../engine/match/simulate';
import { adjustTactics, personalityOf } from '../engine/ai';
import { generateContent } from '../data/seedFighters';
import { Category, FacilityKind, Lineup, MatchResult } from '../engine/types';
import { Difficulty } from '../engine/difficulty';
import {
  GameState,
  bidOnContract as bidOnContractState,
  fundContract as fundContractState,
  playerTeam,
  scoutFreeAgent,
  setPlayerLineup,
  setTrainingFocus,
  renewContract,
  signFreeAgent,
  tameBeast,
  upgradeFacility as upgradeFacilityState,
  upgradeLab as upgradeLabState,
} from './gameState';
import { recordResult } from './recordResult';
import { advanceSeason } from './rollover';
import { buildMatchInputs } from './matchSetup';
import { resolveCupRound } from './cup';
import { createGame } from './newGame';
import { clearLocal, loadFromLocal, saveToLocal } from './save';

let state: GameState | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

/** Commit a new state: store it, autosave, notify subscribers. */
function commit(next: GameState): void {
  state = next;
  saveToLocal(next);
  emit();
}

export function getState(): GameState | null {
  return state;
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Resume a saved game silently at startup (no autosave write, no churn). */
export function tryResume(): boolean {
  const saved = loadFromLocal();
  if (saved) state = saved;
  return saved !== null;
}

export function startNewGame(
  seed: number = (Date.now() >>> 0),
  playerIndex = 0,
  difficulty: Difficulty = 'standard',
): void {
  commit(createGame(seed, playerIndex, difficulty));
}

/**
 * Generate (but don't commit) the league for a candidate seed, so the menu
 * can show the player every school's roster before they pick one to run.
 */
export function previewLeague(seed: number) {
  return generateContent(seed);
}

export function loadGame(loaded: GameState): void {
  commit(loaded);
}

export function nextSeason(): void {
  if (state) commit(advanceSeason(state));
}

export function abandonGame(): void {
  clearLocal();
  state = null;
  emit();
}

/** Mark the first-run intro as seen so it doesn't show again. */
export function dismissIntro(): void {
  if (state) commit({ ...state, introSeen: true });
}

export function saveLineup(lineup: Lineup): void {
  if (state) commit(setPlayerLineup(state, lineup));
}

export function sign(fighterId: string): void {
  if (state) commit(signFreeAgent(state, fighterId));
}

export function setTraining(focus: Category): void {
  if (state) commit(setTrainingFocus(state, playerTeam(state).id, focus));
}

export function scout(fighterId: string): void {
  if (state) commit(scoutFreeAgent(state, fighterId));
}

export function upgradeFacility(kind: FacilityKind): void {
  if (state) commit(upgradeFacilityState(state, playerTeam(state).id, kind));
}

export function tame(beastId: string): void {
  if (state) commit(tameBeast(state, beastId));
}

export function upgradeLab(): void {
  if (state) commit(upgradeLabState(state));
}

export function fundContract(): void {
  if (state) commit(fundContractState(state));
}

export function bidContract(offerId: string, amount: number): void {
  if (state) commit(bidOnContractState(state, offerId, amount));
}

export function renew(fighterId: string): void {
  if (state) commit(renewContract(state, fighterId));
}

export function playCupRound(): void {
  if (state) commit(resolveCupRound(state));
}

/** Record a result the match screen already simulated for the player. */
export function recordMatch(
  fixtureId: string,
  homeScore: number,
  awayScore: number,
  fieldedIds: string[],
): void {
  if (state) commit(recordResult(state, fixtureId, homeScore, awayScore, fieldedIds));
}

/** Simulate one fixture with no visuals (AI-vs-AI weeks) and record it. */
export function simulateHeadless(fixtureId: string): MatchResult | null {
  if (!state) return null;
  const fixture = state.fixtures.find((f) => f.id === fixtureId);
  if (!fixture || fixture.played) return null;
  const inputs = buildMatchInputs(state, fixture);
  // Round one at the committed tactics, then both AI stables adjust at half-time
  // from that scoreline (same depth the player's opponent gets on-screen).
  const r1 = simulateMatch(inputs.home, inputs.away, inputs.arena, fixture.seed);
  const s1 = r1.rounds[0];
  const homeTeam = state.teams.find((t) => t.id === fixture.homeTeamId)!;
  const awayTeam = state.teams.find((t) => t.id === fixture.awayTeamId)!;
  const result = simulateMatch(inputs.home, inputs.away, inputs.arena, fixture.seed, {
    round2: {
      home: adjustTactics(inputs.home.tactics, s1.homeScore, s1.awayScore, inputs.home.fighters, personalityOf(homeTeam)),
      away: adjustTactics(inputs.away.tactics, s1.awayScore, s1.homeScore, inputs.away.fighters, personalityOf(awayTeam)),
    },
  });
  commit(recordResult(state, fixtureId, result.homeScore, result.awayScore, inputs.fieldedIds));
  return result;
}
