/**
 * Small accessibility helpers shared across screens.
 *
 * Single responsibility: turn a plain click handler into a set of props that
 * make any element (a table row, a cell) behave like a real button — mouse
 * click, Enter/Space activation, keyboard focus, and a screen-reader label.
 * Presentation-layer utility only; no game rules.
 */

import { KeyboardEvent } from 'react';

export interface ClickableProps {
  role: 'button';
  tabIndex: 0;
  onClick: () => void;
  onKeyDown: (e: KeyboardEvent) => void;
  'aria-label'?: string;
}

/** Props that make a non-button element keyboard- and screen-reader-accessible. */
export function clickableProps(onActivate: () => void, label?: string): ClickableProps {
  return {
    role: 'button',
    tabIndex: 0,
    onClick: onActivate,
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onActivate();
      }
    },
    'aria-label': label,
  };
}
