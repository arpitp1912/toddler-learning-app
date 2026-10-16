import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { asset, type Item } from '../content';
import { replaySound, sayItem, sayListen, sayQuestion, sayWrong, sayWrongWord, stopAll } from '../audio';
import { preloadItemAssets } from '../items';
import { guessEngine, type Round, type RoundKind } from '../rounds';
import { useSwipe } from '../swipe';
import { HomeButton } from './HomeButton';
import { ChevronIcon, EarIcon, SparkIcon, SpeechIcon } from './icons';

const PROMPT_DELAY_MS = 300;
const SPARKS = 8;

/** The last tap's feedback: which choice, how, and a counter so a repeat tap restarts it. */
type Feedback = { index: number; kind: 'right' | 'wrong'; n: number } | null;

/** Plays a round's question: the target sound (sound round) or "Where's the cow?" (word round). */
const ask = (r: Round) => (r.kind === 'sound' ? sayListen(r.target) : sayQuestion(r.target));

interface Props {
  /** Sound-round items (guessable, with a sound). */
  soundItems: Item[];
  /** Word-round items (any item). */
  wordItems: Item[];
  kinds: RoundKind[];
  choices: number;
  onHome: () => void;
}

// Guess. Two or three items and a question: in a sound round "Listen!" and one
// item's sound ("Who says that?"); in a word round "Where's the cow?" (Find it).
// A right tap bounces with a sparkle and names the item; a wrong tap wiggles,
// names that item, then asks again. No failure state, no auto-advance: edge
// zones or a swipe bring the next round.
export function Guess({ soundItems, wordItems, kinds, choices, onHome }: Props) {
  const next = useMemo(
    () => guessEngine({ sound: soundItems, word: wordItems, kinds, choices }),
    [soundItems, wordItems, kinds, choices],
  );
  const [round, setRound] = useState<Round>(() => next());
  const [roundNo, setRoundNo] = useState(0);
  const [solved, setSolved] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [replays, setReplays] = useState(0);
  const promptTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const upcoming = useRef<Round | null>(null);

  const cancelPrompt = () => {
    if (promptTimer.current) clearTimeout(promptTimer.current);
    promptTimer.current = null;
  };

  // Each round asks its question just after the items appear. The next round
  // is drawn now so its images and audio can load meanwhile.
  useEffect(() => {
    for (const i of round.choices) preloadItemAssets(i);
    upcoming.current = next();
    for (const i of upcoming.current.choices) preloadItemAssets(i);
    promptTimer.current = setTimeout(() => {
      promptTimer.current = null;
      void ask(round);
    }, PROMPT_DELAY_MS);
    return cancelPrompt;
  }, [round]);

  useEffect(() => stopAll, []);

  const tap = (index: number) => {
    // Any tap wins over the pending question; every sayX call stops the audio playing now.
    cancelPrompt();
    const item = round.choices[index];
    const right = item === round.target;
    setFeedback((f) => ({ index, kind: right ? 'right' : 'wrong', n: (f?.n ?? 0) + 1 }));
    if (right) {
      setSolved(true);
      void sayItem(item);
    } else if (solved) {
      // After the answer, the faded items just name themselves.
      void sayItem(item);
    } else if (round.kind === 'sound') {
      void sayWrong(item, round.target);
    } else {
      void sayWrongWord(item, round.target);
    }
  };

  const replay = () => {
    cancelPrompt();
    setReplays((n) => n + 1);
    void (round.kind === 'sound' ? replaySound(round.target) : sayQuestion(round.target));
  };

  const advance = () => {
    cancelPrompt();
    stopAll();
    setRound(upcoming.current ?? next());
    upcoming.current = null;
    setRoundNo((n) => n + 1);
    setSolved(false);
    setFeedback(null);
  };

  const swipe = useSwipe(advance);

  return (
    <div class="screen guess" data-kind={round.kind} data-choices={round.choices.length} style={{ touchAction: 'none' }} {...swipe}>
      <button
        class={`gs-replay${replays ? ` gs-replay--${replays % 2 ? 'A' : 'B'}` : ''}`}
        aria-label={round.kind === 'sound' ? 'Listen again' : 'Ask again'}
        onClick={replay}
      >
        {round.kind === 'sound' ? <EarIcon /> : <SpeechIcon />}
      </button>

      <div class={`gs-choices enter-${roundNo % 2 ? 'A' : 'B'}`} key={roundNo}>
        {round.choices.map((item, i) => {
          const fb = feedback?.index === i ? feedback : null;
          const par = fb && fb.n % 2 ? 'A' : 'B';
          const anim = fb ? `${fb.kind === 'right' ? 'bounce' : 'wiggle'}-${par}` : '';
          const faded = solved && item !== round.target;
          return (
            <button
              key={item.id}
              class={`gs-choice${faded ? ' is-faded' : ''}${solved && !faded ? ' is-answer' : ''}`}
              data-target={item === round.target ? 'true' : undefined}
              aria-label={item.word}
              onClick={() => tap(i)}
            >
              <span class={`gs-art ${anim}`}>
                <img class="art" src={asset(item.image)} alt="" />
              </span>
              {fb?.kind === 'right' && (
                <span class={`gs-sparkle gs-sparkle--${par}`} key={fb.n} aria-hidden="true">
                  {Array.from({ length: SPARKS }, (_, s) => (
                    <span class="gs-spark" style={{ '--a': `${(360 / SPARKS) * s}deg` }}>
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
