import { asset, type Category } from '../content';
import { BubblesIcon, PeekabooIcon, SpeakerIcon, WhoSaysIcon } from './icons';

interface Props {
  categories: Category[];
  onOpen: (c: Category) => void;
  /** Shown when the profile has the Peekaboo tile enabled and has items to hide. */
  onPeekaboo?: () => void;
  /** Same rules for the Bubbles mode tile. */
  onBubbles?: () => void;
  /** Who says that?: shown only when the mode is turned on for the profile. */
  onWhoSays?: () => void;
}

// Screen 2. One giant tile per enabled category, plus the mode tiles.
export function Home({ categories, onOpen, onPeekaboo, onBubbles, onWhoSays }: Props) {
  return (
    <div class="screen home">
      <div class="tiles" data-count={categories.length + [onPeekaboo, onBubbles, onWhoSays].filter(Boolean).length}>
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
        {onWhoSays && (
          <button class="tile" data-tint="peach" aria-label="who says that" onClick={onWhoSays}>
            <WhoSaysIcon />
          </button>
        )}
      </div>
    </div>
  );
}
