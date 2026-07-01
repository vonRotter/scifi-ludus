/**
 * Fighter attribute sheet: the fifteen sub-stats shown as fog estimates,
 * grouped by category, plus the hidden potential band. Presentation only —
 * all estimate math comes from engine/fog.
 */

import { GameState } from '../../state/gameState';
import { estimateAll, estimateCategories, potentialBand } from '../../engine/fog';
import { isInjured } from '../../engine/injury';
import { moraleLabel, moraleOf } from '../../engine/morale';
import { knownTraits, traitsRevealed, TRAITS } from '../../engine/traits';
import { CATEGORIES, CATEGORY_SUBSTATS } from '../../engine/types';
import { BODYTYPE_LABEL, CATEGORY_LABEL, SUBSTAT_LABEL } from '../labels';
import { EstimateBar } from '../components/EstimateBar';
import { Info } from '../components/Info';
import { Navigate } from '../../App';

export function FighterScreen({
  game,
  fighterId,
  navigate,
}: {
  game: GameState;
  fighterId: string;
  navigate: Navigate;
}) {
  const f = game.fighters[fighterId];
  if (!f) return <p>Unknown fighter.</p>;
  const subs = estimateAll(f);
  const cats = estimateCategories(f);

  return (
    <div>
      <div className="spread">
        <h2 style={{ border: 'none', margin: 0 }}>{f.name}</h2>
        <button className="btn ghost" onClick={() => navigate({ name: 'roster' })}>← Roster</button>
      </div>
      <div className="row" style={{ margin: '4px 0 14px' }}>
        <span className="tag">{BODYTYPE_LABEL[f.bodyType]}</span>
        <span className="muted">{f.age} yrs</span>
        <span className="muted" title="How the fighter feels — moved by results, playing time, and injuries.">
          Morale: {moraleLabel(moraleOf(f))}
        </span>
        {isInjured(f) && (
          <span className="tag" style={{ color: 'var(--bad)' }} title="Out injured; can't be fielded until recovered.">
            injured {f.injuryWeeks}w
          </span>
        )}
        <span className="muted">{f.matchesPlayed} apps</span>
        <span className="muted">
          Potential: {potentialBand(f)}
          <Info text="A hidden growth ceiling — never shown as an exact number, only this rough star rating. Training raises stats toward it." />
        </span>
      </div>

      <div className="row" style={{ margin: '0 0 14px', alignItems: 'center' }}>
        <strong style={{ fontSize: 12 }}>Traits</strong>
        <Info text="Innate character quirks that bend stats, injury odds, and growth. They stay hidden until a fighter has enough appearances or scouting." />
        {knownTraits(f).length > 0 ? (
          knownTraits(f).map((t) => (
            <span key={t} className="pill on" title={TRAITS[t].desc}>{TRAITS[t].label}</span>
          ))
        ) : traitsRevealed(f) ? (
          <span className="muted">None of note.</span>
        ) : (
          <span className="muted">Unknown — scout or field them to learn.</span>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px' }}>
        {CATEGORIES.map((cat) => (
          <div key={cat}>
            <h3>
              {CATEGORY_LABEL[cat]}
              <span className="muted" style={{ marginLeft: 8, textTransform: 'none', letterSpacing: 0 }}>
                effective {cats[cat].revealed ? cats[cat].mid : `~${cats[cat].mid}`}
              </span>
            </h3>
            <table className="grid">
              <tbody>
                {CATEGORY_SUBSTATS[cat].map((key) => (
                  <tr key={key}>
                    <td style={{ width: '45%' }}>{SUBSTAT_LABEL[key]}</td>
                    <td>
                      <EstimateBar estimate={subs[key]} hide={key === 'temperament'} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
      <p className="muted" style={{ marginTop: 14 }}>
        Bands show the range a value is believed to lie within; the marker is the current
        estimate. Temperament is a hidden attribute and is never shown as a number.
      </p>
    </div>
  );
}
