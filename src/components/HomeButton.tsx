import { HomeIcon } from './icons';

export function HomeButton({ onHome }: { onHome: () => void }) {
  return (
    <button class="home-btn" aria-label="Home" onClick={onHome}>
      <span>
        <HomeIcon />
      </span>
    </button>
  );
}
