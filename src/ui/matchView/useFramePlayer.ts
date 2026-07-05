/**
 * Frame playback clock for the match view.
 *
 * Single responsibility: advance an index through a timeline of frames at a
 * steady rate, with play / pause / skip / reset. It reads nothing about the
 * game — it just walks an array the engine produced. No rules here.
 */

import { useEffect, useRef, useState } from 'react';

const PLAYBACK_FPS = 21;

/** Playback rates the controls expose. */
export const SPEEDS = [1, 2, 4] as const;
export type Speed = (typeof SPEEDS)[number];

export interface FramePlayer {
  index: number;
  playing: boolean;
  atEnd: boolean;
  speed: Speed;
  play: () => void;
  pause: () => void;
  skip: () => void;
  reset: () => void;
  /** Set the playback rate (1×/2×/4×). */
  setSpeed: (s: Speed) => void;
  /** Jump directly to a frame index (for scrubbing); clamps to range. */
  seek: (i: number) => void;
}

export function useFramePlayer(frameCount: number): FramePlayer {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeedState] = useState<Speed>(1);
  const idxRef = useRef(0);

  useEffect(() => {
    idxRef.current = index;
  }, [index]);

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const loop = (now: number) => {
      acc += ((now - last) * PLAYBACK_FPS * speed) / 1000;
      last = now;
      if (acc >= 1) {
        const adv = Math.floor(acc);
        acc -= adv;
        let ni = idxRef.current + adv;
        if (ni >= frameCount - 1) {
          ni = frameCount - 1;
          idxRef.current = ni;
          setIndex(ni);
          setPlaying(false);
          return;
        }
        idxRef.current = ni;
        setIndex(ni);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing, frameCount, speed]);

  return {
    index,
    playing,
    atEnd: index >= frameCount - 1,
    speed,
    play: () => {
      if (idxRef.current >= frameCount - 1) {
        idxRef.current = 0;
        setIndex(0);
      }
      setPlaying(true);
    },
    pause: () => setPlaying(false),
    skip: () => {
      setPlaying(false);
      idxRef.current = frameCount - 1;
      setIndex(frameCount - 1);
    },
    reset: () => {
      setPlaying(false);
      idxRef.current = 0;
      setIndex(0);
    },
    setSpeed: (s) => setSpeedState(s),
    seek: (i) => {
      const clamped = Math.max(0, Math.min(frameCount - 1, Math.round(i)));
      idxRef.current = clamped;
      setIndex(clamped);
    },
  };
}
