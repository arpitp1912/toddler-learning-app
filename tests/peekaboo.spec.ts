import { expect, test, type Page } from '@playwright/test';

// Records what the app asks the speech synth and Web Audio to play.
async function spyOnAudio(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __spoken: string[]; __clips: number };
    w.__spoken = [];
    w.__clips = 0;
    if ('SpeechSynthesis' in window) {
      const speak = SpeechSynthesis.prototype.speak;
      SpeechSynthesis.prototype.speak = function (this: SpeechSynthesis, u: SpeechSynthesisUtterance) {
        if (u.text.trim()) w.__spoken.push(u.text);
        speak.call(this, u);
      };
    }
    const start = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (this: AudioBufferSourceNode, ...args: [number?, number?, number?]) {
      if (this.buffer && this.buffer.length > 1) w.__clips++;
      return start.apply(this, args);
    };
  });
}

const spoken = (page: Page) => page.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken);

async function openPeekaboo(page: Page) {
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  await spyOnAudio(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Start' }).click();
  await page.getByRole('button', { name: 'peekaboo' }).click();
  return errors;
}

/** Taps the centre of the cover twice in quick succession, like an eager toddler. */
async function doubleTapCover(page: Page) {
  const box = (await page.locator('.cover').boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.click(x, y);
  await page.waitForTimeout(120);
  await page.mouse.click(x, y);
}

test('cover reveals an item with audio, and the edge brings a new cover', async ({ page }) => {
  const errors = await openPeekaboo(page);

  const cover = page.locator('.cover');
  await expect(cover).toBeVisible();
  const box = (await cover.boundingBox())!;
  const vp = page.viewportSize()!;
  expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(0.6 * Math.min(vp.width, vp.height));

  await doubleTapCover(page);
  await expect(cover).toHaveCount(0);
  const subject = page.locator('.subject');
  const word = (await subject.getAttribute('aria-label'))!;
  expect(word).toBeTruthy();

  // "peekaboo", then the word, said once even though the cover was tapped twice.
  await expect.poll(() => spoken(page), { timeout: 10_000 }).toEqual(expect.arrayContaining(['peekaboo', word]));
  await page.waitForTimeout(500);
  expect((await spoken(page)).filter((t) => t === 'peekaboo')).toHaveLength(1);

  // Edge tap: the cover closes over a different item.
  await page.locator('.edge--next').click();
  await expect(cover).toBeVisible();
  await expect(cover).toHaveClass(/is-covered/);
  await expect(subject).not.toHaveAttribute('aria-label', word);

  // A swipe also brings a new cover, without revealing.
  const before = await subject.getAttribute('aria-label');
  await page.mouse.move(vp.width * 0.7, vp.height / 2);
  await page.mouse.down();
  await page.mouse.move(vp.width * 0.2, vp.height / 2, { steps: 5 });
  await page.mouse.up();
  await expect(subject).not.toHaveAttribute('aria-label', before!);
  await expect(cover).toHaveClass(/is-covered/);

  expect(errors).toEqual([]);
});

test('reduced motion still reveals the item', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const errors = await openPeekaboo(page);
  await page.locator('.cover').click();
  await expect(page.locator('.cover')).toHaveCount(0);
  await expect.poll(() => spoken(page), { timeout: 10_000 }).toContain('peekaboo');
  expect(errors).toEqual([]);
});
