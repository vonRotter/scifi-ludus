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
  'Zev', 'Ryl', 'Cael', 'Nova', 'Torr', 'Ashe', 'Vane', 'Sol', 'Wren',
  'Kade', 'Orin', 'Sixx', 'Dral', 'Ember', 'Halo', 'Roan', 'Xen', 'Marr',
];

// Circuit callsigns — the handle a fighter goes by on the broadcast.
const EPITHET = [
  'the Spike', 'Ironjaw', 'Coilgun', 'Blackout', 'Overdrive', 'the Quiet',
  'Redline', 'Deadlock', 'the Lean', 'Voidstep', 'Ghostwire', 'the Hollow',
  'Brightscar', 'Nullhand', 'Static', 'Sunder', 'Lowblade', 'the Gaunt',
  'Hammerfall', 'the Cold', 'Slipstream', 'Ashfall', 'Gunmetal', 'the Wire',
  'Backdraft', 'Nightshade', 'the Vice', 'Flatline', 'Ironsight', 'Havoc',
];

export const TEAM_NAMES = [
  'Ferro Combine',
  'Crimson Spire',
  'Ashfall Collective',
  'Null Pit Syndicate',
  'Vault of Korr',
  'Iron Meridian',
  'Sable Vanguard',
  'The Rustworks',
  'Halcyon Reavers',
  'Cinder League',
];

/** Assemble a fighter name deterministically from the rng. */
export function makeFighterName(rng: Rng): string {
  const given = rng.pick(GIVEN).trim();
  // Roughly half get a callsign, for FM-roster texture.
  if (rng.chance(0.5)) return `${given} "${rng.pick(EPITHET)}"`;
  return given;
}

// Surnames for the lanistas (stable managers) who run the rival schools.
const LANISTA_SURNAME = [
  'Volkov', 'Kaine', 'Draxler', 'Okonkwo', 'Vance', 'Solari', 'Reyes', 'Thorne',
  'Ashworth', 'Petrov', 'Kessler', 'Marlowe', 'Vasquez', 'Nakamura', 'Ferro', 'Cole',
];

/** A lanista's full name (given + surname), deterministically from the rng. */
export function makeLanistaName(rng: Rng): string {
  const given = rng.pick(GIVEN).trim().replace(/".*"/, '').trim();
  return `${given} ${rng.pick(LANISTA_SURNAME)}`;
}

const BEAST_PREFIX = [
  'Gore', 'Ash', 'Rend', 'Maw', 'Spine', 'Dread', 'Glut', 'Murk', 'Bone', 'Razor',
];
const BEAST_KIND = [
  'stalker', 'crawler', 'reaver', 'juggernaut', 'wraith', 'ripper', 'revenant', 'behemoth',
];

/** Assemble a gene-forged war-form's designation deterministically from the rng. */
export function makeBeastName(rng: Rng): string {
  return `${rng.pick(BEAST_PREFIX)}${rng.pick(BEAST_KIND)}`;
}
