import { expect, test, type Page } from '@playwright/test';
import { serveContent, spoken, spyOnAudio } from './helpers';

// Guess smoke tests: sound rounds ("Who says that?") and word rounds ("Find it").
// content.json is served with the mode's settings forced per test and without the built-in voice (the service worker is blocked
// so the route applies).
test.use({ serviceWorkers: 'block' });

const clips = (page: Page) => page.evaluate(() => (window as unknown as { __clips: number }).__clips);

async function open(page: Page, defaults: Record<string, unknown> = { guess: true, guessRounds: 'sound' }) {
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  await serveContent(page, (json) => { json.defaults = { ...json.defaults, ...defaults }; });
  await spyOnAudio(page);
  // Test browsers can't all decode AAC: every clip decodes to 0.1 s of silence,
  // so clip playback really starts and can be counted.
  await page.addInitScript(() => {
    AudioContext.prototype.decodeAudioData = function (this: AudioContext, _data: ArrayBuffer, ok?: DecodeSuccessCallback | null) {
      const buf = this.createBuffer(1, Math.round(this.sampleRate / 10), this.sampleRate);
      ok?.(buf);
      return Promise.resolve(buf);
    };
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Start' }).click();
  return errors;
}

const choices = (page: Page) => page.locator('.gs-choice');
const target = (page: Page) => page.locator('.gs-choice[data-target="true"]');
const distractor = (page: Page) => page.locator('.gs-choice:not([data-target])').first();

test('guess: tile stays hidden when the mode is turned off', async ({ page }) => {
  const errors = await open(page, { guess: false });
  await expect(page.getByRole('button', { name: 'bubbles' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'guess' })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('guess sound: loads two big choices and says "Listen!" then the sound', async ({ page }) => {
  const errors = await open(page);
  await page.getByRole('button', { name: 'guess' }).click();
  await expect(choices(page)).toHaveCount(2);
  await expect(target(page)).toHaveCount(1);
  await expect.poll(() => spoken(page)).toEqual(['Listen!']);
  await expect.poll(() => clips(page)).toBeGreaterThanOrEqual(1);

  const vp = page.viewportSize()!;
  const ipad = Math.min(vp.width, vp.height) >= 600;
  for (const w of await choices(page).evaluateAll((els) => els.map((e) => e.getBoundingClientRect().width))) {
    if (ipad) expect(w).toBeGreaterThanOrEqual(0.35 * vp.width - 1);
    else expect(w).toBeGreaterThanOrEqual(0.25 * Math.min(vp.width, vp.height));
  }
  // The choices never sit under the edge zones or the ear button.
  const boxes = await page.evaluate(() => {
    const r = (s: string) => [...document.querySelectorAll(s)].map((e) => e.getBoundingClientRect());
    return { choices: r('.gs-choice'), edges: r('.edge'), ear: r('.gs-replay')[0] };
  });
  const overlap = (a: DOMRect, b: DOMRect) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
  for (const c of boxes.choices) {
    for (const e of boxes.edges) expect(overlap(c, e)).toBe(false);
    expect(overlap(c, boxes.ear)).toBe(false);
  }
  expect(boxes.ear.width).toBeGreaterThanOrEqual(120);
  expect(errors).toEqual([]);
});

test('guess sound: the ear button replays the sound', async ({ page }) => {
  const errors = await open(page);
  await page.getByRole('button', { name: 'guess' }).click();
  await expect.poll(() => clips(page)).toBeGreaterThanOrEqual(2); // "Listen!" then the sound twice
  const before = await clips(page);
  await page.getByRole('button', { name: 'Listen again' }).click();
  await expect.poll(() => clips(page)).toBeGreaterThan(before);
  expect(await spoken(page)).toEqual(['Listen!']); // a replay is the sound only
  expect(errors).toEqual([]);
});

test('guess sound: a right tap names the item, sparkles and dims the others', async ({ page }) => {
  const errors = await open(page);
  await page.getByRole('button', { name: 'guess' }).click();
  const word = (await target(page).getAttribute('aria-label'))!;
  await target(page).click();
  await expect.poll(() => spoken(page)).toContain(word);
  await expect(page.locator('.gs-spark')).toHaveCount(8);
  await expect(distractor(page)).toHaveClass(/is-faded/);
  await expect.poll(() => distractor(page).evaluate((e) => getComputedStyle(e).opacity)).toBe('0.3');
  expect(errors).toEqual([]);
});

test('guess sound: a wrong tap names that item, then the target sound plays again', async ({ page }) => {
  const errors = await open(page);
  await page.getByRole('button', { name: 'guess' }).click();
  const wrong = (await distractor(page).getAttribute('aria-label'))!;
  await expect.poll(() => clips(page)).toBeGreaterThanOrEqual(2);
  const before = await clips(page);
  await distractor(page).click(); // taps during audio are accepted
  await expect.poll(() => spoken(page)).toContain(wrong);
  // Its own sound once, then the target's sound twice.
  await expect.poll(() => clips(page), { timeout: 10_000 }).toBeGreaterThanOrEqual(before + 3);
  await expect(distractor(page)).not.toHaveClass(/is-faded/);
  await expect(page.locator('.gs-spark')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('guess sound: an edge tap or a swipe gives a new round with a new target', async ({ page }) => {
  const errors = await open(page);
  await page.getByRole('button', { name: 'guess' }).click();
  await expect.poll(() => spoken(page)).toEqual(['Listen!']);
  let last = await target(page).getAttribute('aria-label');
  const listens = async () => (await spoken(page)).filter((t) => t === 'Listen!').length;
  for (const [i, how] of (['next', 'prev', 'swipe'] as const).entries()) {
    if (how === 'swipe') {
      const vp = page.viewportSize()!;
      await page.mouse.move(vp.width * 0.8, vp.height - 30);
      await page.mouse.down();
      await page.mouse.move(vp.width * 0.2, vp.height - 30, { steps: 5 });
      await page.mouse.up();
    } else {
      await page.locator(`.edge--${how}`).click();
    }
    await expect(target(page)).not.toHaveAttribute('aria-label', last!);
    last = await target(page).getAttribute('aria-label');
    // Each new round says "Listen!" again (no auto-advance in between).
    await expect.poll(listens).toBe(i + 2);
  }
  expect(errors).toEqual([]);
});

test('guess sound: three choices fit when the setting asks for them', async ({ page }) => {
  const errors = await open(page, { guess: true, guessRounds: 'sound', guessChoices: 3 });
  await page.getByRole('button', { name: 'guess' }).click();
  await expect(choices(page)).toHaveCount(3);
  const vp = page.viewportSize()!;
  const min = Math.min(vp.width, vp.height) >= 600 ? 160 : 0.25 * Math.min(vp.width, vp.height);
  const boxes = await page.evaluate(() => ({
    choices: [...document.querySelectorAll('.gs-choice')].map((e) => e.getBoundingClientRect().toJSON()),
    edges: [...document.querySelectorAll('.edge')].map((e) => e.getBoundingClientRect().toJSON()),
  }));
  for (const c of boxes.choices) {
    expect(c.width).toBeGreaterThanOrEqual(min);
    for (const e of boxes.edges) expect(c.left < e.right && e.left < c.right && c.top < e.bottom && e.top < c.bottom).toBe(false);
  }
  expect(errors).toEqual([]);
});

// Word rounds (Find it): "Where's the" then the target's word.

const WHERES = "Where's the";
const word = { guess: true, guessRounds: 'word' };

test('guess word: asks "Where\'s the …" with the replay speech bubble, and the ask repeats', async ({ page }) => {
  const errors = await open(page, word);
  await page.getByRole('button', { name: 'guess' }).click();
  await expect(page.locator('.screen.guess')).toHaveAttribute('data-kind', 'word');
  await expect(choices(page)).toHaveCount(2);
  const name = (await target(page).getAttribute('aria-label'))!;
  await expect.poll(() => spoken(page)).toEqual([WHERES, name]);
  // The replay button sits where the ear does, and asks again.
  const btn = page.getByRole('button', { name: 'Ask again' });
  const box = (await btn.boundingBox())!;
  expect(box.width).toBeGreaterThanOrEqual(120);
  expect(Math.abs(box.x + box.width / 2 - page.viewportSize()!.width / 2)).toBeLessThan(2);
  await btn.click();
  await expect.poll(() => spoken(page)).toEqual([WHERES, name, WHERES, name]);
  expect(errors).toEqual([]);
});

test('guess word: a right tap names the item with its sound, sparkles and fades the others', async ({ page }) => {
  const errors = await open(page, word);
  await page.getByRole('button', { name: 'guess' }).click();
  const name = (await target(page).getAttribute('aria-label'))!;
  await expect.poll(() => spoken(page)).toEqual([WHERES, name]);
  const before = await clips(page);
  await target(page).click();
  await expect.poll(() => spoken(page)).toEqual([WHERES, name, name]);
  await expect(page.locator('.gs-spark')).toHaveCount(8);
  await expect(distractor(page)).toHaveClass(/is-faded/);
  // Items with a sound play it after the word.
  const hasSound = await page.evaluate(async (w) => {
    const c = await (await fetch('/content/content.json')).json();
    return !!c.items.find((i: { word: string; soundAudio?: string }) => i.word === w)?.soundAudio;
  }, name);
  if (hasSound) await expect.poll(() => clips(page)).toBeGreaterThan(before);
  expect(errors).toEqual([]);
});

test('guess word: a wrong tap wiggles, names that item, then asks again', async ({ page }) => {
  const errors = await open(page, word);
  await page.getByRole('button', { name: 'guess' }).click();
  const name = (await target(page).getAttribute('aria-label'))!;
  const wrong = (await distractor(page).getAttribute('aria-label'))!;
  await expect.poll(() => spoken(page)).toEqual([WHERES, name]);
  await distractor(page).click();
  await expect(distractor(page).locator('.gs-art')).toHaveClass(/wiggle/);
  await expect.poll(() => spoken(page), { timeout: 10_000 }).toEqual([WHERES, name, wrong, WHERES, name]);
  await expect(distractor(page)).not.toHaveClass(/is-faded/);
  await expect(page.locator('.gs-spark')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('guess both: round types alternate, never three of a type in a row', async ({ page }) => {
  const errors = await open(page, { guess: true, guessRounds: 'both' });
  await page.getByRole('button', { name: 'guess' }).click();
  const kinds: string[] = [];
  const questions = async () => (await spoken(page)).filter((t) => t === 'Listen!' || t === WHERES).length;
  for (let i = 0; i < 8; i++) {
    const kind = (await page.locator('.screen.guess').getAttribute('data-kind'))!;
    kinds.push(kind);
    // Each round asks its own question once: "Listen!" or "Where's the".
    await expect.poll(questions).toBe(i + 1);
    expect((await spoken(page)).filter((t) => t === 'Listen!' || t === WHERES).at(-1)).toBe(kind === 'sound' ? 'Listen!' : WHERES);
    const last = await target(page).getAttribute('aria-label');
    await page.locator('.edge--next').click();
    await expect(target(page)).not.toHaveAttribute('aria-label', last!);
  }
  expect(new Set(kinds)).toEqual(new Set(['sound', 'word']));
  for (let i = 2; i < kinds.length; i++) expect(kinds[i] === kinds[i - 1] && kinds[i] === kinds[i - 2]).toBe(false);
  expect(errors).toEqual([]);
});
