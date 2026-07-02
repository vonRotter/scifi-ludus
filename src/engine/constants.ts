/**
 * Engine tuning constants.
 *
 * Single responsibility: hold the magic numbers the simulation shares, in one
 * place, so the feel can be tuned without hunting through logic. No logic here.
 */

/** Fighters per side on the field. */
export const SQUAD_SIZE = 6;

/** Number of schools in the league, including the player's. */
export const LEAGUE_SIZE = 4;

/** Roster size per team (enough to field six and bench a few). */
export const ROSTER_SIZE = 9;

/** Sub-stat integer range. */
export const STAT_MIN = 1;
export const STAT_MAX = 20;

/** Simulation ticks per round (10/sec for ~60s). */
export const TICKS_PER_ROUND = 600;

/** How often (in ticks) we record a render frame. Lower = smoother, bigger. */
export const FRAME_EVERY = 3;

/** League points. */
export const POINTS_WIN = 3;
export const POINTS_DRAW = 1;

/** Scoring weights. */
export const SCORE_PER_DOWN = 10;
export const OBJECTIVE_SCORE_RATE = 0.041; // points per tick of sole control
