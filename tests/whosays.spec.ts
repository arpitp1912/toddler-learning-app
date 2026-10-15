import { expect, test, type Page } from '@playwright/test';
import { spoken, spyOnAudio } from './helpers';

// "Who says that?" smoke tests. content.json is served with the mode's settings
// forced per test (the service worker is blocked so the route applies).
test.use({ serviceWorkers: 'block' });

const clips = (page: Page) => page.evaluate(() => (window as unknown as { __clips: number }).__clips);

async function open(page: Page, defaults: Record<string, unknown> = { whoSays: true }) {
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.route('**/content/content.json', async (route) => {
    const json = await (await route.fetch()).json();
    json.defaults = { ...json.defaults, ...defaults };
    await route.fulfill({ json });
  });
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

const choices = (page: Page) => page.locator('.ws-choice');
const target = (page: Page) => page.locator('.ws-choice[data-target="true"]');
const distractor = (page: Page) => page.locator('.ws-choice:not([data-target])').first();

test('who says: tile stays hidden when the mode is turned off', async ({ page }) => {
  const errors = await open(page, { whoSays: false });
  await expect(page.getByRole('button', { name: 'bubbles' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'who says that' })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('who says: loads two big choices and says "Listen!" then the sound', async ({ page }) => {
  const errors = await open(page);
  await page.getByRole('button', { name: 'who says that' }).click();
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
    return { choices: r('.ws-choice'), edges: r('.edge'), ear: r('.ws-ear')[0] };
  });
  const overlap = (a: DOMRect, b: DOMRect) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
  for (const c of boxes.choices) {
    for (const e of boxes.edges) expect(overlap(c, e)).toBe(false);
    expect(overlap(c, boxes.ear)).toBe(false);
  }
  expect(boxes.ear.width).toBeGreaterThanOrEqual(120);
  expect(errors).toEqual([]);
});

test('who says: the ear button replays the sound', async ({ page }) => {
  const errors = await open(page);
  await page.getByRole('button', { name: 'who says that' }).click();
  await expect.poll(() => clips(page)).toBeGreaterThanOrEqual(2); // "Listen!" then the sound twice
  const before = await clips(page);
  await page.getByRole('button', { name: 'Listen again' }).click();
  await expect.poll(() => clips(page)).toBeGreaterThan(before);
  expect(await spoken(page)).toEqual(['Listen!']); // a replay is the sound only
  expect(errors).toEqual([]);
});

test('who says: a right tap names the item, sparkles and dims the others', async ({ page }) => {
  const errors = await open(page);
  await page.getByRole('button', { name: 'who says that' }).click();
  const word = (await target(page).getAttribute('aria-label'))!;
  await target(page).click();
  await expect.poll(() => spoken(page)).toContain(word);
  await expect(page.locator('.ws-spark')).toHaveCount(8);
  await expect(distractor(page)).toHaveClass(/is-faded/);
  await expect.poll(() => distractor(page).evaluate((e) => getComputedStyle(e).opacity)).toBe('0.3');
  expect(errors).toEqual([]);
});

test('who says: a wrong tap names that item, then the target sound plays again', async ({ page }) => {
  const errors = await open(page);
  await page.getByRole('button', { name: 'who says that' }).click();
  const wrong = (await distractor(page).getAttribute('aria-label'))!;
  await expect.poll(() => clips(page)).toBeGreaterThanOrEqual(2);
  const before = await clips(page);
  await distractor(page).click(); // taps during audio are accepted
  await expect.poll(() => spoken(page)).toContain(wrong);
  // Its own sound once, then the target's sound twice.
  await expect.poll(() => clips(page), { timeout: 10_000 }).toBeGreaterThanOrEqual(before + 3);
  await expect(distractor(page)).not.toHaveClass(/is-faded/);
  await expect(page.locator('.ws-spark')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('who says: an edge tap or a swipe gives a new round with a new target', async ({ page }) => {
  const errors = await open(page);
  await page.getByRole('button', { name: 'who says that' }).click();
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

test('who says: three choices fit when the setting asks for them', async ({ page }) => {
  const errors = await open(page, { whoSays: true, whoSaysChoices: 3 });
  await page.getByRole('button', { name: 'who says that' }).click();
  await expect(choices(page)).toHaveCount(3);
  const vp = page.viewportSize()!;
  const min = Math.min(vp.width, vp.height) >= 600 ? 160 : 0.25 * Math.min(vp.width, vp.height);
  const boxes = await page.evaluate(() => ({
    choices: [...document.querySelectorAll('.ws-choice')].map((e) => e.getBoundingClientRect().toJSON()),
    edges: [...document.querySelectorAll('.edge')].map((e) => e.getBoundingClientRect().toJSON()),
  }));
  for (const c of boxes.choices) {
    expect(c.width).toBeGreaterThanOrEqual(min);
    for (const e of boxes.edges) expect(c.left < e.right && e.left < c.right && c.top < e.bottom && e.top < c.bottom).toBe(false);
  }
  expect(errors).toEqual([]);
});
