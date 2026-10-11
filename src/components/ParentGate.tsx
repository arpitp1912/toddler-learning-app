import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { TwoFingerIcon } from './icons';

const HOLD_MS = 3000;
const CHECK_TIMEOUT_MS = 20_000;
const WORDS = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];

/**
 * Hidden top-right corner (SPEC section 5): hold two fingers for 3 s.
 * Dev builds also accept a 3 s mouse press so it can be tested on a desktop.
 */
export function ParentCorner({ onOpen, showHint }: { onOpen: () => void; showHint?: boolean }) {
  const [holding, setHolding] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancel = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setHolding(false);
  };
  const begin = () => {
    if (timer.current) return;
    setHolding(true);
    timer.current = setTimeout(() => {
      cancel();
      onOpen();
    }, HOLD_MS);
  };
  useEffect(() => cancel, []);

  const onTouchStart = (e: TouchEvent) => {
    e.preventDefault();
    if (e.targetTouches.length >= 2) begin();
  };
  const onTouchEnd = (e: TouchEvent) => {
    if (e.targetTouches.length < 2) cancel();
  };
  const devPress = import.meta.env.DEV
    ? {
        onPointerDown: (e: PointerEvent) => e.pointerType === 'mouse' && begin(),
        onPointerUp: (e: PointerEvent) => e.pointerType === 'mouse' && cancel(),
        onPointerLeave: (e: PointerEvent) => e.pointerType === 'mouse' && cancel(),
      }
    : {};

  return (
    <div
      class={`gate-corner${holding ? ' is-holding' : ''}`}
      aria-label="Parent: hold two fingers here for 3 seconds"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onTouchCancel={cancel}
      onTouchMove={(e: TouchEvent) => e.preventDefault()}
      {...devPress}
    >
      <span class="gate-progress" aria-hidden="true" />
      {showHint && (
        <span class="gate-hint" aria-hidden="true">
          <TwoFingerIcon />
        </span>
      )}
    </div>
  );
}

/** Adult check after the hold: "Tap seven" on a shuffled 1–9 pad. A wrong tap closes it. */
export function ParentCheck({ onPass, onCancel }: { onPass: () => void; onCancel: () => void }) {
  const { target, order } = useMemo(() => {
    const nums = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    for (let i = nums.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [nums[i], nums[j]] = [nums[j], nums[i]];
    }
    return { target: 1 + Math.floor(Math.random() * 9), order: nums };
  }, []);

  useEffect(() => {
    const id = setTimeout(onCancel, CHECK_TIMEOUT_MS);
    return () => clearTimeout(id);
  }, [onCancel]);

  return (
    <div class="parent" role="dialog" aria-modal="true" aria-labelledby="check-title">
      <div class="parent-wrap check">
        <p class="parent-muted">For grown-ups</p>
        <h1 id="check-title" class="check-prompt">Tap {WORDS[target - 1]}</h1>
        <div class="check-grid">
          {order.map((n) => (
            <button key={n} class="pbtn" onClick={() => (n === target ? onPass() : onCancel())}>
              {n}
            </button>
          ))}
        </div>
        <button class="pbtn" onClick={onCancel}>Back</button>
      </div>
    </div>
  );
}
