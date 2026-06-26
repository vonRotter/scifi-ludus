/**
 * New-game composition: assemble a fresh GameState from content + schedule.
 *
 * Single responsibility: the one place that wires generated content, the
 * fixture list and the default player lineup into a starting GameState. Pure
 * and deterministic in its seed. No React, no I/O.
 */

import { ARENAS } from '../data/arenas';
import { generateContent } from '../data/seedFighters';
import { generateFixtures } from '../engine/season';
import { GameState, SAVE_VERSION } from './gameState';
import { defaultPlayerLineup } from './matchSetup';

/** Build a brand-new season. The same seed (and chosen player team) always yields the same game. */
export function createGame(seed: number, playerIndex = 0): GameState {
  const { teams, fighters, freeAgents, beasts } = generateContent(seed, playerIndex);
  const playerTeam = teams.find((t) => t.isPlayer)!;
  const fixtures = generateFixtures(teams, seed, ARENAS.map((a) => a.id));
  const playerLineup = defaultPlayerLineup(playerTeam.id, playerTeam.fighterIds, fighters);

  return {
    version: SAVE_VERSION,
    seed,
    fighters,
    teams,
    playerTeamId: playerTeam.id,
    fixtures,
    freeAgents,
    beasts,
    playerLineup,
  };
}
