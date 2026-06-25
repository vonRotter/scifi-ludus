/**
 * Save management: export a portable JSON save, import one, or abandon the
 * season. Presentation + store/save actions only.
 */

import { useRef } from 'react';
import { GameState } from '../../state/gameState';
import { abandonGame, loadGame } from '../../state/gameStore';
import { exportToFile, importFromFile } from '../../state/save';

export function SaveScreen({ game }: { game: GameState }) {
  const fileRef = useRef<HTMLInputElement>(null);

  const onImport = async (file: File | undefined) => {
    if (!file) return;
    try {
      loadGame(await importFromFile(file));
    } catch (e) {
      alert(`Could not load save: ${(e as Error).message}`);
    }
  };

  return (
    <div>
      <h2>Save</h2>
      <p className="muted">
        Your season is saved automatically in this browser. Export a file as a
        permanent backup you can reload anywhere.
      </p>
      <div className="row">
        <button className="btn" onClick={() => exportToFile(game)}>Export Save File</button>
        <button className="btn ghost" onClick={() => fileRef.current?.click()}>Import Save File…</button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          style={{ display: 'none' }}
          onChange={(e) => onImport(e.target.files?.[0])}
        />
      </div>
      <h3>Danger zone</h3>
      <button
        className="btn ghost"
        onClick={() => {
          if (confirm('Abandon this season and return to the menu? This clears the browser save.')) {
            abandonGame();
          }
        }}
      >
        Abandon Season
      </button>
    </div>
  );
}
