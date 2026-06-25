/**
 * Render a fog Estimate as a band with a point marker.
 *
 * Single responsibility: visualise one estimate (low..high band, mid marker,
 * or a hidden "?"). Pure presentation — it never computes the estimate.
 */

import { Estimate } from '../../engine/fog';
import { STAT_MAX } from '../../engine/constants';

interface Props {
  estimate: Estimate;
  /** When true, never show the point value (used for truly hidden stats). */
  hide?: boolean;
}

export function EstimateBar({ estimate, hide }: Props) {
  const pct = (v: number) => `${(v / STAT_MAX) * 100}%`;
  const bandLeft = pct(estimate.low);
  const bandWidth = `${((estimate.high - estimate.low) / STAT_MAX) * 100}%`;

  return (
    <span className={`estimate${estimate.revealed ? ' revealed' : ''}`} title={hide ? 'Hidden' : `est. ${estimate.low}–${estimate.high}`}>
      <span className="track">
        <span className="band" style={{ left: bandLeft, width: bandWidth }} />
        {!hide && <span className="mark" style={{ left: pct(estimate.mid) }} />}
      </span>
      <span className="val">
        {hide ? '?' : estimate.revealed ? estimate.mid : `~${estimate.mid}`}
      </span>
    </span>
  );
}
