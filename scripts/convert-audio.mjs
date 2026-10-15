// Converts raw sound effects into the AAC clips the app reads (SPEC section 10):
// mono, 96 kbps, under 3 s, silence trimmed, normalised to -16 LUFS.
// Run with `npm run audio`. Per-clip start offsets live in content-src/audio/start.json.
// The processing itself is shared with `npm run voice` (scripts/audio-lib.mjs).
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { processClip } from './audio-lib.mjs';

const SRC = 'content-src/audio/raw';
const CONTENT = 'public/content';
const MAX_SECONDS = 2.9;    // under 3 s, leaving room for AAC encoder padding

// Every item with a soundAudio path is built from SRC/<id>.<any extension>.
const content = JSON.parse(await readFile(`${CONTENT}/content.json`, 'utf8'));
const sources = await readdir(SRC);
// Optional seconds to skip at the start of a raw file, keyed by item id, for
// recordings whose best part isn't at the beginning.
const starts = JSON.parse(await readFile('content-src/audio/start.json', 'utf8').catch(() => '{}'));

for (const { id, soundAudio } of content.items) {
  if (!soundAudio) continue;
  const file = sources.find((f) => path.parse(f).name === id);
  if (!file) throw new Error(`${id}: soundAudio is set but ${SRC}/${id}.* is missing`);
  const { report } = await processClip(path.join(SRC, file), path.join(CONTENT, soundAudio), {
    start: starts[id] ?? 0,
    maxSeconds: MAX_SECONDS,
  });
  console.log(report);
}
