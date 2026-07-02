/**
 * Reputation: a ludus's standing, built up across seasons.
 *
 * Single responsibility: the pure rules for how a season's finish earns
 * reputation, what tier a reputation total sits in, and the small recruiting
 * edge a renowned school enjoys. No React, no randomness, no state ownership —
 * the state layer holds each team's running total and calls these at rollover.
 */

/** Reputation earned for a final league placement (1-based rank). */
export function reputationGain(rank: number, leagueSize: number): number {
  // Winning the league is worth the most; it tapers to a token amount for last.
  const top = 30;
  const bottom = 4;
  if (leagueSize <= 1) return top;
  const frac = (rank - 1) / (leagueSize - 1);
  return Math.round(top - frac * (top - bottom));
}

/** Named standing tiers, from unknown upstart to arena legend. */
const TIERS: [number, string][] = [
  [0, 'Unknown'],
  [40, 'Local'],
  [90, 'Regional'],
  [160, 'Renowned'],
  [250, 'Legendary'],
];

/** The tier label for a reputation total. */
export function reputationTier(reputation: number): string {
  let label = TIERS[0][1];
  for (const [threshold, name] of TIERS) {
    if (reputation >= threshold) label = name;
  }
  return label;
}

/**
 * The bonus a school's reputation adds to the hidden potential of the youth
 * prospects it attracts — better youngsters want to join a famous ludus. Capped
 * so reputation tilts the intake without trivialising it.
 */
export function prospectPotentialBoost(reputation: number): number {
  return Math.min(4, Math.floor(reputation / 60));
}
