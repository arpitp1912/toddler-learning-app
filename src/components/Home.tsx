import type { ComponentChildren } from 'preact';
import { asset, type Category } from '../content';
import { BubblesIcon, GuessIcon, LookIcon, PeekabooIcon } from './icons';
import { HomeButton } from './HomeButton';

interface Tile {
  id: string;
  tint: Category['tint'];
  art: ComponentChildren;
  onOpen: () => void;
}

/** The giant picture tiles shared by Home and Look. */
function Tiles({ tiles }: { tiles: Tile[] }) {
  return (
    <div class="tiles" data-count={tiles.length}>
      {tiles.map((t) => (
        <button key={t.id} class="tile" data-tint={t.tint} aria-label={t.id} onClick={t.onOpen}>
          {t.art}
        </button>
      ))}
    </div>
  );
}

interface HomeProps {
  /** Each tile shows only when its mode is on for the profile and has items to play. */
  onLook?: () => void;
  onPeekaboo?: () => void;
  onBubbles?: () => void;
  onGuess?: () => void;
}

// Screen 2. Up to four activity tiles: Look, Peekaboo, Bubbles, Guess.
export function Home({ onLook, onPeekaboo, onBubbles, onGuess }: HomeProps) {
  const tiles: (Tile | false)[] = [
    !!onLook && { id: 'look', tint: 'sage', art: <LookIcon />, onOpen: onLook },
    !!onPeekaboo && { id: 'peekaboo', tint: 'lilac', art: <PeekabooIcon />, onOpen: onPeekaboo },
    !!onBubbles && { id: 'bubbles', tint: 'sky', art: <BubblesIcon />, onOpen: onBubbles },
    !!onGuess && { id: 'guess', tint: 'peach', art: <GuessIcon />, onOpen: onGuess },
  ];
  return (
    <div class="screen home">
      <Tiles tiles={tiles.filter((t): t is Tile => !!t)} />
    </div>
  );
}

// Look: one tile per category enabled for the profile, laid out like Home.
// Each opens Cards for that category; the home button returns to Home.
export function Look({ categories, onOpen, onHome }: { categories: Category[]; onOpen: (c: Category) => void; onHome: () => void }) {
  return (
    <div class="screen home look">
      <Tiles
        tiles={categories.map((c) => ({
          id: c.id,
          tint: c.tint,
          art: <img class="art" src={asset(c.icon)} alt="" />,
          onOpen: () => onOpen(c),
        }))}
      />
      <HomeButton onHome={onHome} />
    </div>
  );
}
