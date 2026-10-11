import type { Profile, SessionLimit } from '../db';
import { isStandalone } from '../features';

const LIMITS: SessionLimit[] = [0, 5, 10, 15, 20];

interface Props {
  profile: Profile;
  locked: boolean;
  elapsedMs: number;
  onBack: () => void;
  onNewSession: () => void;
  onEndNow: () => void;
  onLimit: (limit: SessionLimit) => void;
}

const minutes = (ms: number) => Math.floor(ms / 60_000);

// Minimal M1 parent area: session limit and control, plus setup help.
export function ParentPanel({ profile, locked, elapsedMs, onBack, onNewSession, onEndNow, onLimit }: Props) {
  const used = minutes(elapsedMs);
  const status = locked
    ? 'Play time is over. Start a new session when you are ready.'
    : profile.sessionLimit
      ? `${used} of ${profile.sessionLimit} minutes used in this session.`
      : `${used} minutes played. No time limit is set.`;

  return (
    <div class="parent" role="dialog" aria-modal="true" aria-labelledby="parent-title">
      <div class="parent-wrap">
        <h1 id="parent-title">Parent area</h1>

        <section class="parent-card">
          <h2>Play session</h2>
          <p>{status}</p>
          <div class="pbtn-row">
            {locked ? (
              <button class="pbtn pbtn--primary" onClick={onNewSession}>Start a new session</button>
            ) : (
              <>
                <button class="pbtn pbtn--primary" onClick={onBack}>Back to play</button>
                <button class="pbtn" onClick={onNewSession}>Restart the timer</button>
                <button class="pbtn" onClick={onEndNow}>End session now</button>
              </>
            )}
          </div>
        </section>

        <section class="parent-card">
          <h2>Time limit</h2>
          <p class="parent-muted">A sun fades one minute before the end. Then a goodbye plays and the screen locks.</p>
          <div class="seg" role="group" aria-label="Time limit">
            {LIMITS.map((l) => (
              <button key={l} class="pbtn" aria-pressed={profile.sessionLimit === l} onClick={() => onLimit(l)}>
                {l === 0 ? 'Off' : `${l} min`}
              </button>
            ))}
          </div>
        </section>

        <section class="parent-card">
          <h2>Install on iPad or iPhone</h2>
          <ol>
            <li>Open this page in Safari.</li>
            <li>Tap the Share button, then <strong>Add to Home Screen</strong>.</li>
            <li>Open the app from its new home screen icon while online once. After that it works with no internet.</li>
          </ol>
          <p class="parent-muted">{isStandalone ? 'Running as an installed app.' : 'Running in the browser, not yet installed.'}</p>
        </section>

        <section class="parent-card">
          <h2>Lock the device to this app</h2>
          <ol>
            <li>Open <strong>Settings → Accessibility → Guided Access</strong> and turn it on. Set a passcode.</li>
            <li>Open this app, then triple-click the top (or Home) button and tap <strong>Start</strong>.</li>
            <li>To finish, triple-click again and enter the passcode.</li>
          </ol>
        </section>
      </div>
    </div>
  );
}
