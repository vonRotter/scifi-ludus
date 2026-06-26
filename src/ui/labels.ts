/**
 * Display labels and small formatting helpers for the UI.
 *
 * Single responsibility: map domain enums/keys to human strings. Presentation
 * only — no game logic, no calculation of values.
 */

import { Category, SubStatKey, BodyType, Posture, Focus, Role, FacilityKind } from '../engine/types';
import { applyScoutingDiscount, beastsUnlocked, rosterCap, stadiumGate, trainingBonus } from '../engine/facilities';
import { recoveryStep } from '../engine/injury';

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

export const BODYTYPE_LABEL: Record<BodyType, string> = {
  brute: 'Brute', duellist: 'Duellist', marksman: 'Marksman',
  sentinel: 'Sentinel', skirmisher: 'Skirmisher', beast: 'Beast',
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
  training: 'Training Ground', scouting: 'Scouting Network', armoury: 'Armoury',
  weaponsmith: 'Weaponsmith', housing: 'Housing', medbay: 'Medical Bay',
  menagerie: 'Menagerie', stadium: 'Stadium',
};

export const FACILITY_DESC: Record<FacilityKind, string> = {
  training: "Improves your roster's odds of gaining a sub-stat each week they train.",
  scouting: 'Discounts every scouting report you commission on a free agent.',
  armoury: "Equips your fielded fighters with extra toughness and armour-use for the match.",
  weaponsmith: "Equips your fielded fighters with extra technique and reload/handling for the match.",
  housing: 'Better-rested fighters take the field with sharper awareness and discipline.',
  medbay: 'Injured fighters recover faster, missing fewer match weeks.',
  menagerie: 'Unlocks wild creatures you can tame and field, more at each level.',
  stadium: 'Banks gate receipts every time you play a fixture at home.',
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
      return `+${level} awareness & discipline, ${rosterCap(level)} beds`;
    case 'medbay':
      return `heals ${recoveryStep(level)} weeks per match week`;
    case 'menagerie':
      return `${beastsUnlocked(level)} beasts available to tame`;
    case 'stadium':
      return `+${stadiumGate(level)}c per home match`;
  }
}
