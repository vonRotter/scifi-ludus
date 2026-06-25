/**
 * Display labels and small formatting helpers for the UI.
 *
 * Single responsibility: map domain enums/keys to human strings. Presentation
 * only — no game logic, no calculation of values.
 */

import { Category, SubStatKey, BodyType, Posture, Focus, Role } from '../engine/types';

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
  sentinel: 'Sentinel', skirmisher: 'Skirmisher',
};

export const POSTURE_LABEL: Record<Posture, string> = {
  aggressive: 'Aggressive', balanced: 'Balanced', defensive: 'Defensive',
};

export const FOCUS_LABEL: Record<Focus, string> = {
  melee: 'Press melee', ranged: 'Hold ranged lines', objective: 'Contest objective',
};

export const ROLE_LABEL: Record<Role, string> = {
  frontline: 'Front line', skirmisher: 'Skirmisher', holdback: 'Hold back',
};
