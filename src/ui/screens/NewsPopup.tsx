/**
 * Post-match news popup: a modal that surfaces the headlines a just-played match
 * generated, so the player always sees them before moving on.
 *
 * Single responsibility: present a list of NewsItems and a dismiss action. Pure
 * presentation — it decides nothing about the game.
 */

import { NewsItem } from '../../state/gameState';

const ICON: Record<NewsItem['category'], string> = {
  result: '⚔',
  injury: '🩹',
  season: '📣',
};

export function NewsPopup({ news, onClose }: { news: NewsItem[] | null; onClose: () => void }) {
  if (!news || news.length === 0) return null;
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Match news" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>📰 Match-day news</h3>
        <div style={{ maxHeight: '50vh', overflowY: 'auto' }}>
          {news.map((n) => (
            <div key={n.id} className="row" style={{ gap: 8, alignItems: 'flex-start', margin: '8px 0' }}>
              <span aria-hidden style={{ fontSize: 15 }}>{ICON[n.category]}</span>
              <span style={{ fontSize: 13, lineHeight: 1.5 }}>{n.text}</span>
            </div>
          ))}
        </div>
        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 12 }}>
          <button type="button" className="btn big" onClick={onClose}>Continue →</button>
        </div>
      </div>
    </div>
  );
}
