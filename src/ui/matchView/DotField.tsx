/**
 * The dot renderer: draw one engine Frame onto a canvas as a neon arena.
 *
 * Single responsibility: paint the arena floor, hazards, the objective core and
 * the fighters (with glow, facing, motion trails and attack effects) for the
 * given frame. It CONSUMES the engine's timeline and computes nothing about the
 * match — no rules, no simulation. All motion/pulse is derived from the frame's
 * own tick index, so it stays a pure function of the timeline (no wall clock).
 */

import { useEffect, useRef } from 'react';
import { Arena, Frame, Side } from '../../engine/types';

const SCALE = 2; // device pixels per field unit
const TRAIL = 7; // how many past positions to keep per fighter

interface Props {
  arena: Arena;
  frame: Frame;
  /** Which side is the player's, so we colour their fighters distinctly. */
  playerSide: Side;
  /** Squad number (1..6) to print on each fighter's dot, keyed by fighter id. */
  numbers: Record<string, number>;
  /** Fired once at the moment a fighter goes down (for a soft audio cue). */
  onDown?: () => void;
}

interface Team { dot: string; glow: string; ring: string; trail: string; }
const PLAYER: Team = { dot: '#57b0ff', glow: 'rgba(90,180,255,0.9)', ring: '#bfe0ff', trail: 'rgba(90,180,255,0.5)' };
const RIVAL: Team = { dot: '#ff6f60', glow: 'rgba(255,120,100,0.9)', ring: '#ffd0cb', trail: 'rgba(255,120,100,0.5)' };

