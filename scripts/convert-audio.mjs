// Converts raw sound effects into the AAC clips the app reads (SPEC section 10):
// mono, 96 kbps, under 3 s, silence trimmed, normalised to -16 LUFS.
// Run with `npm run audio`. Per-clip start offsets live in content-src/audio/start.json.
// Uses macOS `afconvert` for decoding and encoding.
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const SRC = 'content-src/audio/raw';
const CONTENT = 'public/content';
const RATE = 48000;
const TARGET_LUFS = -16;
const MAX_PEAK_DB = -1;     // never boost past this, even if short of the target
const MAX_SECONDS = 2.9;    // under 3 s, leaving room for AAC encoder padding
const SILENCE_DB = -40;     // relative to the clip's peak
const PAD = 0.02 * RATE;    // keep 20 ms either side of the sound
const FADE_IN = 0.01 * RATE;
const FADE_OUT = 0.2 * RATE;

// Every item with a soundAudio path is built from SRC/<id>.<any extension>.
const content = JSON.parse(await readFile(`${CONTENT}/content.json`, 'utf8'));
const sources = await readdir(SRC);
// Optional seconds to skip at the start of a raw file, keyed by item id, for
// recordings whose best part isn't at the beginning.
const starts = JSON.parse(await readFile('content-src/audio/start.json', 'utf8').catch(() => '{}'));
const tmp = await mkdtemp(path.join(tmpdir(), 'audio-'));

function readFloatWav(buf) {
  let p = 12;
  while (p < buf.length) {
    const id = buf.toString('ascii', p, p + 4);
    const size = buf.readUInt32LE(p + 4);
    if (id === 'data') {
      const out = new Float32Array(size / 4);
      for (let i = 0; i < out.length; i++) out[i] = buf.readFloatLE(p + 8 + i * 4);
      return out;
    }
    p += 8 + size + (size & 1);
  }
  throw new Error('no data chunk');
}

function writeFloatWav(samples) {
  const buf = Buffer.alloc(44 + samples.length * 4);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + samples.length * 4, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(3, 20); buf.writeUInt16LE(1, 22); // IEEE float, mono
  buf.writeUInt32LE(RATE, 24); buf.writeUInt32LE(RATE * 4, 28);
  buf.writeUInt16LE(4, 32); buf.writeUInt16LE(32, 34);
  buf.write('data', 36); buf.writeUInt32LE(samples.length * 4, 40);
  samples.forEach((s, i) => buf.writeFloatLE(s, 44 + i * 4));
  return buf;
}

// Integrated loudness per ITU-R BS.1770 (K-weighting, 400 ms blocks, gated),
// using the standard 48 kHz filter coefficients.
function loudness(x) {
  const biquad = (input, [b0, b1, b2], [a1, a2]) => {
    const out = new Float32Array(input.length);
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < input.length; i++) {
      const y = b0 * input[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
      x2 = x1; x1 = input[i]; y2 = y1; y1 = y; out[i] = y;
    }
    return out;
  };
  const shelf = biquad(x, [1.53512485958697, -2.69169618940638, 1.19839281085285], [-1.69065929318241, 0.73248077421585]);
  const k = biquad(shelf, [1, -2, 1], [-1.99004745483398, 0.99007225036621]);
  const block = 0.4 * RATE, hop = 0.1 * RATE;
  const powers = [];
  for (let s = 0; s + block <= k.length || powers.length === 0; s += hop) {
    const end = Math.min(s + block, k.length);
    let sum = 0;
    for (let i = s; i < end; i++) sum += k[i] * k[i];
    powers.push(sum / (end - s));
    if (end === k.length) break;
  }
  const lufs = (p) => -0.691 + 10 * Math.log10(p);
  const mean = (ps) => ps.reduce((a, b) => a + b, 0) / ps.length;
  const abs = powers.filter((p) => lufs(p) > -70);
  if (!abs.length) return -Infinity;
  const rel = abs.filter((p) => lufs(p) > lufs(mean(abs)) - 10);
  return lufs(mean(rel));
}

const peakOf = (x) => x.reduce((m, s) => Math.max(m, Math.abs(s)), 0);
const db = (v) => 20 * Math.log10(v);

for (const { id, soundAudio } of content.items) {
  if (!soundAudio) continue;
  const file = sources.find((f) => path.parse(f).name === id);
  if (!file) throw new Error(`${id}: soundAudio is set but ${SRC}/${id}.* is missing`);

  const decoded = path.join(tmp, `${id}-in.wav`);
  execFileSync('afconvert', ['-f', 'WAVE', '-d', `LEF32@${RATE}`, '-c', '1', path.join(SRC, file), decoded]);
  let x = readFloatWav(await readFile(decoded)).slice(Math.round((starts[id] ?? 0) * RATE));

  // Trim leading and trailing silence.
  const floor = peakOf(x) * 10 ** (SILENCE_DB / 20);
  let start = x.findIndex((s) => Math.abs(s) > floor);
  let end = x.length - 1;
  while (end > start && Math.abs(x[end]) <= floor) end--;
  start = Math.max(0, start - PAD);
  end = Math.min(x.length, end + PAD + 1);
  const trimmed = end - start > MAX_SECONDS * RATE;
  x = x.slice(start, Math.min(end, start + MAX_SECONDS * RATE));

  for (let i = 0; i < FADE_IN && i < x.length; i++) x[i] *= i / FADE_IN;
  if (trimmed) for (let i = 0; i < FADE_OUT; i++) x[x.length - 1 - i] *= i / FADE_OUT;

  // Normalise loudness, holding the peak below MAX_PEAK_DB.
  const before = loudness(x);
  let gain = 10 ** ((TARGET_LUFS - before) / 20);
  const peakLimit = 10 ** (MAX_PEAK_DB / 20) / peakOf(x);
  const limited = gain > peakLimit;
  if (limited) gain = peakLimit;
  x = x.map((s) => s * gain);

  const processed = path.join(tmp, `${id}.wav`);
  await writeFile(processed, writeFloatWav(x));
  const dest = path.join(CONTENT, soundAudio);
  await mkdir(path.dirname(dest), { recursive: true });
  execFileSync('afconvert', ['-f', 'm4af', '-d', 'aac', '-b', '96000', '-c', '1', processed, dest]);

  const size = (await readFile(dest)).length;
  const notes = [trimmed && 'cut to fit', limited && `peak-limited, ${loudness(x).toFixed(1)} LUFS`].filter(Boolean);
  console.log(`${dest}  ${(x.length / RATE).toFixed(2)} s  ${(size / 1024).toFixed(0)} KB  peak ${db(peakOf(x)).toFixed(1)} dB${notes.length ? `  (${notes.join('; ')})` : ''}`);
}

await rm(tmp, { recursive: true });
