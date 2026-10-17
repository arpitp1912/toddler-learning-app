import { expect, test, type Page } from '@playwright/test';
import { openTile } from './helpers';

// Card actions (src/actions.ts): the dog's jump in detail, then every animal.
// Each clip start is tagged with its URL and the action animation's own clock
// at that moment, so the sound can be checked against peakMs. The route in openTile only applies with the service
// worker blocked.
test.use({ serviceWorkers: 'block' });

const PEAK_MS = 450; // dog's action.peakMs in content.json
const TOTAL_MS = 900;

type Start = { url: string; clock: number | null; anim: string; speaking: boolean; transform: string; pose: string };
type Act = { starts: Start[]; maxLive: number };

async function spyOnClips(page: Page) {
  await page.addInitScript(() => {
    const act: Act = { starts: [], maxLive: 0 };
    (window as unknown as { __act: Act }).__act = act;
    // Remember which URL each decoded buffer came from.
    const fromUrl = new WeakMap<object, string>();
    const fetch0 = window.fetch;
    window.fetch = async (...args: Parameters<typeof fetch>) => {
      const res = await fetch0(...args);
      const url = typeof args[0] === 'string' ? args[0] : String((args[0] as Request).url ?? args[0]);
      const read = res.arrayBuffer.bind(res);
      res.arrayBuffer = async () => {
        const data = await read();
        fromUrl.set(data, url);
        return data;
      };
      return res;
    };
    const proto = (window.BaseAudioContext ?? window.AudioContext).prototype;
    const decode = proto.decodeAudioData;
    proto.decodeAudioData = function (this: BaseAudioContext, data: ArrayBuffer, ok?: DecodeSuccessCallback | null, fail?: DecodeErrorCallback | null) {
      const url = fromUrl.get(data) ?? '';
      const tag = (buf: AudioBuffer) => fromUrl.set(buf, url);
      const p = decode.call(this, data, (buf) => { tag(buf); ok?.(buf); }, fail);
      p?.then?.(tag, () => {});
      return p;
    } as typeof proto.decodeAudioData;

    const live = new Set<AudioBufferSourceNode>();
    const start = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (this: AudioBufferSourceNode, ...args: [number?, number?, number?]) {
      if (this.buffer && this.buffer.length > 1) {
        const subject = document.querySelector('.subject');
        let clock: number | null = null;
        let anim = '';
        for (const a of subject?.getAnimations?.() ?? []) {
          const name = (a as Animation & { animationName?: string }).animationName ?? '';
          if (/^act-(.+-move|still)-/.test(name)) { clock = a.currentTime as number; anim = name; }
        }
        const pose = document.querySelector('.act-pose');
        act.starts.push({
          url: fromUrl.get(this.buffer) ?? '',
          clock,
          anim,
          speaking: 'speechSynthesis' in window && speechSynthesis.speaking,
          transform: subject ? getComputedStyle(subject).transform : '',
          pose: pose ? getComputedStyle(pose).transform : '',
        });
        live.add(this);
        act.maxLive = Math.max(act.maxLive, live.size);
        this.addEventListener('ended', () => live.delete(this));
      }
      return start.apply(this, args);
    };
  });
}

const act = (page: Page) => page.evaluate(() => (window as unknown as { __act: Act }).__act);
const barks = async (page: Page) => (await act(page)).starts.filter((s) => s.url.includes('sounds/dog'));

/** Opens Animals and steps to the dog's card. */
async function openDog(page: Page) {
  await spyOnClips(page);
  const errors = await openTile(page, 'look');
  await page.getByRole('button', { name: 'animals', exact: true }).click();
  const subject = page.locator('.subject');
  while ((await subject.getAttribute('aria-label')) !== 'dog') {
    await page.getByRole('button', { name: 'Next' }).click();
  }
  return errors;
}

/** Taps the dog, then waits until the new jump's clock passes `ms`. Runs alternate A and B. */
async function tapAndWaitFor(page: Page, ms: number) {
  const subject = page.locator('.subject');
  const next = /act-jump-R-A/.test((await subject.getAttribute('class'))!) ? 'B' : 'A';
  await subject.click();
  await page.waitForFunction(([ms, next]) => {
    for (const a of document.querySelector('.subject')?.getAnimations?.() ?? []) {
      const name = (a as Animation & { animationName?: string }).animationName ?? '';
      if (name === `act-jump-R-move-${next}` && (a.currentTime as number) >= (ms as number)) return true;
    }
    return false;
  }, [ms, next] as const, { timeout: 10_000 });
}

