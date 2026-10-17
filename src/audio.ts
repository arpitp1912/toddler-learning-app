// Small audio wrapper: Web Audio for recorded clips, speech synthesis as the
// built-in default voice until recorded word audio exists (SPEC sections 9, 11).
import { AudioContextCtor, hasSpeech } from './features';
import { asset, type Item, type Prompt } from './content';

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
  for (const path of builtInPrompts.values()) preload(path);
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

/**
 * Stops whatever is playing and starts a new sequence. Pass the token to
 * playWord / playSound; a later sequence makes them stop early.
 */
export function newSequence(): number {
  stopAll();
  return seq;
}

export const isCurrent = (mine: number) => mine === seq;

const SOUND_REPEATS = 2;
const SOUND_GAP_MS = 400;

// Prompt clips (SPEC 8a), keyed by prompt id ("peekaboo"). Voice packs (M5)
// register theirs here; they win over the built-in voice from content.json,
// and the device voice says the text when neither has a clip.
const promptClips = new Map<string, string>();
const builtInPrompts = new Map<string, string>();
const promptTexts = new Map<string, string>();

export function setPromptClip(key: string, path: string | null) {
  if (path) promptClips.set(key, path);
  else promptClips.delete(key);
}

/** Registers content.json prompts: their built-in clips and fallback texts. */
export function setBuiltInPrompts(prompts: Prompt[] = []) {
  builtInPrompts.clear();
  for (const p of prompts) {
    promptTexts.set(p.id, p.text);
    if (p.audio) {
      builtInPrompts.set(p.id, p.audio);
      preload(p.audio);
    }
  }
}

async function sayPrompt(key: string, text: string, mine: number) {
  for (const clip of [promptClips.get(key), builtInPrompts.get(key)]) {
    if (clip && (await playClip(clip))) return;
    if (mine !== seq) return;
  }
  await speak(promptTexts.get(key) ?? text);
}

/** Goodbye screen: "Bye bye!" (prompt `bye`). */
export async function sayBye() {
  stopAll();
  await sayPrompt('bye', 'Bye bye!', seq);
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** An item's sound, `times` over with the usual gap. Resolves false if interrupted. */
export async function playSound(item: Item, mine: number, times = SOUND_REPEATS): Promise<boolean> {
  for (let i = 0; i < times && item.soundAudio; i++) {
    if (i > 0) await wait(SOUND_GAP_MS);
    if (mine !== seq) return false;
    if (!(await playClip(item.soundAudio))) break;
  }
  return mine === seq;
}

/** Word, then sound twice with a short gap. Resolves false if interrupted. */
async function playItem(item: Item, mine: number): Promise<boolean> {
  if (!(await playWord(item, mine))) return false;
  return playSound(item, mine);
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

/** Guess sound round: "Listen!" (voice-pack prompt `listen`), then the target's sound. */
export async function sayListen(target: Item) {
  stopAll();
  const mine = seq;
  await sayPrompt('listen', 'Listen!', mine);
  if (mine === seq) await playSound(target, mine);
}

/** Guess sound round: the ear button replays the target's sound. */
export async function replaySound(target: Item) {
  stopAll();
  await playSound(target, seq);
}

/** An item's word: recorded audio, else the device voice. Resolves false if interrupted. */
export async function playWord(item: Item, mine: number): Promise<boolean> {
  const recorded = item.wordAudio ? await playClip(item.wordAudio) : false;
  if (mine !== seq) return false;
  if (!recorded) await speak(item.word);
  return mine === seq;
}

async function playQuestion(target: Item, mine: number) {
  await sayPrompt('wheres', "Where's the", mine);
  if (mine === seq) await playWord(target, mine);
}

/**
 * Guess word round (Find it): "Where's the" (voice-pack prompt `wheres`, else the
 * built-in clip, else the device voice), then the target's word. Also the replay button.
 */
export async function sayQuestion(target: Item) {
  stopAll();
  await playQuestion(target, seq);
}

const WRONG_PAUSE_MS = 500;

/**
 * Guess sound round, wrong tap: the tapped item's word and its own sound (once,
 * to keep the detour short), then the target's sound again.
 */
export async function sayWrong(tapped: Item, target: Item) {
  stopAll();
  const mine = seq;
  if (!(await playWord(tapped, mine))) return;
  if (!(await playSound(tapped, mine, 1))) return;
  await wait(WRONG_PAUSE_MS);
  if (mine === seq) await playSound(target, mine);
}

/** Guess word round, wrong tap: the tapped item's word, then the question again. */
export async function sayWrongWord(tapped: Item, target: Item) {
  stopAll();
  const mine = seq;
  if (!(await playWord(tapped, mine))) return;
  await wait(WRONG_PAUSE_MS);
  if (mine === seq) await playQuestion(target, mine);
}

/**
 * Soft bubble pop, synthesised (no audio file): a short sine blip with a
 * falling pitch. It is a sound effect, so it is not stopped by stopAll and
 * never interrupts item audio.
 */
export function popSound() {
  if (!ctx) return;
  try {
    if (ctx.state !== 'running') void ctx.resume();
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(720, t);
    osc.frequency.exponentialRampToValueAtTime(240, t + 0.12);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.3, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.16);
  } catch (err) {
    console.warn('[audio] pop unavailable', err);
  }
}
