import { expect, test, type Page } from '@playwright/test';
import { blips, openTile, spoken } from './helpers';

// The route in openTile serves content.json without the built-in voice; it
// only applies with the service worker blocked.
test.use({ serviceWorkers: 'block' });

const expectedCount = (page: Page) => {
  const vp = page.viewportSize()!;
  return Math.min(vp.width, vp.height) >= 600 ? 4 : 3;
};

interface Snap { id: string; word: string; x: number; y: number; w: number }

/** Every bubble's id, word, centre and hit-area size. */
const snapshot = (page: Page) =>
  page.locator('.bubble').evaluateAll((els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect();
      return { id: el.getAttribute('data-id')!, word: el.getAttribute('aria-label')!, x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width };
    }),
  );

/** A bubble whose centre is well inside the viewport. */
async function onScreenBubble(page: Page): Promise<Snap> {
  const vp = page.viewportSize()!;
  let pick: Snap | undefined;
  await expect
    .poll(async () => {
      pick = (await snapshot(page)).find((b) => b.y > b.w / 2 && b.y < vp.height - b.w / 2);
      return !!pick;
    })
    .toBe(true);
  return pick!;
}

test('bubbles: count, size, lanes, pop with audio, respawn', async ({ page }) => {
  const errors = await openTile(page, 'bubbles');
  const n = expectedCount(page);
  const vp = page.viewportSize()!;
  const short = Math.min(vp.width, vp.height);
  await expect(page.locator('.bubble')).toHaveCount(n);

  // Size and placement, sampled while they rise: hit area 15% over the
  // minimum diameter, never overlapping, never left of the home button.
  const home = (await page.locator('.home-btn').boundingBox())!;
  for (let i = 0; i < 6; i++) {
    const snap = await snapshot(page);
    for (const b of snap) {
      expect(b.w).toBeGreaterThanOrEqual(Math.max(160, 0.28 * short) * 1.15 - 1);
      expect(b.x - b.w / 2).toBeGreaterThanOrEqual(home.x + home.width - 1);
    }
    for (let a = 0; a < snap.length; a++)
      for (let b = a + 1; b < snap.length; b++)
        expect(Math.hypot(snap[a].x - snap[b].x, snap[a].y - snap[b].y)).toBeGreaterThanOrEqual(snap[a].w / 1.15);
    await page.waitForTimeout(250);
  }

  // Pointerdown pops: burst, synthesised blip, item stays and says its word.
  const target = await onScreenBubble(page);
  const before = await blips(page);
  await page.mouse.move(target.x, target.y);
  await page.mouse.down();
  await page.mouse.up();
  await expect(page.locator(`.bubble[data-id="${target.id}"]`)).toHaveCount(0);
  await expect(page.locator('.popped .burst-ring')).toHaveCount(1);
  await expect(page.locator('.popped-item')).toHaveCount(1);
  expect(await blips(page)).toBeGreaterThan(before);
  await expect.poll(() => spoken(page), { timeout: 10_000 }).toContain(target.word);

  // A new bubble with a new id comes back to keep the count.
  const maxId = Math.max(...(await snapshot(page)).map((b) => +b.id), +target.id);
  await expect(page.locator('.bubble')).toHaveCount(n, { timeout: 3_000 });
  expect(Math.max(...(await snapshot(page)).map((b) => +b.id))).toBeGreaterThan(maxId);

  // The popped item fades and is removed after about 1.8 s.
  await expect(page.locator('.popped')).toHaveCount(0, { timeout: 4_000 });

  // No two bubbles show the same item.
  const words = (await snapshot(page)).map((b) => b.word);
  expect(new Set(words).size).toBe(words.length);

  expect(errors).toEqual([]);
});

test('bubbles: two fingers pop two bubbles', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'multi-touch is driven through the Chromium DevTools protocol');
  const errors = await openTile(page, 'bubbles');
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });

  const vp = page.viewportSize()!;
  await expect
    .poll(async () => (await snapshot(page)).filter((b) => b.y > b.w / 2 && b.y < vp.height - b.w / 2).length, { timeout: 15_000 })
    .toBeGreaterThanOrEqual(2);
  const two = (await snapshot(page)).filter((b) => b.y > b.w / 2 && b.y < vp.height - b.w / 2).slice(0, 2);
  const touchPoints = two.map((b, i) => ({ x: b.x, y: b.y, id: i }));
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });

  for (const b of two) await expect(page.locator(`.bubble[data-id="${b.id}"]`)).toHaveCount(0);
  await expect(page.locator('.popped-item')).toHaveCount(2);
  expect(errors).toEqual([]);
});

test('bubbles: reduced motion sits still and refills the same spot', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const errors = await openTile(page, 'bubbles');
  const n = expectedCount(page);
  await expect(page.locator('.bubble')).toHaveCount(n);

  const first = await snapshot(page);
  await page.waitForTimeout(600);
  expect((await snapshot(page)).map(({ x, y }) => ({ x, y }))).toEqual(first.map(({ x, y }) => ({ x, y })));

  const target = first[0];
  await page.mouse.move(target.x, target.y);
  await page.mouse.down();
  await page.mouse.up();
  await expect(page.locator('.bubble')).toHaveCount(n - 1);
  await expect.poll(() => spoken(page), { timeout: 10_000 }).toContain(target.word);

  const refill = page.locator('.bubble--fade');
  await expect(refill).toHaveCount(1, { timeout: 4_000 });
  const box = (await refill.boundingBox())!;
  expect(Math.abs(box.x + box.width / 2 - target.x)).toBeLessThan(2);
  expect(Math.abs(box.y + box.height / 2 - target.y)).toBeLessThan(2);
  expect(errors).toEqual([]);
});

test('bubbles: no new bubbles once the last-minute warning starts', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' }); // still bubbles, so the count is stable
  // Seed the saved session with 50 s left of the default 15 min limit.
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Start' })).toBeVisible();
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('toddler-learning');
        open.onsuccess = () => {
          const tx = open.result.transaction('sessions', 'readwrite');
          tx.objectStore('sessions').put({ profileId: 'default', elapsedMs: 15 * 60_000 - 50_000, locked: false, updatedAt: Date.now() });
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        };
        open.onerror = () => reject(open.error);
      }),
  );
  const errors = await openTile(page, 'bubbles');
  await expect(page.locator('.sun')).toBeVisible(); // the warning is on
  const n = expectedCount(page);
  await expect(page.locator('.bubble')).toHaveCount(n);

  const target = (await snapshot(page))[0];
  await page.mouse.move(target.x, target.y);
  await page.mouse.down();
  await page.mouse.up();
  await expect(page.locator('.bubble')).toHaveCount(n - 1);
  await page.waitForTimeout(2_500); // past the refill time
  await expect(page.locator('.bubble')).toHaveCount(n - 1);
  expect(errors).toEqual([]);
});
