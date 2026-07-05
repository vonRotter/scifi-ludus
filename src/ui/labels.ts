/**
 * Display labels and small formatting helpers for the UI.
 *
 * Single responsibility: map domain enums/keys to human strings. Presentation
 * only — no game logic, no calculation of values.
 */

import { AiPersonality, Category, SubStatKey, BodyType, Posture, Focus, Role, FacilityKind, HazardKind, SpecLevels, DOMAINS } from '../engine/types';
import { applyScoutingDiscount, beastsUnlocked, rosterCap, stadiumGate, trainingBonus } from '../engine/facilities';
import { recoveryStep } from '../engine/injury';

/** A one-line read on a rival lanista's tendencies, from their personality. */
export function lanistaBlurb(p: AiPersonality): string {
  const parts: string[] = [];
  if (p.aggression >= 0.6) parts.push('press early and rarely sit on a lead');
  else if (p.aggression <= 0.4) parts.push('play patient and soak pressure');
  else parts.push('pick their moments');
  if (p.scheming >= 0.6) parts.push('read and counter your setup');
  else if (p.scheming <= 0.4) parts.push('back their own game over yours');
  return parts.join('; ');
}

export const SUBSTAT_LABEL: Record<SubStatKey, string> = {
  strength: 'Strength', technique: 'Technique', agility: 'Agility',
  eyesight: 'Eyesight', steadiness: 'Steadiness', handling: 'Reload/Handling',
  toughness: 'Toughness', reflexes: 'Reflexes', armourUse: 'Armour-use',
  temperament: 'Temperament', awareness: 'Awareness', discipline: 'Discipline',
  acceleration: 'Acceleration', stamina: 'Stamina', manoeuvre: 'Manoeuvre',
};

export const CATEGORY_LABEL: Record<Category, string> = {
  melee: 'Melee', ranged: 'Ranged', defence: 'Defence', mental: 'Mental', speed: 'Speed',
};

export const HAZARD_LABEL: Record<HazardKind, string> = {
  plasma: 'Ion vent', gravwell: 'Grav-shear',
};

export const HAZARD_DESC: Record<HazardKind, string> = {
  plasma: 'Burns anyone who lingers in it.',
  gravwell: 'Drags on movement — cross slowly, or go round.',
};

/** A compact "Melee 2 · Ranged 1" summary of a stable's specializations, or "—". */
export function specSummary(spec: SpecLevels): string {
  const parts = DOMAINS.filter((d) => (spec[d] ?? 0) > 0).map((d) => `${CATEGORY_LABEL[d]} ${spec[d]}`);
  return parts.length > 0 ? parts.join(' · ') : '—';
}

export const BODYTYPE_LABEL: Record<BodyType, string> = {
  brute: 'Brute', duellist: 'Duellist', marksman: 'Marksman',
  sentinel: 'Sentinel', skirmisher: 'Skirmisher', beast: 'War-form',
};

export const POSTURE_LABEL: Record<Posture, string> = {
  aggressive: 'Aggressive', balanced: 'Balanced', defensive: 'Defensive',
};

export const POSTURE_DESC: Record<Posture, string> = {
  aggressive: 'Deal more damage but take more in return, and close distance faster.',
  balanced: 'No bonus or penalty either way.',
  defensive: 'Take less damage and hold range longer, at the cost of dealing less.',
};

export const FOCUS_LABEL: Record<Focus, string> = {
  melee: 'Press melee', ranged: 'Hold ranged lines', objective: 'Contest objective',
};

export const FOCUS_DESC: Record<Focus, string> = {
  melee: 'Everyone pushes in tighter, favouring close-quarters fighting.',
  ranged: 'Everyone holds a wider standoff distance, favouring shooting over closing in.',
  objective: 'Skirmishers join your holdbacks in guarding the scoring zone instead of chasing enemies.',
};

export const ROLE_LABEL: Record<Role, string> = {
  frontline: 'Front line', skirmisher: 'Skirmisher', holdback: 'Hold back',
};

export const ROLE_DESC: Record<Role, string> = {
  frontline: 'Closes to melee range and presses the nearest enemy.',
  skirmisher: 'Keeps a ranged standoff distance from the nearest enemy — unless your focus is "Contest objective", then it guards the zone instead.',
  holdback: 'Always guards the central objective zone and never chases enemies.',
};

export const FACILITY_LABEL: Record<FacilityKind, string> = {
  training: 'Sim Deck', scouting: 'Recon Network', armoury: 'Hardsuit Bay',
  weaponsmith: 'Arms Fabricator', housing: 'Crew Quarters', medbay: 'Med-Bay',
  menagerie: 'Genelab', stadium: 'Broadcast Rig',
};

export const FACILITY_DESC: Record<FacilityKind, string> = {
  training: "Improves your roster's odds of gaining a sub-stat each week they drill.",
  scouting: 'Discounts every recon report you commission on a free agent.',
  armoury: "Fits your fielded fighters with hardsuit plating — extra toughness and armour-use for the match.",
  weaponsmith: "Tunes your fielded fighters' weapons — extra technique and reload/handling for the match.",
  housing: 'Better-rested fighters take the deck with sharper awareness and discipline.',
  medbay: 'Injured fighters recover faster, missing fewer match weeks.',
  menagerie: 'Decants gene-forged war-forms you can field, more at each level.',
  stadium: 'Banks broadcast fees every time you host a fixture at home.',
};

/**
 * Each facility's category and accent colour, so the cards colour-code at a
 * glance: blue = development, red = combat, green = welfare, cyan = roster,
 * amber = economy. The colour is a CSS custom-property reference.
 */
export const FACILITY_CATEGORY: Record<FacilityKind, { label: string; color: string }> = {
  training: { label: 'Development', color: 'var(--player)' },
  scouting: { label: 'Development', color: 'var(--player)' },
  armoury: { label: 'Combat', color: 'var(--rival)' },
  weaponsmith: { label: 'Combat', color: 'var(--rival)' },
  housing: { label: 'Welfare', color: 'var(--good)' },
  medbay: { label: 'Welfare', color: 'var(--good)' },
  menagerie: { label: 'Roster', color: 'var(--cyan)' },
  stadium: { label: 'Economy', color: 'var(--accent)' },
};

/**
 * A short, human summary of what a facility does at a given level — "+16%
 * training" at level 2, "—" when nothing's built. Reads the engine's effect
 * functions so the numbers can never drift from the rules. Presentation only.
 */
export function facilityEffect(kind: FacilityKind, level: number): string {
  if (level <= 0) return '—';
  switch (kind) {
    case 'training':
      return `+${Math.round(trainingBonus(level) * 100)}% growth chance`;
    case 'scouting':
      return `${Math.round((1 - applyScoutingDiscount(100, level) / 100) * 100)}% off reports`;
    case 'armoury':
      return `+${level} toughness & armour-use`;
    case 'weaponsmith':
      return `+${level} technique & handling`;
    case 'housing':
      return `+${level} awareness & discipline, ${rosterCap(level)} berths`;
    case 'medbay':
      return `heals ${recoveryStep(level)} weeks per match week`;
    case 'menagerie':
      return `${beastsUnlocked(level)} war-forms available to decant`;
    case 'stadium':
      return `+${stadiumGate(level)}c per home match`;
  }
}
