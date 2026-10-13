// Converts source PNGs into the WebP assets the app reads (SPEC section 10),
// and renders the PWA icons. Run with `npm run assets`.
import sharp from 'sharp';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const SRC = 'design/style';
const CONTENT = 'public/content';

// Every item and scene image listed in content.json is built from SRC/<id>.png.
const content = JSON.parse(await readFile(`${CONTENT}/content.json`, 'utf8'));

// Item art has a plain pale background (STYLE.md). Flood-fill it away from the
// edges so subjects sit cleanly on any tile colour. Only pixels connected to the
// border and close to the corner colour are removed; a one-pixel feather band
// softens the edge. Pale areas inside the outline are untouched. The fill runs on
// a shrunken pale mask so it can't squeeze through small gaps in an outline (the
// cat's white tail tip), then grows back to the true edge.
const KEY_CORE = 22;   // colour distance treated as background
const KEY_FEATHER = 44; // distance at which the feather band becomes opaque
const KEY_GAP = 3;     // outline gaps up to 2 * KEY_GAP px wide don't leak
const KEY_POCKET = 6000; // leftover pale pockets smaller than this (px) are background
const KEY_HOLE = 6;      // enclosed pale areas averaging this close to the background are holes

// Binary erode (all ones in the box) or dilate (any one) with a square box of
// radius r, as two 1-D sliding-window passes. Off-image pixels count as pale
// when eroding so the border itself never shrinks.
function morph(src, w, h, r, erode) {
  const k = 2 * r + 1, oob = erode ? 1 : 0;
  const pass = (from, to, n, lines, stride, step) => {
    for (let l = 0; l < lines; l++) {
      const base = l * step;
      const val = (j) => (j < 0 || j >= n ? oob : from[base + j * stride]);
      let sum = 0;
      for (let j = -r; j <= r; j++) sum += val(j);
      for (let i = 0; i < n; i++) {
        to[base + i * stride] = erode ? +(sum === k) : +(sum > 0);
        sum += val(i + r + 1) - val(i - r);
      }
    }
  };
  const tmp = new Uint8Array(w * h), out = new Uint8Array(w * h);
  pass(src, tmp, w, h, 1, w);
  pass(tmp, out, h, w, w, 1);
  return out;
}

