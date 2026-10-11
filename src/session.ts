// Session control (SPEC section 7): counts visible play time, shows a cue one
// minute before the limit, then plays goodbye and locks until a parent resumes.
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { loadSession, saveSession, type Profile } from './db';

export type Phase = 'boot' | 'start' | 'play' | 'goodbye' | 'locked';

export const WARNING_MS = 60_000;
const GOODBYE_MS = 6_000;     // length of the goodbye scene before the lock screen
const STALE_MS = 30 * 60_000; // an unlocked session idle this long starts fresh
const TICK_MS = 1_000;
const SAVE_EVERY_MS = 5_000;

/** `paused` stops the clock while the parent area is open. */
export function useSession(profile: Profile | null, paused: boolean) {
  const [phase, setPhase] = useState<Phase>('boot');
  const [elapsedMs, setElapsedMs] = useState(0);
  const elapsedRef = useRef(0);
  elapsedRef.current = elapsedMs;
  const lockedRef = useRef(false);

  const limitMs = profile && profile.sessionLimit > 0 ? profile.sessionLimit * 60_000 : null;
  const remainingMs = limitMs == null ? null : Math.max(0, limitMs - elapsedMs);

  const persist = useCallback(() => {
    if (!profile) return;
    void saveSession({ profileId: profile.id, elapsedMs: elapsedRef.current, locked: lockedRef.current, updatedAt: Date.now() });
  }, [profile]);

  // Boot: restore lock state so a reload can't bypass it.
  useEffect(() => {
    if (!profile) return;
    let cancelled = false;
    loadSession(profile.id).then((s) => {
      if (cancelled) return;
      const stale = !s.locked && Date.now() - s.updatedAt > STALE_MS;
      lockedRef.current = s.locked;
      setElapsedMs(stale ? 0 : s.elapsedMs);
      setPhase(s.locked ? 'locked' : 'start');
    });
    return () => { cancelled = true; };
  }, [profile?.id]);

  // Play clock: only counts while the page is visible; sleep gaps are not counted.
  useEffect(() => {
    if (phase !== 'play' || paused) return;
    let last = performance.now();
    let sinceSave = 0;
    const id = setInterval(() => {
      const now = performance.now();
      const delta = Math.min(now - last, TICK_MS * 2);
      last = now;
      if (document.visibilityState !== 'visible') return;
      setElapsedMs((e) => e + delta);
      sinceSave += delta;
      if (sinceSave >= SAVE_EVERY_MS) {
        sinceSave = 0;
        persist();
      }
    }, TICK_MS);
    const onVis = () => {
      last = performance.now();
      if (document.visibilityState === 'hidden') persist();
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pagehide', persist);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pagehide', persist);
    };
  }, [phase, paused, persist]);

  const endNow = useCallback(() => {
    lockedRef.current = true;
    persist();
    setPhase('goodbye');
  }, [persist]);

  // Limit reached.
  useEffect(() => {
    if (phase === 'play' && remainingMs === 0) endNow();
  }, [phase, remainingMs, endNow]);

  // Goodbye scene hands over to the lock screen on its own.
  useEffect(() => {
    if (phase !== 'goodbye') return;
    const id = setTimeout(() => setPhase('locked'), GOODBYE_MS);
    return () => clearTimeout(id);
  }, [phase]);

  /** Child-side start (after "tap to start"). */
  const start = useCallback(() => setPhase('play'), []);

  /** Parent-side: clears the lock and starts a fresh session. */
  const resumeFresh = useCallback(() => {
    lockedRef.current = false;
    elapsedRef.current = 0;
    setElapsedMs(0);
    persist();
    setPhase('play');
  }, [persist]);

  return { phase, elapsedMs, limitMs, remainingMs, start, endNow, resumeFresh };
}
