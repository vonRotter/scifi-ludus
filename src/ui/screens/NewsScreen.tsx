/**
 * News: a reverse-chronological feed of everything the simulation throws up —
 * results, injuries, arena deaths, and season turns. The one place the player
 * can follow the story of their ludus. Presentation only.
 */

import { GameState, NewsItem } from '../../state/gameState';

const CATEGORY_TAG: Record<NewsItem['category'], string> = {
  result: 'Result',
  injury: 'Injury',
  season: 'Season',
};

export function NewsScreen({ game }: { game: GameState }) {
  return (
    <div>
      <h2>News</h2>
      {game.news.length === 0 ? (
        <div className="panel">Nothing to report yet.</div>
      ) : (
        <table className="grid">
          <thead>
            <tr>
              <th className="num">When</th>
              <th>Type</th>
              <th>Headline</th>
            </tr>
          </thead>
          <tbody>
            {game.news.map((n) => (
              <tr key={n.id}>
                <td className="num muted">
                  {n.week > 0 ? `S${n.season} W${n.week}` : `S${n.season}`}
                </td>
                <td>
                  <span className="tag" style={{ color: n.category === 'injury' ? 'var(--bad)' : undefined }}>
                    {CATEGORY_TAG[n.category]}
                  </span>
                </td>
                <td>{n.text}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
