/**
 * Persistence: serialise the game, localStorage autosave, JSON export/import.
 *
 * Single responsibility: get a GameState in and out of storage and files. This
 * is the one state-layer module allowed to touch browser APIs (localStorage,
 * Blob, file reads). It holds NO game rules — it only moves the state object.
 */

import { GameState, SAVE_VERSION } from './gameState';

const STORAGE_KEY = 'ludus.save.v1';

/** GameState is already a plain serialisable object; stringify as-is. */
export function serialize(state: GameState): string {
  return JSON.stringify(state);
}

/** Parse a save string, rejecting unknown/missing versions. */
export function deserialize(json: string): GameState {
  const data = JSON.parse(json) as GameState;
  if (!data || typeof data !== 'object' || data.version !== SAVE_VERSION) {
    throw new Error('Unrecognised or incompatible save file.');
  }
  return data;
}

export function saveToLocal(state: GameState): void {
  try {
    localStorage.setItem(STORAGE_KEY, serialize(state));
  } catch {
    // Storage may be full or disabled; the player still has file export.
  }
}

export function loadFromLocal(): GameState | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return deserialize(raw);
  } catch {
    return null;
  }
}

export function clearLocal(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/** Trigger a download of the current game as a portable JSON file. */
export function exportToFile(state: GameState): void {
  const blob = new Blob([serialize(state)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ludus-season-${state.seed}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Read and validate a save file the player picked. */
export function importFromFile(file: File): Promise<GameState> {
  return file.text().then(deserialize);
}
