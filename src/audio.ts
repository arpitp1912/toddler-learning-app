// Small audio wrapper: Web Audio for recorded clips, speech synthesis as the
// built-in default voice until recorded word audio exists (SPEC sections 9, 11).
import { AudioContextCtor, hasSpeech } from './features';
import { asset, type Item } from './content';

let ctx: AudioContext | null = null;
const buffers = new Map<string, Promise<AudioBuffer | null>>();
let current: AudioBufferSourceNode | null = null;
let seq = 0; // bumps on every new playback so stale sequences stop early

/**
 * Must run inside a user gesture (the "tap to start" button, or a parent tap).
 * iOS keeps audio locked until then.
 */
export function unlockAudio() {
  try {
    if (!ctx && AudioContextCtor) ctx = new AudioContextCtor();
    if (ctx) {
      if (ctx.state !== 'running') void ctx.resume();
      // A silent one-sample buffer fully unlocks output on older WebKit.
      const src = ctx.createBufferSource();
      src.buffer = ctx.createBuffer(1, 1, 22050);
      src.connect(ctx.destination);
      src.start(0);
    }
  } catch (err) {
    console.warn('[audio] Web Audio unavailable', err);
  }
  if (hasSpeech) {
    // Prime speech synthesis inside the gesture; iOS ignores later calls otherwise.
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0;
    speechSynthesis.speak(u);
    pickVoice();
  }
}

/** Starts fetching and decoding a clip. Safe to call many times. */
export function preload(path?: string) {
  if (!path || !ctx || buffers.has(path)) return;
  const c = ctx;
  buffers.set(
    path,
    fetch(asset(path))
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
      .then((data) => new Promise<AudioBuffer>((resolve, reject) => c.decodeAudioData(data, resolve, reject)))
      .catch((err) => {
        console.warn('[audio] could not load', path, err);
        return null;
      }),
  );
}

export function preloadItem(item: Item) {
  preload(item.wordAudio);
  preload(item.soundAudio);
}

function playClip(path: string, volume = 1): Promise<boolean> {
  preload(path);
  const pending = buffers.get(path);
  if (!ctx || !pending) return Promise.resolve(false);
  const c = ctx;
  const mine = seq;
  return pending.then(
    (buf) =>
      new Promise<boolean>((resolve) => {
        // Stopped while the clip was still decoding: never start it late.
        if (!buf || mine !== seq) return resolve(false);
        if (c.state !== 'running') void c.resume();
        const src = c.createBufferSource();
        src.buffer = buf;
        let out: AudioNode = c.destination;
        if (volume < 1) {
          const gain = c.createGain();
          gain.gain.value = volume;
          gain.connect(c.destination);
          out = gain;
        }
        src.connect(out);
        src.onended = () => resolve(true);
        current = src;
        src.start(0);
      }),
  );
}

let voice: SpeechSynthesisVoice | null = null;
function pickVoice() {
  if (!hasSpeech) return;
  const voices = speechSynthesis.getVoices();
  const english = voices.filter((v) => /^en[-_]/i.test(v.lang));
  voice =
    english.find((v) => v.localService && /^en[-_](GB|US|AU|IN)/i.test(v.lang)) ??
    english.find((v) => v.localService) ??
    english[0] ??
    null;
}
if (hasSpeech) speechSynthesis.addEventListener?.('voiceschanged', pickVoice);

/** Speaks a word with the device voice. Resolves when done (with a safety timeout). */
export function speak(text: string): Promise<void> {
  if (!hasSpeech) return Promise.resolve();
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(text);
    if (voice) u.voice = voice;
    u.lang = voice?.lang ?? 'en-GB';
    u.rate = 0.8;
    u.pitch = 1.1;
    // iOS sometimes never fires onend; never let that stall the sequence.
    const timer = setTimeout(resolve, 2500);
    u.onend = u.onerror = () => {
      clearTimeout(timer);
      resolve();
    };
    // iOS can leave the synth paused after the app was backgrounded.
    if (speechSynthesis.paused) speechSynthesis.resume();
    speechSynthesis.speak(u);
  });
}

export function stopAll() {
  seq++;
  try { current?.stop(); } catch { /* already stopped */ }
  current = null;
  if (hasSpeech) speechSynthesis.cancel();
}

const SOUND_REPEATS = 2;
const SOUND_GAP_MS = 400;

// Voice-pack prompt clips (SPEC 8a), keyed by prompt id ("peekaboo"). Voice
// packs (M5) register theirs here; until then prompts use the device voice.
const promptClips = new Map<string, string>();

export function setPromptClip(key: string, path: string | null) {
  if (path) promptClips.set(key, path);
  else promptClips.delete(key);
}

async function sayPrompt(key: string, text: string, mine: number) {
  const clip = promptClips.get(key);
  if (clip && (await playClip(clip))) return;
  if (mine === seq) await speak(text);
}

/** Word, then sound twice with a short gap. Resolves false if interrupted. */
async function playItem(item: Item, mine: number): Promise<boolean> {
  const recorded = item.wordAudio ? await playClip(item.wordAudio) : false;
  if (mine !== seq) return false;
  if (!recorded) await speak(item.word);
  for (let i = 0; i < SOUND_REPEATS && item.soundAudio; i++) {
    if (mine !== seq) return false;
    if (i > 0) await new Promise((r) => setTimeout(r, SOUND_GAP_MS));
    if (mine !== seq) return false;
    if (!(await playClip(item.soundAudio))) break;
  }
  return mine === seq;
}

/**
 * Plays an item's word, then its sound twice with a short gap (clips are under
 * 3 s, too short on their own). A new call interrupts the previous one.
 * Resolves true if it played to the end.
 */
export async function sayItem(item: Item): Promise<boolean> {
  stopAll();
  return playItem(item, seq);
}

/**
 * "Peekaboo" as a new cover appears. With `hint`, the hidden item's sound
 * follows once, quietly (Peekaboo sound hint). Silent hint if it has none.
 */
export async function sayPeekaboo(hint?: { item: Item; volume: number }) {
  stopAll();
  const mine = seq;
  await sayPrompt('peekaboo', 'peekaboo', mine);
  if (mine === seq && hint?.item.soundAudio) await playClip(hint.item.soundAudio, hint.volume);
}
