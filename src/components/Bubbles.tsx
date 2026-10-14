import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { asset, type BubbleSpeed, type Item } from '../content';
import { popSound, sayItem, stopAll } from '../audio';
import { preloadItemAssets, useShuffleBag } from '../items';
import { HomeButton } from './HomeButton';

const RISE_S: Record<BubbleSpeed, number> = { slow: 10, normal: 6 };
const HIT_SCALE = 1.15;     // hit area vs the visible bubble
const RESPAWN_MS = 500;     // after a pop
const SHOW_MS = 1500;       // a popped item stays this long, then fades
const FADE_MS = 300;        // --t-popped-fade
const SWAY_PERIOD_S = 4.5;
const SWAY = 0.06;          // sway amplitude, as a fraction of the diameter
const DROPLETS = 8;

interface Geometry {
  w: number;
  h: number;
  count: number;
  d: number;        // visible diameter
  hit: number;      // hit-area diameter
  sway: number;
  lanes: number[];  // lane centre x
  slots: { x: number; y: number }[]; // reduced motion: fixed grid
}

interface Bubble { id: number; item: Item; lane: number; slot: number; x: number; y: number; phase: number; fade?: boolean }
interface Popped { id: number; item: Item; x: number; y: number }

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/** Sizes, lanes and grid slots for this screen. Nothing goes left of the home button. */
function measure(root: HTMLElement): Geometry {
  const w = root.clientWidth;
  const h = root.clientHeight;
  const short = Math.min(w, h);
  const count = short >= 600 ? 4 : 3; // iPad : iPhone
  const d = Math.max(160, 0.28 * short);
  const hit = d * HIT_SCALE;
  const sway = d * SWAY;
  const home = root.querySelector('.home-btn')?.getBoundingClientRect();
  const left = home ? home.right - root.getBoundingClientRect().left : 0;

  // Lanes about half a bubble apart for variety. Neighbouring lanes overlap, so
  // spacing along the path (see `clear`) is what keeps bubbles apart.
  const minX = left + hit / 2 + sway;
  const maxX = w - hit / 2 - sway;
  const span = Math.max(0, maxX - minX);
  const n = Math.max(count, Math.floor(span / (hit / 2)) + 1);
  const lanes = Array.from({ length: n }, (_, i) => (span ? minX + (i * span) / (n - 1) : (left + w) / 2));

  const cols = Math.max(1, Math.min(Math.ceil(Math.sqrt(count)), Math.floor((w - left) / hit)));
  const rows = Math.ceil(count / cols);
  const slots = Array.from({ length: count }, (_, i) => ({
    x: left + ((i % cols) + 0.5) * ((w - left) / cols),
    y: (Math.floor(i / cols) + 0.5) * (h / rows),
  }));

  return { w, h, count, d, hit, sway, lanes, slots };
}

/** True if a bubble at (lane, y) can never touch any existing bubble. All bubbles rise at one speed. */
function clear(g: Geometry, bubbles: Bubble[], lane: number, y: number) {
  return bubbles.every(
    (b) => Math.abs(g.lanes[b.lane] - g.lanes[lane]) >= g.hit + 2 * g.sway || Math.abs(b.y - y) >= g.hit,
  );
}

