import { useLayoutEffect, useState } from 'react';

/**
 * The app opens modals on top of each other: a note from a task, a task from a
 * note, and so on. A fixed pair of z-indexes cannot express that, so every
 * overlay takes the next layer while it is open and gives it back on close.
 * The newest overlay is always the topmost one, whichever modal opened it.
 */

/** Both overlays and their own menus live above this; 10 per layer leaves room. */
export const OVERLAY_Z_BASE = 200;

/**
 * Menus that belong to the app's own chrome (new, account, recent items) must
 * not disappear behind an open note: they sit just above the first overlay and
 * still below anything a note opens on top of itself.
 */
export const CHROME_MENU_Z = OVERLAY_Z_BASE + 5;
const LAYER_STEP = 10;

const stack: string[] = [];
const listeners = new Set<() => void>();
let sequence = 0;

const notify = () => listeners.forEach((listener) => listener());

export interface OverlayLayer {
  zIndex: number;
  /** False while another overlay sits above this one (e.g. its Escape is not ours). */
  isTop: boolean;
}

export function useOverlayLayer(active: boolean): OverlayLayer {
  const [id] = useState(() => `overlay-${++sequence}`);
  const [, rerender] = useState(0);

  // Layout effect: the new layer must be in place before the overlay paints,
  // otherwise a note opened from a task flashes behind it for a frame.
  useLayoutEffect(() => {
    const listener = () => rerender((tick) => tick + 1);
    listeners.add(listener);

    if (active) {
      stack.push(id);
      notify();
    }

    return () => {
      listeners.delete(listener);
      const index = stack.indexOf(id);
      if (index !== -1) {
        stack.splice(index, 1);
        notify();
      }
    };
  }, [active, id]);

  const index = stack.indexOf(id);
  return {
    zIndex: OVERLAY_Z_BASE + Math.max(index, 0) * LAYER_STEP,
    isTop: index !== -1 && index === stack.length - 1,
  };
}
