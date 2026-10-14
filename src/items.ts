// Picking and preloading items for the play modes that draw from a mixed pool
// (Peekaboo, Bubbles).
import { useRef } from 'preact/hooks';
import { asset, type Item } from './content';
import { preloadItem } from './audio';

/**
 * Draws items at random, with no repeats until every item has been shown.
 * `skip` leaves out items that are already on screen; they count as seen.
 */
export function useShuffleBag(items: Item[]) {
  const bag = useRef<Item[]>([]);
  const last = useRef<Item | null>(null);

  const refill = () => {
    const b = [...items];
    for (let i = b.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [b[i], b[j]] = [b[j], b[i]];
    }
    // Never the same item twice in a row across a refill.
    const end = b.length - 1;
    if (end > 0 && b[end] === last.current) [b[0], b[end]] = [b[end], b[0]];
    bag.current = b;
  };

  return (skip?: (item: Item) => boolean): Item => {
    for (let pass = 0; pass < 2; pass++) {
      if (!bag.current.length) refill();
      for (let i = bag.current.length - 1; i >= 0; i--) {
        if (skip?.(bag.current[i])) continue;
        last.current = bag.current.splice(i, 1)[0];
        return last.current;
      }
      // Everything left is on screen: start a fresh round.
      bag.current = [];
    }
    // The whole pool is on screen (tiny pool): allow a duplicate.
    last.current = items[Math.floor(Math.random() * items.length)];
    return last.current;
  };
}

/** Starts loading an item's image and audio. */
export function preloadItemAssets(item: Item) {
  preloadItem(item);
  new Image().src = asset(item.image);
}
