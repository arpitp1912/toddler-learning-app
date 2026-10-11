import { useEffect, useRef, useState } from 'preact/hooks';
import { asset, type Item } from '../content';
import { preloadItem, sayItem, stopAll } from '../audio';
import { HomeButton } from './HomeButton';
import { ChevronIcon } from './icons';

const SWIPE_PX = 60;

// Screen 3. One item fills the screen. Tap it: word, then sound, with a bounce
// or wiggle. Edge zones or a horizontal swipe move between cards. The bottom
// corners are left empty as palm rests (see 3b zone map).
export function Cards({ items, onHome }: { items: Item[]; onHome: () => void }) {
  const [index, setIndex] = useState(0);
  const [taps, setTaps] = useState(0);
  const [moves, setMoves] = useState(0);
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const swiped = useRef(false);

  const n = items.length;
  const item = items[index % n];

  useEffect(() => {
    for (const it of items) {
      preloadItem(it);
      new Image().src = asset(it.image);
    }
    return stopAll;
  }, [items]);

  const go = (dir: 1 | -1) => {
    stopAll();
    setIndex((i) => (i + dir + n) % n);
    setTaps(0);
    setMoves((m) => m + 1);
  };

  const tapSubject = () => {
    setTaps((t) => t + 1);
    void sayItem(item);
  };

  const onPointerDown = (e: PointerEvent) => {
    swipeStart.current = e.isPrimary ? { x: e.clientX, y: e.clientY } : null;
    swiped.current = false;
  };
  const onPointerUp = (e: PointerEvent) => {
    const s = swipeStart.current;
    swipeStart.current = null;
    if (!s || !e.isPrimary) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (Math.abs(dx) > SWIPE_PX && Math.abs(dx) > Math.abs(dy) * 1.5) {
      swiped.current = true;
      go(dx < 0 ? 1 : -1);
    }
  };
  // A swipe that ends on a button must not also count as a tap.
  const onClickCapture = (e: MouseEvent) => {
    if (swiped.current) {
      swiped.current = false;
      e.stopPropagation();
      e.preventDefault();
    }
  };

  const par = taps % 2 ? 'A' : 'B';
  const anim = taps ? `${item.anim ?? 'bounce'}-${par}` : '';
  const ring = taps ? `ring-${par}` : '';
  const enter = moves ? `enter-${moves % 2 ? 'A' : 'B'}` : '';

  return (
    <div
      class="screen cards"
      style={{ touchAction: 'none' }}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={() => (swipeStart.current = null)}
      onClickCapture={onClickCapture}
    >
      <div class="card-stage">
        <div class={`card-inner ${enter}`} key={`${item.id}-${moves}`}>
          <div class={`ring ring--outline ${ring}`} aria-hidden="true" />
          <div class={`ring ring--disc ${ring}`} aria-hidden="true" />
          <button class={`subject ${anim}`} aria-label={item.word} onClick={tapSubject}>
            <img class="art" src={asset(item.image)} alt="" />
          </button>
        </div>
      </div>

      <HomeButton onHome={onHome} />

      {n > 1 && (
        <>
          <button class="edge edge--prev" aria-label="Previous" onClick={() => go(-1)}>
            <span class="edge-pill">
              <ChevronIcon dir="left" />
            </span>
          </button>
          <button class="edge edge--next" aria-label="Next" onClick={() => go(1)}>
            <span class="edge-pill">
              <ChevronIcon dir="right" />
            </span>
          </button>
        </>
      )}
    </div>
  );
}
