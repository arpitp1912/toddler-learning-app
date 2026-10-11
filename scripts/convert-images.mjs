// Converts source PNGs into the WebP assets the app reads (SPEC section 10),
// and renders the PWA icons. Run with `npm run assets`.
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const SRC = 'design/style';
const OUT = 'public/content/img';

// id -> folder under public/content/img. Keep in sync with content.json.
const items = { cow: 'animals', duck: 'animals', car: 'sounds', apple: 'things' };
const scenes = { farm: 'scenes' };

// Item art has a plain pale background (STYLE.md). Flood-fill it away from the
// edges so subjects sit cleanly on any tile colour. Only pixels connected to the
// border and close to the corner colour are removed; a one-pixel feather band
// softens the edge. Pale areas inside the outline are untouched.
const KEY_CORE = 22;   // colour distance treated as background
const KEY_FEATHER = 44; // distance at which the feather band becomes opaque

async function keyBackground(src) {
  const { data, info } = await sharp(src).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const corners = [0, w - 1, (h - 1) * w, h * w - 1];
  const bg = [0, 1, 2].map((c) => corners.reduce((sum, p) => sum + data[p * 3 + c], 0) / corners.length);
  const dist = (p) => Math.hypot(data[p * 3] - bg[0], data[p * 3 + 1] - bg[1], data[p * 3 + 2] - bg[2]);

  const alpha = new Uint8Array(w * h).fill(255);
  const queue = new Int32Array(w * h);
  let head = 0, tail = 0;
  const visit = (p) => {
    if (alpha[p] === 0 || dist(p) > KEY_CORE) return;
    alpha[p] = 0;
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

for (const [id, dir] of Object.entries(items)) {
  await webp(`${SRC}/${id}.png`, `${OUT}/${dir}/${id}.webp`, 1024, 1024, 82, { key: true });
}
// Source scene is square; SPEC wants 2048x1536. Kept at native size until the
// 4:3 scene art is generated (M3).
for (const [id, dir] of Object.entries(scenes)) {
  await webp(`${SRC}/${id}.png`, `${OUT}/${dir}/${id}.webp`, 1024, 1024, 80);
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
