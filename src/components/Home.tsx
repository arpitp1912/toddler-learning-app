import { asset, type Category } from '../content';
import { PeekabooIcon, SpeakerIcon } from './icons';

interface Props {
  categories: Category[];
  onOpen: (c: Category) => void;
  /** Shown when the profile has the Peekaboo tile enabled and has items to hide. */
  onPeekaboo?: () => void;
}

// Screen 2. One giant tile per enabled category, plus the Peekaboo mode tile.
export function Home({ categories, onOpen, onPeekaboo }: Props) {
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
      </div>
    </div>
  );
}
