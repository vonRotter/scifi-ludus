/**
 * Procedural match audio — a subtle, synthesised arena bed and a soft down cue.
 *
 * Single responsibility: own a tiny Web Audio graph so matches have atmosphere
 * WITHOUT any asset files. Everything here is generated (oscillators + a filter),
 * kept deliberately quiet, and gated by a mute toggle persisted in localStorage.
 * No game rules, no React. Safe to import anywhere — the AudioContext is created
 * lazily on first use (from a user gesture), so nothing plays unbidden.
 */

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let ambience: { stop: () => void } | null = null;
let muted = readMuted();

const KEY = 'ludus-sound';

function readMuted(): boolean {
  try { return localStorage.getItem(KEY) === 'off'; } catch { return false; }
}

export function isSoundOn(): boolean { return !muted; }

/** Toggle sound; persists the choice and stops the bed if turning off. */
export function setSoundOn(on: boolean): void {
  muted = !on;
  try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* ignore */ }
  if (master && ctx) master.gain.setTargetAtTime(muted ? 0 : 1, ctx.currentTime, 0.05);
  if (!on) stopMatchAmbience();
}

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) {
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 1;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => { /* gesture needed */ });
  return ctx;
}

/**
 * Start the ambient bed: a quiet detuned low drone through a lowpass whose
 * cutoff drifts on a very slow LFO, so it breathes without ever calling
 * attention to itself. No-op if already running or muted.
 */
export function startMatchAmbience(): void {
  const c = getCtx();
  if (!c || !master || ambience || muted) return;
  const now = c.currentTime;

  const bed = c.createGain();
  bed.gain.value = 0;
  bed.gain.setTargetAtTime(0.09, now, 1.5); // slow, quiet fade-in
  bed.connect(master);

  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 420;
  lp.Q.value = 0.6;
  lp.connect(bed);

  // Slow filter movement.
  const lfo = c.createOscillator();
  lfo.frequency.value = 0.05;
  const lfoGain = c.createGain();
  lfoGain.gain.value = 150;
  lfo.connect(lfoGain).connect(lp.frequency);
  lfo.start();

  // A low root, a hair-detuned twin, and a soft fifth above.
  const voices: Array<[number, OscillatorType, number]> = [
    [55, 'triangle', 1], [55.35, 'triangle', 1], [82.5, 'sine', 0.5],
  ];
  const oscs = voices.map(([f, type, g]) => {
    const osc = c.createOscillator();
    osc.type = type;
    osc.frequency.value = f;
    const vg = c.createGain();
    vg.gain.value = g;
    osc.connect(vg).connect(lp);
    osc.start();
    return osc;
  });

  ambience = {
    stop: () => {
      const t = c.currentTime;
      bed.gain.setTargetAtTime(0, t, 0.4);
      const at = t + 1.2;
      [lfo, ...oscs].forEach((o) => { try { o.stop(at); } catch { /* already stopped */ } });
    },
  };
}

export function stopMatchAmbience(): void {
  if (ambience) { ambience.stop(); ambience = null; }
}

/** A soft, short low "thunk" for the moment a fighter goes down. */
export function playDown(): void {
  const c = getCtx();
  if (!c || !master || muted) return;
  const now = c.currentTime;
  const g = c.createGain();
  g.gain.value = 0;
  g.connect(master);
  const osc = c.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(190, now);
  osc.frequency.exponentialRampToValueAtTime(60, now + 0.18);
  g.gain.linearRampToValueAtTime(0.15, now + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0008, now + 0.28);
  osc.connect(g);
  osc.start(now);
  osc.stop(now + 0.32);
}
