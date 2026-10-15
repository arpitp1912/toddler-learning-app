import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { asset, type Item } from '../content';
import { replaySound, sayItem, sayListen, sayWrong, stopAll } from '../audio';
import { preloadItemAssets } from '../items';
import { roundMaker, type Round } from '../rounds';
import { useSwipe } from '../swipe';
import { HomeButton } from './HomeButton';
import { ChevronIcon, EarIcon, SparkIcon } from './icons';

const LISTEN_DELAY_MS = 300;
const SPARKS = 8;

/** The last tap's feedback: which choice, how, and a counter so a repeat tap restarts it. */
type Feedback = { index: number; kind: 'right' | 'wrong'; n: number } | null;

// "Who says that?". Two or three items; "Listen!" and one item's sound play,
// and the child taps who makes it. A right tap bounces with a sparkle and
// names the item; a wrong tap wiggles, names that item, then replays the
// sound. No failure state, no auto-advance: edge zones or a swipe bring the next round.
export function WhoSays({ items, choices, onHome }: { items: Item[]; choices: number; onHome: () => void }) {
  const next = useMemo(() => roundMaker(items, choices), [items, choices]);
  const [round, setRound] = useState<Round>(() => next());
  const [roundNo, setRoundNo] = useState(0);
  const [solved, setSolved] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [ears, setEars] = useState(0);
  const listenTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const upcoming = useRef<Round | null>(null);

  const cancelListen = () => {
    if (listenTimer.current) clearTimeout(listenTimer.current);
    listenTimer.current = null;
  };

  // Each round: "Listen!" and the target's sound, just after the items appear.
  // The next round is drawn now so its images and audio can load meanwhile.
  useEffect(() => {
    for (const i of round.choices) preloadItemAssets(i);
    upcoming.current = next();
    for (const i of upcoming.current.choices) preloadItemAssets(i);
    listenTimer.current = setTimeout(() => {
      listenTimer.current = null;
      void sayListen(round.target);
    }, LISTEN_DELAY_MS);
    return cancelListen;
  }, [round]);

  useEffect(() => stopAll, []);

  const tap = (index: number) => {
    // Any tap wins over the pending "Listen!"; every sayX call stops the audio playing now.
    cancelListen();
    const item = round.choices[index];
    const right = item === round.target;
    setFeedback((f) => ({ index, kind: right ? 'right' : 'wrong', n: (f?.n ?? 0) + 1 }));
    if (right) {
      setSolved(true);
      void sayItem(item);
    } else if (solved) {
      // After the answer, the faded items just name themselves.
      void sayItem(item);
    } else {
      void sayWrong(item, round.target);
    }
  };

  const ear = () => {
    cancelListen();
    setEars((n) => n + 1);
    void replaySound(round.target);
  };

  const advance = () => {
    cancelListen();
    stopAll();
    setRound(upcoming.current ?? next());
    upcoming.current = null;
    setRoundNo((n) => n + 1);
    setSolved(false);
    setFeedback(null);
  };

  const swipe = useSwipe(advance);

  return (
    <div class="screen whosays" data-choices={round.choices.length} style={{ touchAction: 'none' }} {...swipe}>
      <button class={`ws-ear${ears ? ` ws-ear--${ears % 2 ? 'A' : 'B'}` : ''}`} aria-label="Listen again" onClick={ear}>
        <EarIcon />
      </button>

      <div class={`ws-choices enter-${roundNo % 2 ? 'A' : 'B'}`} key={roundNo}>
        {round.choices.map((item, i) => {
          const fb = feedback?.index === i ? feedback : null;
          const par = fb && fb.n % 2 ? 'A' : 'B';
          const anim = fb ? `${fb.kind === 'right' ? 'bounce' : 'wiggle'}-${par}` : '';
          const faded = solved && item !== round.target;
          return (
            <button
              key={item.id}
              class={`ws-choice${faded ? ' is-faded' : ''}${solved && !faded ? ' is-answer' : ''}`}
              data-target={item === round.target ? 'true' : undefined}
              aria-label={item.word}
              onClick={() => tap(i)}
            >
              <span class={`ws-art ${anim}`}>
                <img class="art" src={asset(item.image)} alt="" />
              </span>
              {fb?.kind === 'right' && (
                <span class={`ws-sparkle ws-sparkle--${par}`} key={fb.n} aria-hidden="true">
                  {Array.from({ length: SPARKS }, (_, s) => (
                    <span class="ws-spark" style={{ '--a': `${(360 / SPARKS) * s}deg` }}>
                      <SparkIcon />
                    </span>
                  ))}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <HomeButton onHome={onHome} />

      <button class="edge edge--prev" aria-label="Next" onClick={advance}>
        <span class="edge-pill">
          <ChevronIcon dir="left" />
        </span>
      </button>
      <button class="edge edge--next" aria-label="Next" onClick={advance}>
        <span class="edge-pill">
          <ChevronIcon dir="right" />
        </span>
      </button>
    </div>
  );
}
