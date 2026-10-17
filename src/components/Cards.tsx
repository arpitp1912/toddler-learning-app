import { useEffect, useState } from 'preact/hooks';
import { asset, type Item } from '../content';
import { preloadItem, sayItem, stopAll } from '../audio';
import { useCardAction } from '../actions';
import { useSwipe } from '../swipe';
import { HomeButton } from './HomeButton';
import { ChevronIcon } from './icons';

// Screen 3. One item fills the screen. Each card plays its word, then sound,
// with a bounce or wiggle as soon as it appears, so the child learns the item
// responds; tapping it replays. Edge zones or a horizontal swipe move between cards. The bottom
// corners are left empty as palm rests (see 3b zone map). An item with an
// `action` (the dog) does that instead of the bounce: see src/actions.ts.
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
      if (it.actionImage) new Image().src = asset(it.actionImage);
    }
    return stopAll;
  }, [items]);

  const go = (dir: 1 | -1) => {
    stopAll();
    setIndex((i) => (i + dir + n) % n);
    setMoves((m) => m + 1);
  };

  const action = useCardAction();
  const play = () => (item.action ? action.play(item) : sayItem(item));

  // Play the card once on arrival. Audio was unlocked at "tap to start".
  useEffect(() => {
    setTaps(1);
    void play();
  }, [moves]);

  const swipe = useSwipe(go);

  const tapSubject = () => {
    setTaps((t) => t + 1);
    void play();
  };

  const par = taps % 2 ? 'A' : 'B';
  const anim = item.action ? action.cls : taps ? `${item.anim ?? 'bounce'}-${par}` : '';
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
          <button
            ref={item.action ? action.ref : undefined}
            class={`subject ${anim}`}
            aria-label={item.word}
            onClick={tapSubject}
          >
            {item.action ? (
              <span class="act-pose">
                <img class="art" src={asset(item.image)} alt="" />
                {item.actionImage && <img class="art art--action" src={asset(item.actionImage)} alt="" />}
              </span>
            ) : (
              <img class="art" src={asset(item.image)} alt="" />
            )}
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
