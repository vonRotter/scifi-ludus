/**
 * Main menu: start a new season (picking which school to run) or import a
 * save. Shown only when no game is loaded. Presentation + store actions
 * only; no rules — team summaries are computed from existing engine exports.
 */

import { CSSProperties, useRef, useState } from 'react';
import { loadGame, previewLeague, startNewGame, startTutorial } from '../../state/gameStore';
import { importFromFile } from '../../state/save';
import { overall } from '../../engine/attributes';
import { Difficulty, DIFFICULTIES, DIFFICULTY_SETTINGS } from '../../engine/difficulty';
import { GeneratedContent } from '../../data/seedFighters';
import { BODYTYPE_LABEL, CATEGORY_LABEL } from '../labels';
import { corpByKey, PERK_DESC, PERK_LABEL } from '../../engine/corporations';
import { Info } from '../components/Info';

export function MainMenu() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<{ seed: number; content: GeneratedContent } | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>('standard');

  const onImport = async (file: File | undefined) => {
    if (!file) return;
    try {
      loadGame(await importFromFile(file));
    } catch (e) {
      alert(`Could not load save: ${(e as Error).message}`);
    }
  };

  const rollLeague = (seed: number = Date.now() >>> 0) => {
    setPreview({ seed, content: previewLeague(seed) });
  };

  if (preview) {
    const { seed, content } = preview;
    return (
      <div className="app">
        <div className="menu wide">
          <div className="title">LUDUS</div>
          <div className="tagline">PICK YOUR STABLE</div>
          <div className="panel">
            <p className="muted">
              Four stables have been drawn up for this season — pick the one you
              want to run; the rest are AI-controlled rivals.
              <Info text="Rosters are randomly generated but kept close in overall strength, so this is about the style you want to coach, not finding a hidden best pick." />
            </p>
            <div className="row" style={{ justifyContent: 'center', marginBottom: 12 }}>
              <strong style={{ fontSize: 12 }}>Difficulty</strong>
              {DIFFICULTIES.map((d) => (
                <button
                  type="button"
                  key={d}
                  className={`pill${difficulty === d ? ' on' : ''}`}
                  aria-pressed={difficulty === d}
                  title={DIFFICULTY_SETTINGS[d].desc}
                  onClick={() => setDifficulty(d)}
                >
                  {DIFFICULTY_SETTINGS[d].label}
                </button>
              ))}
            </div>
            <p className="muted" style={{ marginTop: 0 }}>{DIFFICULTY_SETTINGS[difficulty].desc}</p>
            <div className="cards" style={{ textAlign: 'left' }}>
              {content.teams.map((t, i) => {
                const roster = t.fighterIds.map((id) => content.fighters[id]);
                const avg = Math.round(
                  roster.reduce((sum, f) => sum + overall(f), 0) / roster.length,
                );
                const bodyTypeCounts = new Map<string, number>();
                for (const f of roster) {
                  bodyTypeCounts.set(f.bodyType, (bodyTypeCounts.get(f.bodyType) ?? 0) + 1);
                }
                const corp = corpByKey(t.corpKey);
                return (
                  <div key={t.id} className="card" style={{ '--card-accent': 'var(--cyan)' } as CSSProperties}>
                    <h3>{t.name}</h3>
                    <div className="muted" style={{ margin: '0 0 6px', fontSize: 12 }}>
                      Backed by <strong>{corp.name}</strong> — {CATEGORY_LABEL[corp.specialty]} specialists
                      <span className="tag" style={{ marginLeft: 6 }} title={PERK_DESC[corp.perk]}>{PERK_LABEL[corp.perk]}</span>
                    </div>
                    <div className="muted" style={{ margin: '0 0 8px' }}>
                      Avg. overall ~{avg}
                    </div>
                    <div className="row" style={{ flexWrap: 'wrap', marginBottom: 10 }}>
                      {[...bodyTypeCounts.entries()].map(([bt, n]) => (
                        <span key={bt} className="tag">{n}× {BODYTYPE_LABEL[bt as keyof typeof BODYTYPE_LABEL]}</span>
                      ))}
                    </div>
                    <button className="btn big full" onClick={() => startNewGame(seed, i, difficulty)}>
                      Run {t.name}
                    </button>
                  </div>
                );
              })}
            </div>
            <div className="row" style={{ marginTop: 14 }}>
              <button className="btn ghost" onClick={() => rollLeague()}>Re-roll Stables</button>
              <button className="btn ghost" onClick={() => setPreview(null)}>← Back</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="menu">
        <div className="title">LUDUS</div>
        <div className="tagline">SCI-FI ARENA MANAGEMENT</div>
        <div className="panel">
          <button className="btn big" onClick={() => rollLeague()}>
            New Season
          </button>
          <button className="btn ghost big" onClick={() => startTutorial()}>
            Tutorial — How to Play
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
            Manage one combat stable through a short arena season against rival syndicates.
          </p>
        </div>
      </div>
    </div>
  );
}
