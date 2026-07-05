/**
 * Line-up & tactics tab: choose six fighters, assign roles, set posture/focus,
 * and save. A thin wrapper over LineupEditor — edits are local until saved.
 * Presentation + store action only, no rules.
 */

import { useState } from 'react';
import { GameState } from '../../state/gameState';
import { saveLineup } from '../../state/gameStore';
import { SQUAD_SIZE } from '../../engine/constants';
import { Lineup } from '../../engine/types';
import { LineupEditor } from './LineupEditor';

export function LineupScreen({ game }: { game: GameState }) {
  const [draft, setDraft] = useState<Lineup>(game.playerLineup);
  const valid = draft.fighterIds.length === SQUAD_SIZE;

  return (
    <div>
      <div className="spread">
        <h2 style={{ border: 'none', margin: 0 }}>Line-up &amp; Tactics</h2>
        <button className="btn" disabled={!valid} onClick={() => saveLineup(draft)}>
          {valid ? 'Save Line-up' : `Select ${SQUAD_SIZE - draft.fighterIds.length} more`}
        </button>
      </div>
      <LineupEditor game={game} draft={draft} onChange={setDraft} />
    </div>
  );
}
