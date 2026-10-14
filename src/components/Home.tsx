import { asset, type Category } from '../content';
import { BubblesIcon, PeekabooIcon, SpeakerIcon } from './icons';

interface Props {
  categories: Category[];
  onOpen: (c: Category) => void;
  /** Shown when the profile has the Peekaboo tile enabled and has items to hide. */
  onPeekaboo?: () => void;
  /** Same rules for the Bubbles mode tile. */
  onBubbles?: () => void;
}

// Screen 2. One giant tile per enabled category, plus the mode tiles.
export function Home({ categories, onOpen, onPeekaboo, onBubbles }: Props) {
  return (
    <div class="screen home">
      <div class="tiles">
        {categories.map((c) => (
          <button key={c.id} class="tile" data-tint={c.tint} aria-label={c.id} onClick={() => onOpen(c)}>
            <img class="art" src={asset(c.icon)} alt="" />
            {c.badge === 'sound' && (
              <span class="tile-badge" aria-hidden="true">
                <SpeakerIcon />
              </span>
            )}
          </button>
        ))}
        {onPeekaboo && (
          <button class="tile" data-tint="lilac" aria-label="peekaboo" onClick={onPeekaboo}>
            <PeekabooIcon />
          </button>
        )}
        {onBubbles && (
          <button class="tile" data-tint="sky" aria-label="bubbles" onClick={onBubbles}>
            <BubblesIcon />
          </button>
        )}
      </div>
    </div>
  );
}
