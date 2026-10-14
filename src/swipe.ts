// Horizontal swipe for the card-style screens. Optional, never required (SPEC section 3).
import { useRef } from 'preact/hooks';

const SWIPE_PX = 60;

/** Handlers for the screen root. `onSwipe(1)` is a swipe to the left (next). */
export function useSwipe(onSwipe: (dir: 1 | -1) => void) {
  const start = useRef<{ x: number; y: number } | null>(null);
  const swiped = useRef(false);

  return {
    onPointerDown: (e: PointerEvent) => {
      start.current = e.isPrimary ? { x: e.clientX, y: e.clientY } : null;
      swiped.current = false;
    },
    onPointerUp: (e: PointerEvent) => {
      const s = start.current;
      start.current = null;
      if (!s || !e.isPrimary) return;
      const dx = e.clientX - s.x;
      const dy = e.clientY - s.y;
      if (Math.abs(dx) > SWIPE_PX && Math.abs(dx) > Math.abs(dy) * 1.5) {
        swiped.current = true;
        onSwipe(dx < 0 ? 1 : -1);
      }
    },
    onPointerCancel: () => {
      start.current = null;
    },
    // A swipe that ends on a button must not also count as a tap.
    onClickCapture: (e: MouseEvent) => {
      if (swiped.current) {
        swiped.current = false;
        e.stopPropagation();
        e.preventDefault();
      }
    },
  };
}
