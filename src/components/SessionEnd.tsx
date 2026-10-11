import { useEffect, useState } from 'preact/hooks';
import { asset, type Item } from '../content';
import { speak } from '../audio';
import { WARNING_MS } from '../session';
import { MoonFace, PadlockIcon, StarIcon, SunIcon, ZzzIcon } from './icons';

// 8a. Shown over play during the last minute: the sun sinks and the room dusks.
// The animation is started part-way through if the warning began earlier.
export function FadingSun({ remainingMs }: { remainingMs: number }) {
  const [delay] = useState(() => `-${Math.max(0, (WARNING_MS - remainingMs) / 1000).toFixed(1)}s`);
  return (
    <>
      <div class="dusk" style={{ animationDelay: delay }} aria-hidden="true" />
      <div class="sun-band" aria-hidden="true">
        <div class="sun" style={{ animationDelay: delay }}>
          <SunIcon />
        </div>
      </div>
    </>
  );
}

// 8b. Calm goodbye: the sun sets, the moon rises, two friends wave.
export function Goodbye({ decor }: { decor: Item[] }) {
  const [left, right] = decor;
  useEffect(() => {
    const id = setTimeout(() => void speak('Bye bye!'), 1400);
    return () => clearTimeout(id);
  }, []);
  return (
    <div class="screen goodbye" aria-label="Goodbye">
      <div class="goodbye-sky" />
      <div class="goodbye-moon" />
      <div class="goodbye-sun" />
      <div class="hill hill--back" />
      <div class="hill hill--front" />
      {left && <img class="goodbye-art goodbye-art--left art" src={asset(left.image)} alt="" />}
      {right && <img class="goodbye-art goodbye-art--right art" src={asset(right.image)} alt="" />}
    </div>
  );
}

// Star positions from the design, as fractions of the 1180×820 frame.
const STARS: [number, number, number][] = [
  [120, 110, 26], [260, 260, 18], [90, 420, 20], [340, 80, 14], [860, 120, 22], [960, 330, 16],
  [1040, 470, 24], [780, 560, 14], [230, 560, 16], [680, 90, 12], [420, 480, 12], [1100, 250, 14],
];

// 8c. Sleeping lock screen. Only the parent gate (rendered by App) leaves it.
export function Lock() {
  return (
    <div class="screen lock">
      <div aria-hidden="true">
        {STARS.map(([x, y, s], i) => (
          <div
            key={i}
            class="star"
            style={{
              left: `${(x / 1180) * 100}%`,
              top: `${(y / 820) * 100}%`,
              width: `calc(${s} * var(--v))`,
              height: `calc(${s} * var(--v))`,
              animationDelay: `-${(i * 0.7).toFixed(1)}s`,
            }}
          >
            <StarIcon />
          </div>
        ))}
        <div class="lock-ground" />
      </div>
      <div class="lock-moon" aria-hidden="true">
        <div class="lock-moon-glow" />
        <MoonFace />
        <ZzzIcon />
      </div>
      <div class="lock-padlock" aria-hidden="true">
        <PadlockIcon />
      </div>
    </div>
  );
}
