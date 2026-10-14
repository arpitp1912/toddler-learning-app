import { useEffect, useRef, useState } from 'preact/hooks';
import { asset, type Item } from '../content';
import { hintItem, preloadItem, sayItem, sayPeekaboo, stopAll } from '../audio';
import { useSwipe } from '../swipe';
import { HomeButton } from './HomeButton';
import { ChevronIcon } from './icons';
import { COVER_TYPES, CoverArt } from './covers';

const OPEN_MS = 450;  // --t-open
const CLOSE_MS = 400; // --t-close
const HINT_VOLUME = 0.4;

type Phase = 'covered' | 'opening' | 'revealed' | 'closing';

/** Draws items at random, with no repeats until every item has been shown. */
function useShuffleBag(items: Item[]) {
  const bag = useRef<Item[]>([]);
  const last = useRef<Item | null>(null);
  return () => {
    if (!bag.current.length) {
      const b = [...items];
      for (let i = b.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [b[i], b[j]] = [b[j], b[i]];
      }
      // Never the same item twice in a row across a refill.
      const end = b.length - 1;
      if (end > 0 && b[end] === last.current) [b[0], b[end]] = [b[end], b[0]];
      bag.current = b;
    }
    last.current = bag.current.pop()!;
    return last.current;
  };
}

function preloadAll(item: Item) {
  preloadItem(item);
  new Image().src = asset(item.image);
}

// Peekaboo. One big cover hides an item; tapping it opens the cover, says
// "peekaboo" and the item, then bounces. Edge zones or a swipe close a new
// cover over the next item. Covers rotate bush → door → cloud → blanket.
export function Peekaboo({ items, soundHint, onHome }: { items: Item[]; soundHint: boolean; onHome: () => void }) {
  const draw = useShuffleBag(items);
  const upcoming = useRef<Item | null>(null);
  const [item, setItem] = useState<Item>(() => draw());
  const [phase, setPhaseState] = useState<Phase>('covered');
  const phaseRef = useRef<Phase>('covered');
  const [cover, setCover] = useState(0);  // which cover type, bumps when a new cover arrives
  const [round, setRound] = useState(0);  // bumps once the new cover is in place
  const [pop, setPop] = useState(false);  // new cover swapped in without a closing animation
  const [bounces, setBounces] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setPhase = (p: Phase) => {
    phaseRef.current = p;
    setPhaseState(p);
  };
  const later = (ms: number, fn: () => void) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(fn, ms);
  };

  useEffect(() => {
    preloadAll(item);
    upcoming.current = draw();
    preloadAll(upcoming.current);
    return () => {
      if (timer.current) clearTimeout(timer.current);
      stopAll();
    };
  }, []);

  // Each new cover can quietly play the hidden item's sound (profile setting).
  useEffect(() => {
    if (soundHint) hintItem(item, HINT_VOLUME);
  }, [round]);

  const open = () => {
    // Taps while the cover is already opening must not replay the audio.
    if (phaseRef.current !== 'covered') return;
    stopAll();
    setPhase('opening');
    later(OPEN_MS, () => {
      setPhase('revealed');
      void sayPeekaboo(item).then((done) => done && setBounces((b) => b + 1));
    });
  };

  const tapItem = () => {
    if (phaseRef.current !== 'revealed') return;
    setBounces((b) => b + 1);
    void sayItem(item);
  };

  const next = () => {
    const p = phaseRef.current;
    if (p === 'closing') return;
    stopAll();
    const n = upcoming.current ?? draw();
    upcoming.current = draw();
    preloadAll(upcoming.current);
    setCover((c) => c + 1);
    const arrive = () => {
      setItem(n);
      setBounces(0);
      setRound((r) => r + 1);
    };
    if (p === 'covered') {
      // Nothing to close: the new cover pops in over the new item.
      if (timer.current) clearTimeout(timer.current);
      setPop(true);
      arrive();
      return;
    }
    setPop(false);
    setPhase('closing');
    later(CLOSE_MS, () => {
      arrive();
      setPhase('covered');
    });
  };

  const swipe = useSwipe(next);

  const type = COVER_TYPES[cover % COVER_TYPES.length];
  const par = bounces % 2 ? 'A' : 'B';
  const anim = bounces ? `bounce-${par}` : '';
  const ring = bounces ? `ring-${par}` : '';
  const shown = phase === 'revealed';

  return (
    <div class="screen cards peekaboo" style={{ touchAction: 'none' }} {...swipe}>
      <div class="card-stage">
        <div class="card-inner">
          <div class={`ring ring--outline ${ring}`} aria-hidden="true" />
          <div class={`ring ring--disc ${ring}`} aria-hidden="true" />
          <button
            key={`${item.id}-${round}`}
            class={`subject ${anim}`}
            aria-label={item.word}
            aria-hidden={!shown}
            tabIndex={shown ? 0 : -1}
            onClick={tapItem}
          >
            <img class="art" src={asset(item.image)} alt="" />
          </button>
          {!shown && (
            <button
              key={cover}
              class={`cover cover--${type} is-${phase}${pop ? ' cover--pop' : ''}`}
              aria-label="Peekaboo"
              onClick={open}
            >
              <span class="cover-body">
                <CoverArt type={type} />
              </span>
            </button>
          )}
        </div>
      </div>

      <HomeButton onHome={onHome} />

      <button class="edge edge--prev" aria-label="Next" onClick={next}>
        <span class="edge-pill">
          <ChevronIcon dir="left" />
        </span>
      </button>
      <button class="edge edge--next" aria-label="Next" onClick={next}>
        <span class="edge-pill">
          <ChevronIcon dir="right" />
        </span>
      </button>
    </div>
  );
}