test('dog: tap starts the jump and the bark lands on the peak', async ({ page }) => {
  const errors = await openDog(page);
  // Arrival plays the jump once.
  await expect.poll(async () => (await barks(page)).length, { timeout: 10_000 }).toBe(1);

  const before = (await barks(page)).length;
  await page.locator('.subject').click();
  await expect(page.locator('.subject')).toHaveClass(/act-jump-R-[AB]/);
  await expect.poll(async () => (await barks(page)).length, { timeout: 10_000 }).toBe(before + 1);

  for (const bark of await barks(page)) {
    expect(bark.anim).toMatch(/^act-jump-R-move-/);
    expect(Math.abs(bark.clock! - PEAK_MS)).toBeLessThanOrEqual(50);
    expect(bark.speaking).toBe(false);          // the word has finished
    expect(bark.transform).not.toBe('none');     // up in the air
  }
  // Settles back on the ground.
  await page.waitForTimeout(TOTAL_MS);
  expect(await page.locator('.subject').evaluate((el) => getComputedStyle(el).transform)).toMatch(/^(none|matrix\(1, 0, 0, 1, 0, 0\))$/);
  expect((await act(page)).maxLive).toBe(1);
  expect(errors).toEqual([]);
});

test('dog: a re-tap mid-jump restarts cleanly with no overlapping audio', async ({ page }) => {
  const errors = await openDog(page);
  await expect.poll(async () => (await barks(page)).length, { timeout: 10_000 }).toBe(1);

  // Re-tap during the bark (just after the peak), then before it (on the way up).
  await tapAndWaitFor(page, PEAK_MS + 60);
  await tapAndWaitFor(page, 250);
  const n = (await barks(page)).length;
  expect(n).toBe(2); // the re-tap before the peak cut that jump before its bark
  await page.locator('.subject').click();
  await expect.poll(async () => (await barks(page)).length, { timeout: 10_000 }).toBe(n + 1);

  for (const bark of await barks(page)) expect(Math.abs(bark.clock! - PEAK_MS)).toBeLessThanOrEqual(50);
  const { starts, maxLive } = await act(page);
  expect(maxLive).toBe(1);
  expect(starts.every((s) => !s.speaking)).toBe(true);
  expect(errors).toEqual([]);
});

test('dog, reduced motion: no movement, the bark still waits for peakMs', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const errors = await openDog(page);
  await expect.poll(async () => (await barks(page)).length, { timeout: 10_000 }).toBe(1);
  await page.locator('.subject').click();
  await expect.poll(async () => (await barks(page)).length, { timeout: 10_000 }).toBe(2);
  for (const bark of await barks(page)) {
    expect(bark.anim).toMatch(/^act-still-/);
    expect(Math.abs(bark.clock! - PEAK_MS)).toBeLessThanOrEqual(50);
    expect(bark.transform).toBe('none');
    expect(bark.pose).toBe('none');
  }
  expect(errors).toEqual([]);
});

test('every animal does its own action, with its sound on the peak', async ({ page }) => {
  test.setTimeout(240_000);
  await spyOnClips(page);
  const errors = await openTile(page, 'look');
  type Animal = { id: string; category: string; action?: { motion: string; peakMs: number; facing?: string } };
  const animals: Animal[] = await page.evaluate(async () =>
    ((await (await fetch('/content/content.json')).json()).items as Animal[]).filter((i) => i.category === 'animals'));
  expect(animals.length).toBeGreaterThan(1);
  await page.getByRole('button', { name: 'animals', exact: true }).click();
  const subject = page.locator('.subject');

  for (const [i, animal] of animals.entries()) {
    if (i) await page.getByRole('button', { name: 'Next' }).click();
    await expect(subject).toHaveAttribute('aria-label', animal.id);
    const { action } = animal;
    expect(action, `${animal.id} has an action`).toBeTruthy();
    const facing = action!.facing === 'left' ? 'L' : 'R';
    // Arrival plays the action; wait for its sound.
    await expect.poll(async () => (await act(page)).starts.filter((s) => s.url.includes(`sounds/${animal.id}.`)).length,
      { timeout: 10_000, message: animal.id }).toBe(1);
    const sound = (await act(page)).starts.find((s) => s.url.includes(`sounds/${animal.id}.`))!;
    expect(sound.anim, animal.id).toMatch(new RegExp(`^act-${action!.motion}-${facing}-move-`));
    expect(Math.abs(sound.clock! - action!.peakMs), animal.id).toBeLessThanOrEqual(50);
    expect(sound.speaking, animal.id).toBe(false);
    // Moving or posed at the peak.
    const still = /^(none|matrix\(1, 0, 0, 1, 0, 0\))$/;
    expect(still.test(sound.transform) && still.test(sound.pose), animal.id).toBe(false);
  }
  expect((await act(page)).maxLive).toBe(1);
  expect(errors).toEqual([]);
});

test('items without an action keep their bounce or wiggle', async ({ page }) => {
  const errors = await openTile(page, 'look');
  const subject = page.locator('.subject');
  for (const category of ['sounds', 'food', 'things']) {
    await page.getByRole('button', { name: category, exact: true }).click();
    await subject.click();
    await expect(subject).toHaveClass(/(bounce|wiggle)-[AB]/);
    await expect(subject).not.toHaveClass(/act-/);
    await expect(page.locator('.act-pose')).toHaveCount(0);
    await page.getByRole('button', { name: 'Home' }).click();
    await page.getByRole('button', { name: 'look', exact: true }).click();
  }
  expect(errors).toEqual([]);
});
