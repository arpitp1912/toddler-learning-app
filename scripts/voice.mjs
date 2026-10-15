// Builds the built-in voice: word audio for items and prompt audio (SPEC sections 8a, 9, 10).
// Run with `npm run voice`. For every item and prompt in content.json, the source is
//   content-src/voice/family/{words,prompts}/<id>.<any extension>  (family recordings), else
//   content-src/voice/tts/{words,prompts}/<id>.wav                  (from `npm run tts`).
// Family recordings always win. Each clip is processed like the sounds (scripts/audio-lib.mjs)
// at the word-audio spec, written to public/content/audio/{words,prompts}/<id>.m4a, and
// linked from content.json (`wordAudio` on items, `audio` on prompts).
// Sources are never modified. Entries with no source are left as they are.
import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { processClip } from './audio-lib.mjs';

export const VOICE = 'content-src/voice';
const CONTENT = 'public/content';
const BITRATE = 64000;
const MAX_WORD_SECONDS = 1.5;

/** Words and prompts the voice covers: kind (folder), id, text, and the content.json field. */
export function voiceEntries(content) {
  return [
    ...content.items.map((item) => ({ kind: 'words', id: item.id, text: item.word, entry: item, field: 'wordAudio' })),
    ...(content.prompts ?? []).map((p) => ({ kind: 'prompts', id: p.id, text: p.text, entry: p, field: 'audio' })),
  ];
}

const list = (dir) => readdir(dir).catch(() => []);

/** The family recording for an entry, if there is one (any audio extension). */
export async function familySource(kind, id) {
  const dir = path.join(VOICE, 'family', kind);
  const file = (await list(dir)).find((f) => !f.startsWith('.') && path.parse(f).name === id);
  return file && path.join(dir, file);
}

export const ttsSource = (kind, id) => path.join(VOICE, 'tts', kind, `${id}.wav`);

const exists = (file) => readFile(file).then(() => true, () => false);

async function main() {
  const file = `${CONTENT}/content.json`;
  const before = await readFile(file, 'utf8');
  const content = JSON.parse(before);
  const entries = voiceEntries(content);

  // Family files that match nothing are probably misnamed.
  for (const kind of ['words', 'prompts']) {
    for (const f of await list(path.join(VOICE, 'family', kind))) {
      const id = path.parse(f).name;
      if (!f.startsWith('.') && !entries.some((e) => e.kind === kind && e.id === id)) {
        console.warn(`! family/${kind}/${f} matches no ${kind === 'words' ? 'item' : 'prompt'} id in content.json`);
      }
    }
  }

  let built = 0, long = 0;
  for (const e of entries) {
    const family = await familySource(e.kind, e.id);
    const src = family ?? ((await exists(ttsSource(e.kind, e.id))) ? ttsSource(e.kind, e.id) : null);
    if (!src) continue;
    const rel = `audio/${e.kind}/${e.id}.m4a`;
    const { seconds, report } = await processClip(src, path.join(CONTENT, rel), { bitrate: BITRATE });
    const tooLong = seconds > MAX_WORD_SECONDS;
    if (tooLong) long++;
    console.log(`${report}  [${family ? 'family' : 'tts'}]${tooLong ? `  ! over ${MAX_WORD_SECONDS} s` : ''}`);
    e.entry[e.field] = rel;
    built++;
  }

  const after = JSON.stringify(content, null, 2) + '\n';
  if (after !== before) await writeFile(file, after);
  const missing = entries.filter((e) => !e.entry[e.field]).map((e) => e.id);
  console.log(`\n${built} clips built${long ? `, ${long} over ${MAX_WORD_SECONDS} s` : ''}.` +
    (missing.length ? ` No audio yet (device voice plays): ${missing.join(', ')}` : ''));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main();