function shuffled(n: number) {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const place = (g: Geometry, x: number, y: number) => `translate3d(${x - g.hit / 2}px, ${y - g.hit / 2}px, 0)`;

/** Translucent bubble: soft fill behind the item, rim and sheen in front. */
const BubbleBack = () => (
  <svg class="bubble-svg" viewBox="0 0 100 100" aria-hidden="true">
    <circle cx="50" cy="50" r="48" fill="url(#bubble-fill)" />
  </svg>
);
const BubbleFront = () => (
  <svg class="bubble-svg" viewBox="0 0 100 100" aria-hidden="true">
    <circle cx="50" cy="50" r="48" fill="none" stroke="var(--bubble-rim)" stroke-width="2.2" />
    <circle cx="50" cy="50" r="45.5" fill="none" stroke="var(--bubble-rim-tint)" stroke-width="1.6" />
    <ellipse cx="31" cy="27" rx="14" ry="7" transform="rotate(-38 31 27)" fill="var(--bubble-sheen)" />
    <circle cx="20" cy="45" r="3" fill="var(--bubble-sheen)" />
    <path d="M70 84a40 40 0 0 0 16-16" fill="none" stroke="var(--bubble-sheen)" stroke-width="3" stroke-linecap="round" opacity=".6" />
  </svg>
);

// Bubbles. Item bubbles rise slowly in lanes; a touch pops one (several
// fingers pop several). The item stays, bounces and says its word and sound,
// then fades. Under reduced motion the bubbles sit still in a grid.
export function Bubbles({
  items,
  speed,
  spawning,
  onHome,
}: {
  items: Item[];
  speed: BubbleSpeed;
  spawning: boolean; // false once the session's last-minute warning starts
  onHome: () => void;
}) {
  const draw = useShuffleBag(items);
  const root = useRef<HTMLDivElement>(null);
  const [geo, setGeo] = useState<Geometry | null>(null);
  const [, setVersion] = useState(0);
  const rerender = () => setVersion((v) => v + 1);

  const bubbles = useRef<Bubble[]>([]);
  const popped = useRef<Popped[]>([]);
  const els = useRef(new Map<number, HTMLElement>());
  const pending = useRef<number[]>([]); // due times (ms) of bubbles waiting to spawn
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const nextId = useRef(1);
  const spawningRef = useRef(spawning);
  spawningRef.current = spawning;
  const reduced = useRef(reducedMotion());

  const later = (ms: number, fn: () => void) => {
    const t = setTimeout(() => {
      timers.current.delete(t);
      fn();
    }, ms);
    timers.current.add(t);
  };

  const onScreen = (item: Item) =>
    bubbles.current.some((b) => b.item === item) || popped.current.some((p) => p.item === item);

  const newBubble = (lane: number, slot: number, x: number, y: number, fade = false): Bubble => {
    const item = draw(onScreen);
    preloadItemAssets(item);
    return { id: nextId.current++, item, lane, slot, x, y, phase: Math.random() * Math.PI * 2, fade };
  };

  // Measure after the home button is in place, and again on rotation.
  useLayoutEffect(() => {
    const update = () => root.current && setGeo(measure(root.current));
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
      stopAll();
    },
    [],
  );

  // Fill the screen, then (with motion) run the rise loop.
  useEffect(() => {
    if (!geo) return;
    const g = geo;
    bubbles.current = [];
    pending.current = [];

    if (reduced.current) {
      for (let i = 0; i < g.count; i++) bubbles.current.push(newBubble(0, i, g.slots[i].x, g.slots[i].y));
      rerender();
      return;
    }

    // Spread the first bubbles up the screen so it doesn't start empty.
    const step = g.count > 1 ? (g.h - g.hit) / (g.count - 1) : 0;
    for (let k = 0; k < g.count; k++) {
      let y = g.h - g.hit / 2 - k * step;
      for (;;) {
        const lane = shuffled(g.lanes.length).find((l) => clear(g, bubbles.current, l, y));
        if (lane != null) {
          bubbles.current.push(newBubble(lane, 0, g.lanes[lane], y));
          break;
        }
        y += g.hit / 4; // no room here: start it lower
      }
    }
    rerender();

    const rise = (g.h + g.hit) / RISE_S[speed]; // px per second
    const spawnY = g.h + g.hit / 2;
    let last = performance.now();
    let raf = requestAnimationFrame(function frame(now) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      let changed = false;

      for (const b of bubbles.current) {
        b.y -= rise * dt;
        b.x = g.lanes[b.lane] + g.sway * Math.sin((now / 1000 / SWAY_PERIOD_S) * Math.PI * 2 + b.phase);
        const el = els.current.get(b.id);
        if (el) el.style.transform = place(g, b.x, b.y);
      }

      // Off the top: respawn at the bottom with a new item.
      const gone = bubbles.current.filter((b) => b.y < -g.hit / 2);
      if (gone.length) {
        bubbles.current = bubbles.current.filter((b) => b.y >= -g.hit / 2);
        pending.current.push(...gone.map(() => now));
        changed = true;
      }

      if (spawningRef.current && pending.current.length) {
        pending.current.sort((a, b) => a - b);
        while (pending.current.length && pending.current[0] <= now && bubbles.current.length < g.count) {
          const lane = shuffled(g.lanes.length).find((l) => clear(g, bubbles.current, l, spawnY));
          if (lane == null) break; // wait for room
          pending.current.shift();
          bubbles.current.push(newBubble(lane, 0, g.lanes[lane], spawnY));
          changed = true;
        }
      }

      if (changed) rerender();
      raf = requestAnimationFrame(frame);
    });
    return () => cancelAnimationFrame(raf);
  }, [geo, speed]);

  const pop = (id: number) => {
    const b = bubbles.current.find((x) => x.id === id);
    if (!b) return;
    bubbles.current = bubbles.current.filter((x) => x !== b);
    els.current.delete(id);
    popSound();
    void sayItem(b.item); // stops any earlier word or sound first

    const p: Popped = { id: nextId.current++, item: b.item, x: b.x, y: b.y };
    popped.current.push(p);
    later(SHOW_MS + FADE_MS, () => {
      popped.current = popped.current.filter((x) => x !== p);
      rerender();
    });

    if (reduced.current) {
      // A new bubble fades into the same spot once the item has gone.
      later(SHOW_MS + FADE_MS, () => {
        if (!spawningRef.current || !geo) return;
        bubbles.current.push(newBubble(0, b.slot, b.x, b.y, true));
        rerender();
      });
    } else {
      pending.current.push(performance.now() + RESPAWN_MS);
    }
    rerender();
  };

  const g = geo;
  return (
    <div
      ref={root}
      class="screen bubbles"
      style={g ? { touchAction: 'none', '--bd': `${g.d}px`, '--bh': `${g.hit}px` } : { touchAction: 'none' }}
    >
      <svg class="bubble-defs" aria-hidden="true" width="0" height="0">
        <defs>
          <radialGradient id="bubble-fill" cx="50%" cy="45%" r="55%">
            <stop offset="0%" stop-color="var(--bubble-core)" />
            <stop offset="75%" stop-color="var(--bubble-core)" />
            <stop offset="100%" stop-color="var(--bubble-edge)" />
          </radialGradient>
        </defs>
      </svg>

      {g &&
        popped.current.map((p) => (
          <div key={`p${p.id}`} class="popped" style={{ transform: place(g, p.x, p.y) }} aria-hidden="true">
            <span class="burst">
              <span class="burst-ring" />
              {Array.from({ length: DROPLETS }, (_, i) => (
                <span key={i} class="burst-drop" style={{ transform: `rotate(${(360 / DROPLETS) * i}deg)` }}>
                  <span class="burst-dot" />
                </span>
              ))}
            </span>
            <img class="popped-item art" src={asset(p.item.image)} alt="" />
          </div>
        ))}

      {g &&
        bubbles.current.map((b) => (
          <button
            key={b.id}
            ref={(el) => {
              if (el) els.current.set(b.id, el);
              else els.current.delete(b.id);
            }}
            class={`bubble${b.fade ? ' bubble--fade' : ''}`}
            data-id={b.id}
            aria-label={b.item.word}
            style={{ transform: place(g, b.x, b.y) }}
            onPointerDown={(e) => {
              e.preventDefault();
              pop(b.id);
            }}
          >
            <span class="bubble-art">
              <BubbleBack />
              <img class="bubble-item art" src={asset(b.item.image)} alt="" />
              <BubbleFront />
            </span>
          </button>
        ))}

      <HomeButton onHome={onHome} />
    </div>
  );
}
