/**
 * The dot renderer: draw one engine Frame onto a canvas.
 *
 * Single responsibility: paint terrain, the objective zone and the fighters as
 * coloured dots for the given frame. It CONSUMES the engine's timeline and
 * computes nothing about the match — no rules, no simulation.
 */

import { useEffect, useRef } from 'react';
import { Arena, Frame, Side } from '../../engine/types';

const SCALE = 2; // device pixels per field unit

interface Props {
  arena: Arena;
  frame: Frame;
  /** Which side is the player's, so we colour their fighters distinctly. */
  playerSide: Side;
  /** Squad number (1..6) to print on each fighter's dot, keyed by fighter id. */
  numbers: Record<string, number>;
}

export function DotField({ arena, frame, playerSide, numbers }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(SCALE, SCALE);

    // Objective zone.
    ctx.beginPath();
    ctx.arc(arena.objective.x, arena.objective.y, arena.objective.r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(200,180,90,0.10)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(200,180,90,0.55)';
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Hazards, drawn under the obstacles and fighters. Plasma vents glow
    // orange-red; grav-shear wells are a cool violet with a pulled-in ring.
    for (const h of arena.hazards ?? []) {
      ctx.beginPath();
      ctx.arc(h.x, h.y, h.r, 0, Math.PI * 2);
      if (h.kind === 'plasma') {
        const g = ctx.createRadialGradient(h.x, h.y, 0, h.x, h.y, h.r);
        g.addColorStop(0, 'rgba(255,120,40,0.34)');
        g.addColorStop(1, 'rgba(255,120,40,0)');
        ctx.fillStyle = g;
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,140,60,0.55)';
      } else {
        ctx.fillStyle = 'rgba(150,110,230,0.14)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(170,130,240,0.5)';
      }
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Obstacles.
    ctx.fillStyle = '#11181f';
    for (const o of arena.obstacles) ctx.fillRect(o.x, o.y, o.w, o.h);

    // Fighters.
    for (const f of frame.fighters) {
      const player = f.side === playerSide;
      if (!f.alive) {
        ctx.strokeStyle = player ? 'rgba(90,140,190,0.5)' : 'rgba(180,90,80,0.5)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(f.x - 3, f.y - 3);
        ctx.lineTo(f.x + 3, f.y + 3);
        ctx.moveTo(f.x + 3, f.y - 3);
        ctx.lineTo(f.x - 3, f.y + 3);
        ctx.stroke();
        continue;
      }
      const r = 3 + f.hp * 3.5;

      // Action cue, drawn first so the dot sits on top of it.
      const fx = Math.cos(f.facing);
      const fy = Math.sin(f.facing);
      if (f.action === 'ranged') {
        // A bright tracer reaching toward the target.
        ctx.beginPath();
        ctx.moveTo(f.x + fx * r, f.y + fy * r);
        ctx.lineTo(f.x + fx * (r + 14), f.y + fy * (r + 14));
        ctx.strokeStyle = player ? 'rgba(160,220,255,0.9)' : 'rgba(255,200,160,0.9)';
        ctx.lineWidth = 1;
        ctx.stroke();
      } else if (f.action === 'melee') {
        // A short bright lunge spike toward the target.
        ctx.beginPath();
        ctx.moveTo(f.x + fx * r, f.y + fy * r);
        ctx.lineTo(f.x + fx * (r + 5), f.y + fy * (r + 5));
        ctx.strokeStyle = '#ffe27a';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else if (f.action === 'guarding') {
        // A small static ring: holding ground rather than moving toward anyone.
        ctx.beginPath();
        ctx.arc(f.x, f.y, r + 3, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(200,180,90,0.6)';
        ctx.lineWidth = 1;
        ctx.stroke();
      } else if (f.action === 'chasing') {
        // A small forward-pointing wedge: actively closing on a target.
        ctx.beginPath();
        ctx.moveTo(f.x + fx * (r + 4), f.y + fy * (r + 4));
        ctx.lineTo(f.x + Math.cos(f.facing + 2.5) * (r + 1), f.y + Math.sin(f.facing + 2.5) * (r + 1));
        ctx.lineTo(f.x + Math.cos(f.facing - 2.5) * (r + 1), f.y + Math.sin(f.facing - 2.5) * (r + 1));
        ctx.closePath();
        ctx.fillStyle = player ? 'rgba(63,143,214,0.7)' : 'rgba(214,91,80,0.7)';
        ctx.fill();
      }

      ctx.beginPath();
      ctx.arc(f.x, f.y, r, 0, Math.PI * 2);
      ctx.fillStyle = player ? '#3f8fd6' : '#d65b50';
      ctx.fill();
      // Health ring.
      ctx.beginPath();
      ctx.arc(f.x, f.y, r + 1.5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * f.hp);
      ctx.strokeStyle = player ? '#bfe0ff' : '#ffd0cb';
      ctx.lineWidth = 1;
      ctx.stroke();
      // Squad number.
      const num = numbers[f.id];
      if (num != null) {
        ctx.fillStyle = '#0a0e12';
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
