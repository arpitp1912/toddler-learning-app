// Shared clip processing for `npm run audio` (sounds) and `npm run voice` (words
// and prompts): decode, trim silence, fade, normalise loudness, encode AAC.
// Uses macOS `afconvert` for decoding and encoding.
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

export const RATE = 48000;
const MAX_PEAK_DB = -1;     // peak ceiling after normalising
const MAX_LIMIT_DB = 9;     // most gain reduction the limiter may apply to short peaks
const LOOKAHEAD = 0.005 * RATE;
const RELEASE = 0.08 * RATE;
const SILENCE_DB = -40;     // relative to the clip's peak
const PAD = 0.02 * RATE;    // keep 20 ms either side of the sound
const FADE_IN = 0.01 * RATE;
const FADE_OUT = 0.2 * RATE;

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
export function loudness(x) {
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

export const peakOf = (x) => x.reduce((m, s) => Math.max(m, Math.abs(s)), 0);
export const db = (v) => 20 * Math.log10(v);

// Lookahead peak limiter holding samples at or below MAX_PEAK_DB. The gain each
// sample needs is min-held over the lookahead window, then box-averaged over the
// same window, which never exceeds the need at any sample; a slow release then
// lets it recover without pumping.
function limit(x) {
  const ceiling = 10 ** (MAX_PEAK_DB / 20);
  const need = x.map((s) => Math.min(1, ceiling / Math.max(Math.abs(s), 1e-9)));
  const held = new Float32Array(x.length);
  for (let i = 0; i < x.length; i++) {
    let m = 1;
    for (let j = i; j < Math.min(i + LOOKAHEAD, x.length); j++) m = Math.min(m, need[j]);
    held[i] = m;
  }
  const out = new Float32Array(x.length);
  const recover = 1 - Math.exp(-1 / RELEASE);
  let sum = LOOKAHEAD, env = 1; // the window starts full of unity gain
  for (let i = 0; i < x.length; i++) {
    sum += held[i] - (i >= LOOKAHEAD ? held[i - LOOKAHEAD] : 1);
    env = Math.min(sum / LOOKAHEAD, env + (1 - env) * recover);
    out[i] = x[i] * Math.min(env, need[i]);
  }
  return out;
}

const WINDOW = 0.02 * RATE;   // 20 ms, for measuring room noise
const NOISE_MARGIN_DB = 12;   // speech must stand this far above the room noise
const SPEECH_RANGE_DB = 35;   // and within this of the loudest window
const VOICE_PAD = 0.06 * RATE; // soft consonants (the h in "hen") fade in and out slowly
const VOICE_FADE_OUT = 0.05 * RATE;
const MAX_GAP = 0.25 * RATE;     // a longer pause ends the word

/**
 * Finds speech in a voice recording. Phone recordings carry room noise well
 * above the fixed -40 dB silence floor, so the floor here comes from the
 * clip's own noise: the quietest tenth of its 20 ms windows. Only the sound
 * around the loudest moment is kept: a pause over MAX_GAP ends it.
 */
function speechBounds(x) {
  const rms = [];
  for (let s = 0; s < x.length; s += WINDOW) {
    let sum = 0;
    const end = Math.min(s + WINDOW, x.length);
    for (let i = s; i < end; i++) sum += x[i] * x[i];
    rms.push(Math.sqrt(sum / (end - s)));
  }
  const sorted = [...rms].sort((a, b) => a - b);
  const noise = sorted[Math.floor(sorted.length * 0.1)];
  const loudest = sorted[sorted.length - 1];
  const floor = Math.max(noise * 10 ** (NOISE_MARGIN_DB / 20), loudest * 10 ** (-SPEECH_RANGE_DB / 20));
  // Grow outwards from the loudest window across short dips (between syllables),
  // so a tap or breath after a long pause isn't kept as part of the word.
  const peak = rms.indexOf(loudest);
  const maxGap = Math.round(MAX_GAP / WINDOW);
  const grow = (from, step) => {
    let edge = from, quiet = 0;
    for (let i = from + step; i >= 0 && i < rms.length && quiet <= maxGap; i += step) {
      if (rms[i] > floor) { edge = i; quiet = 0; } else quiet++;
    }
    return edge;
  };
  const first = grow(peak, -1), last = grow(peak, 1);
  return [Math.max(0, first * WINDOW - VOICE_PAD), Math.min(x.length, (last + 1) * WINDOW + VOICE_PAD)];
}

/**
 * Processes one clip and writes it as mono AAC.
 * - `start`: seconds to skip at the start of the source.
 * - `maxSeconds`: longer clips are cut with a fade-out; Infinity never cuts.
 * - `voice`: trim to the speech using the clip's own noise floor, and fade the end.
 * Returns a one-line report.
 */
export async function processClip(src, dest, { start: skip = 0, maxSeconds = Infinity, lufs: target = -16, bitrate = 96000, voice = false } = {}) {
  const tmp = await mkdtemp(path.join(tmpdir(), 'audio-'));
  try {
    const decoded = path.join(tmp, 'in.wav');
    execFileSync('afconvert', ['-f', 'WAVE', '-d', `LEF32@${RATE}`, '-c', '1', src, decoded]);
    let x = readFloatWav(await readFile(decoded)).slice(Math.round(skip * RATE));

    // Trim leading and trailing silence.
    let start, end;
    if (voice) {
      [start, end] = speechBounds(x);
    } else {
      const floor = peakOf(x) * 10 ** (SILENCE_DB / 20);
      start = x.findIndex((s) => Math.abs(s) > floor);
      end = x.length - 1;
      while (end > start && Math.abs(x[end]) <= floor) end--;
      start = Math.max(0, start - PAD);
      end = Math.min(x.length, end + PAD + 1);
    }
    const trimmed = end - start > maxSeconds * RATE;
    x = x.slice(start, Math.min(end, start + maxSeconds * RATE));

    for (let i = 0; i < FADE_IN && i < x.length; i++) x[i] *= i / FADE_IN;
    if (trimmed) for (let i = 0; i < FADE_OUT; i++) x[x.length - 1 - i] *= i / FADE_OUT;
    else if (voice) for (let i = 0; i < VOICE_FADE_OUT && i < x.length; i++) x[x.length - 1 - i] *= i / VOICE_FADE_OUT;

    // Normalise loudness. Short peaks that would pass MAX_PEAK_DB are turned down
    // by the limiter, so a few spikes don't hold the whole clip below target.
    const raw = x;
    let gain = 10 ** ((target - loudness(raw)) / 20);
    let limited = false;
    for (let pass = 0; pass < 6; pass++) {
      x = raw.map((s) => s * gain);
      if (db(peakOf(x)) <= MAX_PEAK_DB) break;
      limited = true;
      x = limit(x);
      const miss = target - loudness(x);
      if (Math.abs(miss) < 0.1) break;
      gain *= 10 ** (miss / 20);
    }
    if (limited && db(peakOf(raw)) + db(gain) - MAX_PEAK_DB > MAX_LIMIT_DB) {
      // Too much limiting would squash the sound; fall back to peak-normalising.
      x = raw.map((s) => s * 10 ** (MAX_PEAK_DB / 20) / peakOf(raw));
    }

    const processed = path.join(tmp, 'out.wav');
    await writeFile(processed, writeFloatWav(x));
    await mkdir(path.dirname(dest), { recursive: true });
    execFileSync('afconvert', ['-f', 'm4af', '-d', 'aac', '-b', String(bitrate), '-c', '1', processed, dest]);

    const size = (await readFile(dest)).length;
    const seconds = x.length / RATE;
    const notes = [trimmed && 'cut to fit', limited && `limited, ${loudness(x).toFixed(1)} LUFS`].filter(Boolean);
    return { seconds, report: `${dest}  ${seconds.toFixed(2)} s  ${(size / 1024).toFixed(0)} KB  peak ${db(peakOf(x)).toFixed(1)} dB${notes.length ? `  (${notes.join('; ')})` : ''}` };
  } finally {
    await rm(tmp, { recursive: true });
  }
}
