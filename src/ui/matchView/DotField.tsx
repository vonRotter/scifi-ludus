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
}

export function DotField({ arena, frame, playerSide }: Props) {
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
    }
    ctx.restore();
  }, [arena, frame, playerSide]);

  return (
    <canvas
      ref={ref}
      className="field"
      width={arena.width * SCALE}
      height={arena.height * SCALE}
    />
  );
}
