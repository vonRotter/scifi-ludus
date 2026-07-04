/**
 * Opponent intel: what a stable can learn about its next foe before a match.
 *
 * Single responsibility: read a rival roster into a scouting picture — their
 * likely six, their (fogged) category strengths, and how they tend to fight —
 * with the amount revealed gated by the viewer's Recon Network. Pure: it reads
 * fighters and returns data, no React, no state, no Math.random. The fighter
 * numbers stay fogged by each fighter's own public record (see fog.ts); recon
 * buys DETAIL (their line-up and read), not x-ray vision on hidden stats.
 */

import { overall } from './attributes';
import { estimateCategories } from './fog';
import { isInjured } from './injury';
import { SQUAD_SIZE } from './constants';
import { Category, CATEGORIES, Fighter, Focus } from './types';

/** How much the Recon Network reveals about an opponent. */
export type IntelDetail = 'coarse' | 'lineup' | 'detailed';

export interface OpponentIntel {
  /** The six they're most likely to field (fit first, best by overall). */
  projected: Fighter[];
  /** Estimated (fogged) average category score across the projected six. */
  profile: Record<Category, number>;
  /** Their standout category, from the profile. */
  topCategory: Category;
  /** The focus their composition implies they'll fight with. */
  tendency: Focus;
  /** How much of the above the viewer's recon justifies showing. */
  detail: IntelDetail;
}

/** The six a rival is most likely to field: fit fighters first, best by overall. */
export function projectedSquad(roster: Fighter[]): Fighter[] {
  const byOverall = (a: Fighter, b: Fighter) => overall(b) - overall(a);
  const fit = roster.filter((f) => !isInjured(f)).sort(byOverall);
  const hurt = roster.filter((f) => isInjured(f)).sort(byOverall);
  return [...fit, ...hurt].slice(0, SQUAD_SIZE);
}

/** Recon Network level -> how much intel detail it unlocks. */
export function intelDetail(reconLevel: number): IntelDetail {
  if (reconLevel >= 2) return 'detailed';
  if (reconLevel >= 1) return 'lineup';
  return 'coarse';
}

/**
 * Build the intel picture for an opponent roster at a given Recon Network level.
 * The profile is the mean of each fighter's fogged category estimate, so a squad
 * of well-known veterans reads sharply and a squad of rookies reads murkily.
 */
export function readOpponent(roster: Fighter[], reconLevel: number): OpponentIntel {
  const projected = projectedSquad(roster);
  const profile = {} as Record<Category, number>;
  for (const cat of CATEGORIES) profile[cat] = 0;
  for (const f of projected) {
    const est = estimateCategories(f);
    for (const cat of CATEGORIES) profile[cat] += est[cat].mid;
  }
  const n = Math.max(1, projected.length);
  for (const cat of CATEGORIES) profile[cat] = Math.round(profile[cat] / n);

  let topCategory: Category = CATEGORIES[0];
  for (const cat of CATEGORIES) if (profile[cat] > profile[topCategory]) topCategory = cat;

  // Tendency mirrors the AI's own focus logic: shoot if notably ranged, press if
  // notably melee, otherwise contest the objective.
  const tendency: Focus =
    profile.ranged > profile.melee * 1.1 ? 'ranged'
      : profile.melee > profile.ranged * 1.1 ? 'melee'
        : 'objective';

  return { projected, profile, topCategory, tendency, detail: intelDetail(reconLevel) };
}

/** One fighter's standout category, by fogged estimate — for detailed recon. */
export function fighterTopCategory(f: Fighter): Category {
  const est = estimateCategories(f);
  let top: Category = CATEGORIES[0];
  for (const c of CATEGORIES) if (est[c].mid > est[top].mid) top = c;
  return top;
}
