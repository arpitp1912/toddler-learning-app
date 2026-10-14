import { useEffect, useState } from 'preact/hooks';
import { asset, type Item } from '../content';
import { preloadItem, sayItem, stopAll } from '../audio';
import { useSwipe } from '../swipe';
import { HomeButton } from './HomeButton';
import { ChevronIcon } from './icons';

// Screen 3. One item fills the screen. Each card plays its word, then sound,
// with a bounce or wiggle as soon as it appears, so the child learns the item
// responds; tapping it replays. Edge zones or a horizontal swipe move between cards. The bottom
// corners are left empty as palm rests (see 3b zone map).
export function Cards({ items, onHome }: { items: Item[]; onHome: () => void }) {
  const [index, setIndex] = useState(0);
  const [taps, setTaps] = useState(0);
  const [moves, setMoves] = useState(0);

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
    setMoves((m) => m + 1);
  };

  // Play the card once on arrival. Audio was unlocked at "tap to start".
  useEffect(() => {
    setTaps(1);
    void sayItem(item);
  }, [moves]);

  const swipe = useSwipe(go);

  const tapSubject = () => {
    setTaps((t) => t + 1);
    void sayItem(item);
  };

  const par = taps % 2 ? 'A' : 'B';
  const anim = taps ? `${item.anim ?? 'bounce'}-${par}` : '';
  const ring = taps ? `ring-${par}` : '';
  const enter = moves ? `enter-${moves % 2 ? 'A' : 'B'}` : '';

  return (
    <div
      class="screen cards"
      style={{ touchAction: 'none' }}
      {...swipe}
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