export function DotField({ arena, frame, playerSide, numbers, onDown }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  // Recent positions per fighter, for motion trails. Cleared when the timeline
  // restarts (a new round or a replay steps back to the start).
  const trails = useRef<Map<string, Array<[number, number]>>>(new Map());
  const alive = useRef<Map<string, boolean>>(new Map()); // last-seen alive state
  const flash = useRef<Map<string, number>>(new Map()); // down-burst frames left
  const lastHp = useRef<Map<string, number>>(new Map()); // last-seen hp fraction
  const hurt = useRef<Map<string, { n: number; mag: number }>>(new Map()); // hit-flash
  const lastT = useRef<number>(-1);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const t = frame.t;
    if (t <= lastT.current) {
      // reset/replay (also on a backward scrub): drop all cross-frame memory.
      trails.current.clear(); alive.current.clear(); flash.current.clear();
      lastHp.current.clear(); hurt.current.clear();
    }
    lastT.current = t;
    const pulse = 0.5 + 0.5 * Math.sin(t * 0.12);

    // Detect fresh downs for a burst + optional audio cue, and damage taken
    // between frames for a hit flash — both derived from the timeline alone, so
    // the renderer stays a pure consumer of engine output (no new frame fields).
    for (const f of frame.fighters) {
      const was = alive.current.get(f.id);
      if (was && !f.alive) { flash.current.set(f.id, 5); onDown?.(); }
      const prevHp = lastHp.current.get(f.id);
      if (prevHp != null && f.alive && f.hp < prevHp - 0.008) {
        // Magnitude scales with the size of the hit (fraction of max HP lost).
        const mag = Math.min(1, (prevHp - f.hp) / 0.22);
        hurt.current.set(f.id, { n: 3, mag });
      }
      alive.current.set(f.id, f.alive);
      lastHp.current.set(f.id, f.hp);
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(SCALE, SCALE);
    const W = arena.width;
    const H = arena.height;

    // --- Floor: a dark deck with a faint tech grid and an edge vignette. ------
    ctx.fillStyle = '#0c161e';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(120,180,220,0.05)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 30; x < W; x += 30) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
    for (let y = 30; y < H; y += 30) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
    ctx.stroke();
    const vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.62);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);

    // --- Hazards, under everything. ------------------------------------------
    for (const h of arena.hazards ?? []) {
      ctx.beginPath();
      ctx.arc(h.x, h.y, h.r, 0, Math.PI * 2);
      if (h.kind === 'plasma') {
        const g = ctx.createRadialGradient(h.x, h.y, 0, h.x, h.y, h.r);
        const a = 0.24 + pulse * 0.14;
        g.addColorStop(0, `rgba(255,120,40,${a})`);
        g.addColorStop(1, 'rgba(255,120,40,0)');
        ctx.fillStyle = g;
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,150,70,0.5)';
      } else {
        ctx.fillStyle = 'rgba(150,110,230,0.12)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(170,130,240,0.5)';
        // Concentric shear rings.
        ctx.lineWidth = 1;
        for (let i = 1; i <= 2; i++) {
          ctx.beginPath();
          ctx.arc(h.x, h.y, (h.r * i) / 3, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.arc(h.x, h.y, h.r, 0, Math.PI * 2);
      }
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // --- Objective: a glowing core that brightens while it's contested. ------
    const o = arena.objective;
    const contested = frame.fighters.some((f) => f.alive && Math.hypot(f.x - o.x, f.y - o.y) <= o.r);
    const heat = contested ? 0.26 : 0.12;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const core = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.r);
    core.addColorStop(0, `rgba(210,180,90,${heat + pulse * 0.12})`);
    core.addColorStop(1, 'rgba(210,180,90,0)');
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = `rgba(220,190,110,${(contested ? 0.6 : 0.4) + pulse * 0.35})`;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 5]);
    ctx.lineDashOffset = -t * 0.4;
    ctx.beginPath();
    ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineDashOffset = 0;

    // --- Obstacles: raised blocks with a lit top edge. -----------------------
    for (const b of arena.obstacles) {
      ctx.fillStyle = '#0f1820';
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.strokeStyle = 'rgba(120,170,210,0.25)';
      ctx.lineWidth = 1;
      ctx.strokeRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1);
      ctx.fillStyle = 'rgba(120,170,210,0.15)';
      ctx.fillRect(b.x, b.y, b.w, 2);
    }

    // --- Motion trails (drawn under the fighters). ---------------------------
    const seen = new Set<string>();
    for (const f of frame.fighters) {
      seen.add(f.id);
      const hist = trails.current.get(f.id) ?? [];
      if (f.alive) {
        hist.push([f.x, f.y]);
        while (hist.length > TRAIL) hist.shift();
        trails.current.set(f.id, hist);
      }
      if (hist.length < 2) continue;
      const team = f.side === playerSide ? PLAYER : RIVAL;
      for (let i = 1; i < hist.length; i++) {
        const a = (i / hist.length) * 0.5 * (f.alive ? 1 : 0.3);
        ctx.strokeStyle = team.trail.replace('0.5', a.toFixed(2));
        ctx.lineWidth = (i / hist.length) * 2.4;
        ctx.beginPath();
        ctx.moveTo(hist[i - 1][0], hist[i - 1][1]);
        ctx.lineTo(hist[i][0], hist[i][1]);
        ctx.stroke();
      }
    }
    for (const id of [...trails.current.keys()]) if (!seen.has(id)) trails.current.delete(id);

    // --- Fighters. -----------------------------------------------------------
    for (const f of frame.fighters) {
      const team = f.side === playerSide ? PLAYER : RIVAL;
      const fx = Math.cos(f.facing);
      const fy = Math.sin(f.facing);

      if (!f.alive) {
        // A brief expanding spark burst at the moment (and just after) a down.
        const fl = flash.current.get(f.id) ?? 0;
        if (fl > 0) {
          const k = fl / 5; // 1 -> 0 as it fades
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.strokeStyle = `rgba(255,220,150,${k * 0.85})`;
          ctx.lineWidth = 1.5 * k + 0.4;
          ctx.beginPath();
          ctx.arc(f.x, f.y, 4 + (1 - k) * 16, 0, Math.PI * 2);
          ctx.stroke();
          for (let s = 0; s < 6; s++) {
            const a = (s / 6) * Math.PI * 2;
            const r0 = 3, r1 = 5 + (1 - k) * 12;
            ctx.beginPath();
            ctx.moveTo(f.x + Math.cos(a) * r0, f.y + Math.sin(a) * r0);
            ctx.lineTo(f.x + Math.cos(a) * r1, f.y + Math.sin(a) * r1);
            ctx.stroke();
          }
          ctx.restore();
          flash.current.set(f.id, fl - 1);
        }
        ctx.strokeStyle = f.side === playerSide ? 'rgba(90,140,190,0.45)' : 'rgba(180,90,80,0.45)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(f.x - 3, f.y - 3); ctx.lineTo(f.x + 3, f.y + 3);
        ctx.moveTo(f.x + 3, f.y - 3); ctx.lineTo(f.x - 3, f.y + 3);
        ctx.stroke();
        continue;
      }

      const r = 3 + f.hp * 3.5;

      // Attack / action effects (additive for a neon bloom).
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      if (f.action === 'ranged') {
        const len = 46;
        const grad = ctx.createLinearGradient(f.x + fx * r, f.y + fy * r, f.x + fx * (r + len), f.y + fy * (r + len));
        const beam = f.side === playerSide ? '160,220,255' : '255,190,150';
        grad.addColorStop(0, `rgba(${beam},0.95)`);
        grad.addColorStop(1, `rgba(${beam},0)`);
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(f.x + fx * r, f.y + fy * r);
        ctx.lineTo(f.x + fx * (r + len), f.y + fy * (r + len));
        ctx.stroke();
        // muzzle spark
        ctx.fillStyle = `rgba(${beam},0.9)`;
        ctx.beginPath();
        ctx.arc(f.x + fx * (r + 2), f.y + fy * (r + 2), 1.6, 0, Math.PI * 2);
        ctx.fill();
      } else if (f.action === 'melee') {
        // A bright slash arc across the fighter's front.
        ctx.strokeStyle = '#ffe27a';
        ctx.lineWidth = 2;
        const a0 = f.facing - 0.7;
        const a1 = f.facing + 0.7;
        ctx.beginPath();
        ctx.arc(f.x, f.y, r + 4, a0, a1);
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,226,122,0.9)';
        ctx.beginPath();
        ctx.arc(f.x + fx * (r + 4), f.y + fy * (r + 4), 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      if (f.action === 'guarding') {
        ctx.strokeStyle = `rgba(210,185,100,${0.4 + pulse * 0.4})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(f.x, f.y, r + 3, 0, Math.PI * 2);
        ctx.stroke();
      } else if (f.action === 'chasing') {
        ctx.beginPath();
        ctx.moveTo(f.x + fx * (r + 4), f.y + fy * (r + 4));
        ctx.lineTo(f.x + Math.cos(f.facing + 2.5) * (r + 1), f.y + Math.sin(f.facing + 2.5) * (r + 1));
        ctx.lineTo(f.x + Math.cos(f.facing - 2.5) * (r + 1), f.y + Math.sin(f.facing - 2.5) * (r + 1));
        ctx.closePath();
        ctx.fillStyle = f.side === playerSide ? 'rgba(63,143,214,0.7)' : 'rgba(214,91,80,0.7)';
        ctx.fill();
      }

      // The unit: a glowing core with a facing notch. A tiring fighter glows
      // less (energy dims the bloom), so fatigue reads at a glance, no legend.
      ctx.save();
      ctx.shadowColor = team.glow;
      const tired = 0.5 + 0.5 * f.energy; // 1.0 fresh -> 0.5 spent
      ctx.shadowBlur = (f.hp < 0.3 ? 4 + pulse * 6 : 8) * tired; // low HP flickers
      ctx.fillStyle = team.dot;
      ctx.beginPath();
      ctx.arc(f.x, f.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Fatigue veil: a faint dark wash over spent fighters, deepening as energy
      // drops, so they visibly fade the harder they've been run.
      if (f.energy < 0.66) {
        ctx.fillStyle = `rgba(8,12,16,${(0.66 - f.energy) * 0.6})`;
        ctx.beginPath();
        ctx.arc(f.x, f.y, r, 0, Math.PI * 2);
        ctx.fill();
      }

      // Hit flash: a brief white bloom over the dot the instant it takes damage,
      // brighter for bigger hits. A miss simply produces no flash — it reads as a
      // whiff by its absence, which is exactly the causal cue we want.
      const hh = hurt.current.get(f.id);
      if (hh && hh.n > 0) {
        const k = hh.n / 3;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = `rgba(255,255,255,${(0.3 + hh.mag * 0.5) * k})`;
        ctx.beginPath();
        ctx.arc(f.x, f.y, r + 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        hurt.current.set(f.id, { n: hh.n - 1, mag: hh.mag });
      }

      // Facing notch.
      ctx.strokeStyle = team.ring;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(f.x + fx * (r - 1), f.y + fy * (r - 1));
      ctx.lineTo(f.x + fx * (r + 2.5), f.y + fy * (r + 2.5));
      ctx.stroke();

      // Health arc.
      ctx.beginPath();
      ctx.arc(f.x, f.y, r + 1.8, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * f.hp);
      ctx.strokeStyle = f.hp < 0.35 ? '#ff8a7e' : team.ring;
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // Squad number.
      const num = numbers[f.id];
      if (num != null) {
        ctx.fillStyle = '#05090d';
        ctx.font = 'bold 6px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(num), f.x, f.y);
      }
    }

    ctx.restore();
  }, [arena, frame, playerSide, numbers]);

  return (
    <canvas
      ref={ref}
      className="field"
      width={arena.width * SCALE}
      height={arena.height * SCALE}
    />
  );
}
