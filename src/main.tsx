import { render } from 'preact';
import { App } from './App';
import { hasServiceWorker } from './features';
import './styles/tokens.css';
import './styles/app.css';

// Toddler-proofing: no pinch zoom, double-tap zoom, long-press menus or drags.
const block = (e: Event) => e.preventDefault();
document.addEventListener('gesturestart', block);
document.addEventListener('contextmenu', block);
document.addEventListener('dblclick', block);
document.addEventListener('dragstart', block);
document.addEventListener(
  'touchmove',
  (e) => {
    const inParent = (e.target as Element | null)?.closest?.('.parent');
    if (e.touches.length > 1 || !inParent) e.preventDefault();
  },
  { passive: false },
);
// Lets :active styles show on iOS.
document.addEventListener('touchstart', () => {}, { passive: true });

render(<App />, document.getElementById('app')!);

// Offline support. Registration failure must never affect playback.
if (hasServiceWorker && import.meta.env.PROD) {
  import('virtual:pwa-register')
    .then(({ registerSW }) => registerSW({ immediate: true }))
    .catch((err) => console.warn('[sw] registration skipped', err));
}
