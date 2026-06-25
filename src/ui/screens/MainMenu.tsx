/**
 * Main menu: start a new season or import a save. Shown only when no game is
 * loaded. Presentation + store actions only; no rules.
 */

import { useRef } from 'react';
import { loadGame, startNewGame } from '../../state/gameStore';
import { importFromFile } from '../../state/save';

export function MainMenu() {
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
    <div className="app">
      <div className="menu">
        <div className="title">LUDUS</div>
        <div className="tagline">SCI-FI GLADIATOR MANAGEMENT</div>
        <div className="panel">
          <button className="btn big" onClick={() => startNewGame()}>
            New Season
          </button>
          <button className="btn ghost big" onClick={() => fileRef.current?.click()}>
            Load Save File…
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            style={{ display: 'none' }}
            onChange={(e) => onImport(e.target.files?.[0])}
          />
          <p className="muted" style={{ marginBottom: 0 }}>
            Manage one ludus through a short arena season against two rival schools.
          </p>
        </div>
      </div>
    </div>
  );
}
