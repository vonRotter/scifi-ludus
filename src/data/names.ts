/**
 * Name pools for generated fighters and teams (Phase 1 content).
 *
 * Single responsibility: static word lists + deterministic name assembly.
 * Pure data and pure helpers — no React, no Math.random (caller passes an rng).
 */

import { Rng } from '../engine/rng';

const GIVEN = [
  'Vex', 'Korr', 'Sable', 'Drael', 'Onyx', 'Mira', 'Tarn', 'Lyse', 'Cassix',
  'Bron', 'Nyx', 'Garth', 'Vala', 'Rax', 'Sten', 'Iko', 'Pell', 'Quill',
  'Dax', 'Yara', 'Hroth', 'Sev', 'Aro', 'Juno', 'Krell', 'Maul', 'Tace',
];

const EPITHET = [
  'the Spike', 'Ironjaw', 'the Pale', 'Coilfist', 'Ashborn', 'the Quiet',
  'Stormcut', 'Redhand', 'the Lean', 'Voidstep', 'Greywolf', 'the Hollow',
  'Brightscar', 'Nullhand', 'the Patient', 'Sunder', 'Lowblade', 'the Gaunt',
];

export const TEAM_NAMES = [
  'Iron Ludus',
  'Crimson Spire',
  'Ashfall School',
  'The Null Pit',
  'Vault of Korr',
];

/** Assemble a fighter name deterministically from the rng. */
export function makeFighterName(rng: Rng): string {
  const given = rng.pick(GIVEN).trim();
  // Roughly half get an epithet, for FM-roster texture.
  if (rng.chance(0.5)) return `${given} ${rng.pick(EPITHET)}`;
  return given;
}

const BEAST_PREFIX = [
  'Gore', 'Ash', 'Rend', 'Maw', 'Spine', 'Dread', 'Glut', 'Murk', 'Bone', 'Razor',
];
const BEAST_KIND = [
  'hound', 'crawler', 'saurian', 'maul-beast', 'stalker', 'brute', 'serpent', 'horror',
];

/** Assemble a menagerie creature's name deterministically from the rng. */
export function makeBeastName(rng: Rng): string {
  return `${rng.pick(BEAST_PREFIX)}${rng.pick(BEAST_KIND)}`;
}
