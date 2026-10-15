// Fills gaps in the built-in voice with Gemini text-to-speech, then runs `npm run voice`.
// Run with `npm run tts`. Needs GEMINI_API_KEY in .env.
// For every item and prompt in content.json with no word audio yet, it asks Gemini to say
// the word and saves content-src/voice/tts/{words,prompts}/<id>.wav. It skips anything that
// already has a family recording, a TTS file, or a wordAudio/audio file, and never
// overwrites an existing file. Optional .env overrides: GEMINI_TTS_MODEL, GEMINI_TTS_VOICE.
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { familySource, ttsSource, voiceEntries } from './voice.mjs';

const KEY = process.env.GEMINI_API_KEY;
const MODEL = process.env.GEMINI_TTS_MODEL || 'gemini-3.8-flash-tts';
const VOICE = process.env.GEMINI_TTS_VOICE || 'Sulafat';
const STYLE = 'Say warmly and slowly, in a gentle Indian English accent, as if to a toddler';
const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/interactions';
const MAX_WAIT_S = 300;   // a longer rate-limit wait means the daily quota is used up
const SUSPECT_S = 4;      // a single word longer than this probably read out the instruction

if (!KEY) {
  console.error('GEMINI_API_KEY is missing. Add it to .env (see .gitignore: .env is never committed).');
  process.exit(1);
}

const sleep = (s) => new Promise((r) => setTimeout(r, s * 1000));
const exists = (file) => readFile(file).then(() => true, () => false);

class QuotaError extends Error {}

/** Asks Gemini to say `text`. Returns WAV bytes. Waits out per-minute rate limits. */
async function speak(text) {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'x-goog-api-key': KEY, 'content-type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        // The instruction goes in as a style note: as plain text before the
        // word, the model reads the whole instruction aloud.
        input: [{ type: 'user_input', content: [{ type: 'text', text, annotations: [{ type: 'speech_metadata', style: STYLE }] }] }],
        response_format: { type: 'audio', mime_type: 'audio/wav' },
        generation_config: { speech_config: [{ voice: VOICE }] },
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (res.ok) {
      const audio = body.steps?.flatMap((s) => s.content ?? []).find((c) => c.type === 'audio' && c.data);
      if (!audio) throw new Error(`no audio in the response (${JSON.stringify(body).slice(0, 200)})`);
      const wav = Buffer.from(audio.data, 'base64');
      if (wav.toString('ascii', 0, 4) !== 'RIFF') throw new Error(`expected WAV, got ${audio.mime_type}`);
      return wav;
    }
    const message = body.error?.message ?? res.statusText;
    if (res.status === 429) {
      const wait = Number(/retry in ([\d.]+)s/i.exec(message)?.[1] ?? res.headers.get('retry-after') ?? 30);
      if (wait > MAX_WAIT_S || /per day/i.test(message)) throw new QuotaError(message);
      process.stdout.write(`  rate limited, waiting ${Math.ceil(wait)} s\n`);
      await sleep(wait + 1);
      continue;
    }
    if (res.status >= 500 && attempt < 3) {
      await sleep(5 * attempt);
      continue;
    }
    throw new Error(`${res.status} ${message}`);
  }
}

/** Duration of a 16-bit PCM WAV, in seconds. */
function wavSeconds(buf) {
  const rate = buf.readUInt32LE(24), bytesPerFrame = buf.readUInt16LE(32);
  let p = 12;
  while (p < buf.length && buf.toString('ascii', p, p + 4) !== 'data') p += 8 + buf.readUInt32LE(p + 4);
  return buf.readUInt32LE(p + 4) / bytesPerFrame / rate;
}

const content = JSON.parse(await readFile('public/content/content.json', 'utf8'));
const todo = [];
for (const e of voiceEntries(content)) {
  if (await familySource(e.kind, e.id)) continue;                                // family recording: never replaced
  if (await exists(ttsSource(e.kind, e.id))) continue;                           // already generated
  if (e.entry[e.field] && (await exists(path.join('public/content', e.entry[e.field])))) continue; // has audio
  todo.push(e);
}

console.log(todo.length ? `Generating ${todo.length} clips with ${MODEL} (${VOICE})…` : 'Nothing to generate.');
let made = 0, failed = 0;
for (const [i, e] of todo.entries()) {
  const dest = ttsSource(e.kind, e.id);
  try {
    const wav = await speak(e.text);
    await mkdir(path.dirname(dest), { recursive: true });
    await writeFile(dest, wav, { flag: 'wx' }); // never overwrite
    const s = wavSeconds(wav);
    console.log(`[${i + 1}/${todo.length}] ${dest}  ${s.toFixed(2)} s${s > SUSPECT_S ? '  ! long for one word: listen, delete and rerun if wrong' : ''}`);
    made++;
  } catch (err) {
    if (err instanceof QuotaError) {
      console.error(`\nQuota used up: ${err.message}\nRun \`npm run tts\` again later; finished clips are kept and skipped.`);
      failed += todo.length - i;
      break;
    }
    console.error(`[${i + 1}/${todo.length}] ${e.kind}/${e.id}: ${err.message}`);
    failed++;
  }
}

if (todo.length) console.log(`\n${made} generated${failed ? `, ${failed} not generated` : ''}. Building the voice…\n`);
execFileSync(process.execPath, ['scripts/voice.mjs'], { stdio: 'inherit' });
if (failed) process.exitCode = 1;
