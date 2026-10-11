import { asset, type Category } from '../content';
import { SpeakerIcon } from './icons';

// Screen 2. One giant tile per enabled category.
export function Home({ categories, onOpen }: { categories: Category[]; onOpen: (c: Category) => void }) {
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
      </div>
    </div>
  );
}
