/**
 * The game store: holds the single current GameState and the named actions
 * that change it. Framework-agnostic (no React) so the rules/state never depend
 * on the UI. The UI subscribes via a thin hook (ui/useGame.ts).
 *
 * Single responsibility: own the current state, broadcast changes, autosave.
 * It orchestrates engine calls (headless sim) but contains no game rules itself.
 */

import { simulateMatch } from '../engine/match/simulate';
import { generateContent } from '../data/seedFighters';
import { Category, FacilityKind, Lineup, MatchResult } from '../engine/types';
import {
  GameState,
  advanceSeason,
  playerTeam,
  recordResult,
  scoutFreeAgent,
  setPlayerLineup,
  setTrainingFocus,
  signFreeAgent,
  tameBeast,
  upgradeFacility as upgradeFacilityState,
} from './gameState';
import { buildMatchInputs } from './matchSetup';
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

export function startNewGame(seed: number = (Date.now() >>> 0), playerIndex = 0): void {
  commit(createGame(seed, playerIndex));
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
  const result = simulateMatch(inputs.home, inputs.away, inputs.arena, fixture.seed);
  commit(recordResult(state, fixtureId, result.homeScore, result.awayScore, inputs.fieldedIds));
  return result;
}
