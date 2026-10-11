import { asset, type Item } from '../content';
import { PlayIcon } from './icons';

// Screen 1. Pressed by the parent; the tap unlocks audio.
export function TapToStart({ decor, onStart }: { decor: Item[]; onStart: () => void }) {
  const [left, right] = decor;
  return (
    <div class="screen">
      <div class="start-hill" aria-hidden="true" />
      {left && <img class="start-art start-art--left art" src={asset(left.image)} alt="" />}
      {right && <img class="start-art start-art--right art" src={asset(right.image)} alt="" />}
      <div class="start-center">
        <div class="halo halo--outer" aria-hidden="true" />
        <div class="halo halo--inner" aria-hidden="true" />
        <button class="play" aria-label="Start" onClick={onStart}>
          <PlayIcon />
        </button>
      </div>
    </div>
  );
}