async function keyBackground(src) {
  const { data, info } = await sharp(src).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const corners = [0, w - 1, (h - 1) * w, h * w - 1];
  const bg = [0, 1, 2].map((c) => corners.reduce((sum, p) => sum + data[p * 3 + c], 0) / corners.length);
  const dist = (p) => Math.hypot(data[p * 3] - bg[0], data[p * 3 + 1] - bg[1], data[p * 3 + 2] - bg[2]);

  const pale = new Uint8Array(w * h);
  for (let p = 0; p < w * h; p++) pale[p] = +(dist(p) <= KEY_CORE);
  const core = morph(pale, w, h, KEY_GAP, true);

  const reached = new Uint8Array(w * h);
  const queue = new Int32Array(w * h);
  let head = 0, tail = 0;
  const visit = (p) => {
    if (reached[p] || !core[p]) return;
    reached[p] = 1;
    queue[tail++] = p;
  };
  for (let x = 0; x < w; x++) { visit(x); visit((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { visit(y * w); visit(y * w + w - 1); }
  while (head < tail) {
    const p = queue[head++];
    const x = p % w;
    if (x > 0) visit(p - 1);
    if (x < w - 1) visit(p + 1);
    if (p >= w) visit(p - w);
    if (p < w * (h - 1)) visit(p + w);
  }
  const grown = morph(reached, w, h, KEY_GAP, false);
  const alpha = new Uint8Array(w * h);
  for (let p = 0; p < w * h; p++) alpha[p] = pale[p] && grown[p] ? 0 : 255;

  // Small pale pockets the shrunken fill couldn't reach (between feet, under a
  // perch) are background too. Larger pale areas joined only through a narrow
  // gap are part of the subject and stay.
  const seen = new Uint8Array(w * h);
  const touchesBg = (p) => {
    const x = p % w;
    return (x > 0 && alpha[p - 1] === 0) || (x < w - 1 && alpha[p + 1] === 0) ||
      (p >= w && alpha[p - w] === 0) || (p < w * (h - 1) && alpha[p + w] === 0);
  };
  for (let s = 0; s < w * h; s++) {
    if (seen[s] || !pale[s] || alpha[s] === 0 || !touchesBg(s)) continue;
    head = 0; tail = 0;
    seen[s] = 1; queue[tail++] = s;
    while (head < tail) {
      const p = queue[head++];
      const x = p % w;
      for (const q of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, p - w, p + w]) {
        if (q < 0 || q >= w * h || seen[q] || !pale[q] || alpha[q] === 0) continue;
        seen[q] = 1; queue[tail++] = q;
      }
    }
    if (tail < KEY_POCKET) for (let i = 0; i < tail; i++) alpha[queue[i]] = 0;
  }

  // Holes fully enclosed by the subject (inside a cup or jug handle) show the
  // flat background colour. Pale parts of the subject itself (a clock face, a
  // white chest) sit further from it, around 10-17, so they stay.
  for (let s = 0; s < w * h; s++) {
    if (seen[s] || !pale[s] || alpha[s] === 0) continue;
    head = 0; tail = 0;
    seen[s] = 1; queue[tail++] = s;
    let sum = 0;
    while (head < tail) {
      const p = queue[head++];
      sum += dist(p);
      const x = p % w;
      for (const q of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, p - w, p + w]) {
        if (q < 0 || q >= w * h || seen[q] || !pale[q] || alpha[q] === 0) continue;
        seen[q] = 1; queue[tail++] = q;
      }
    }
    if (sum / tail <= KEY_HOLE) for (let i = 0; i < tail; i++) alpha[queue[i]] = 0;
  }

  // Feather: opaque pixels touching the removed area fade by colour distance.
  for (let p = 0; p < w * h; p++) {
    if (alpha[p] === 0) continue;
    const x = p % w;
    const edge = (x > 0 && alpha[p - 1] === 0) || (x < w - 1 && alpha[p + 1] === 0) ||
      (p >= w && alpha[p - w] === 0) || (p < w * (h - 1) && alpha[p + w] === 0);
    if (edge) {
      const t = (dist(p) - KEY_CORE) / (KEY_FEATHER - KEY_CORE);
      alpha[p] = Math.round(255 * Math.min(1, Math.max(0.15, t)));
    }
  }
  const rgba = Buffer.alloc(w * h * 4);
  for (let p = 0; p < w * h; p++) {
    rgba[p * 4] = data[p * 3]; rgba[p * 4 + 1] = data[p * 3 + 1]; rgba[p * 4 + 2] = data[p * 3 + 2];
    rgba[p * 4 + 3] = alpha[p];
  }
  return sharp(rgba, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer();
}

async function webp(src, dest, width, height, quality, { key = false } = {}) {
  await mkdir(path.dirname(dest), { recursive: true });
  const input = key ? await keyBackground(src) : src;
  const info = await sharp(input).resize(width, height, { fit: 'cover' }).webp({ quality, alphaQuality: 90, effort: 6 }).toFile(dest);
  console.log(`${dest}  ${width}x${height}  ${(info.size / 1024).toFixed(0)} KB`);
}

for (const { id, image } of content.items) {
  await webp(`${SRC}/${id}.png`, `${CONTENT}/${image}`, 1024, 1024, 82, { key: true });
}
// Source scene is square; SPEC wants 2048x1536. Kept at native size until the
// 4:3 scene art is generated (M3).
for (const { id, image } of content.scenes ?? []) {
  await webp(`${SRC}/${id}.png`, `${CONTENT}/${image}`, 1024, 1024, 80);
}

// App icons: cow on the app's cream ground. iOS ignores transparency, so flatten.
const BG = '#F8EFD9';
await mkdir('public/icons', { recursive: true });
for (const [name, size, pad] of [
  ['icon-192.png', 192, 0],
  ['icon-512.png', 512, 0],
  ['icon-maskable-512.png', 512, 0.12],
  ['apple-touch-icon.png', 180, 0],
]) {
  const inner = Math.round(size * (1 - pad * 2));
  const art = await sharp(`${SRC}/cow.png`).resize(inner, inner).toBuffer();
  await sharp({ create: { width: size, height: size, channels: 3, background: BG } })
    .composite([{ input: art, gravity: 'center' }])
    .png()
    .toFile(`public/icons/${name}`);
  console.log(`public/icons/${name}`);
}
