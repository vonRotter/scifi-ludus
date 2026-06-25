/**
 * React binding to the game store.
 *
 * Single responsibility: expose the current GameState to components reactively.
 * The only place React subscribes to the store. No game logic.
 */

import { useSyncExternalStore } from 'react';
import { getState, subscribe } from '../state/gameStore';
import { GameState } from '../state/gameState';

/** Current game state, or null when no game is loaded. Re-renders on change. */
export function useGame(): GameState | null {
  return useSyncExternalStore(subscribe, getState);
}
