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
import { LEAGUE_SIZE } from '../engine/constants';
import { Difficulty, DIFFICULTY_SETTINGS } from '../engine/difficulty';
import { objectiveFor, START_CONFIDENCE } from '../engine/patron';
import { GameState, SAVE_VERSION } from './gameState';
import { defaultPlayerLineup } from './matchSetup';

/** Build a brand-new season. The same seed (and chosen player team) always yields the same game. */
export function createGame(seed: number, playerIndex = 0, difficulty: Difficulty = 'standard'): GameState {
  const content = generateContent(seed, playerIndex);
  const startingBudget = DIFFICULTY_SETTINGS[difficulty].startingBudget;
  const teams = content.teams.map((t) => ({ ...t, budget: startingBudget }));
  const { fighters, freeAgents, beasts } = content;
  const playerTeam = teams.find((t) => t.isPlayer)!;
  const fixtures = generateFixtures(teams, seed, ARENAS.map((a) => a.id));
  const playerLineup = defaultPlayerLineup(playerTeam.id, playerTeam.fighterIds, fighters);

  return {
    version: SAVE_VERSION,
    seed,
    difficulty,
    season: 1,
    fighters,
    teams,
    playerTeamId: playerTeam.id,
    fixtures,
    freeAgents,
    beasts,
    playerLineup,
    news: [
      {
        id: 'welcome',
        season: 1,
        week: 0,
        category: 'season',
        text: `Welcome to ${playerTeam.name}. Your first season begins — good luck in the arena.`,
      },
    ],
    objective: objectiveFor(playerTeam.reputation, LEAGUE_SIZE),
    patronConfidence: START_CONFIDENCE,
    hallOfFame: [],
    champions: [],
  };
}
