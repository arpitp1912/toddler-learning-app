import { expect, test, type Page } from '@playwright/test';
import { openTile, spoken } from './helpers';

const openPeekaboo = (page: Page) => openTile(page, 'peekaboo');

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
  // "peekaboo" as the cover appears, before any tap.
  await expect.poll(() => spoken(page), { timeout: 10_000 }).toEqual(['peekaboo']);
  const box = (await cover.boundingBox())!;
  const vp = page.viewportSize()!;
  expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(0.6 * Math.min(vp.width, vp.height));

  await doubleTapCover(page);
  await expect(cover).toHaveCount(0);
  const subject = page.locator('.subject');
  const word = (await subject.getAttribute('aria-label'))!;
  expect(word).toBeTruthy();

  // The word, said once even though the cover was tapped twice.
  await expect.poll(() => spoken(page), { timeout: 10_000 }).toEqual(['peekaboo', word]);
  await page.waitForTimeout(500);
  expect(await spoken(page)).toEqual(['peekaboo', word]);

  // Edge tap: the cover closes over a different item.
  await page.locator('.edge--next').click();
  await expect(cover).toBeVisible();
  await expect(cover).toHaveClass(/is-covered/);
  await expect(subject).not.toHaveAttribute('aria-label', word);
  await expect.poll(async () => (await spoken(page)).filter((t) => t === 'peekaboo').length).toBe(2);

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
  await expect.poll(() => spoken(page), { timeout: 10_000 }).toContain('peekaboo');
  await page.locator('.cover').click();
  await expect(page.locator('.cover')).toHaveCount(0);
  const word = (await page.locator('.subject').getAttribute('aria-label'))!;
  await expect.poll(() => spoken(page), { timeout: 10_000 }).toContain(word);
  expect(errors).toEqual([]);
});
