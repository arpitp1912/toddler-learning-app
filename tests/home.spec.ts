import { expect, test, type Page } from '@playwright/test';
import { serveContent, spoken, spyOnAudio } from './helpers';

// Home and Look. content.json is served with Guess forced on or off and without
// the built-in voice (the service worker is blocked so the route applies).
test.use({ serviceWorkers: 'block' });

async function open(page: Page, guess: boolean) {
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  await serveContent(page, (json) => { json.defaults = { ...json.defaults, guess }; });
  await spyOnAudio(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Start' }).click();
  return errors;
}

const tiles = (page: Page) => page.locator('.tile');
const ids = (page: Page) => tiles(page).evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
const boxes = (page: Page) => tiles(page).evaluateAll((els) => els.map((e) => e.getBoundingClientRect().toJSON() as DOMRect));

test('home: at most four activity tiles, and no category or Who-says tiles', async ({ page }) => {
  const errors = await open(page, true);
  await expect(tiles(page)).toHaveCount(4);
  expect(await ids(page)).toEqual(['look', 'peekaboo', 'bubbles', 'guess']);
  // Guess is off by default: three tiles.
  await serveContent(page, (json) => { json.defaults = { ...json.defaults, guess: false }; });
  await page.reload();
  await page.getByRole('button', { name: 'Start' }).click();
  await expect(tiles(page)).toHaveCount(3);
  expect(await ids(page)).toEqual(['look', 'peekaboo', 'bubbles']);
  expect(errors).toEqual([]);
});

test('look: category tiles laid out like Home, each opening its cards', async ({ page }) => {
  const errors = await open(page, true);
  const home = await boxes(page);
  await page.getByRole('button', { name: 'look', exact: true }).click();

  await expect(tiles(page)).toHaveCount(4);
  expect(await ids(page)).toEqual(['animals', 'sounds', 'food', 'things']);
  // Same tile size and the same 2 × 2 placement as Home with four tiles.
  const look = await boxes(page);
  for (const [i, b] of look.entries()) {
    expect(Math.abs(b.width - home[i].width)).toBeLessThan(1);
    expect(Math.abs(b.height - home[i].height)).toBeLessThan(1);
    expect(Math.abs(b.left - home[i].left)).toBeLessThan(1);
    expect(Math.abs(b.top - home[i].top)).toBeLessThan(1);
  }
  // The home button sits in its usual corner and never covers a tile.
  const btn = (await page.getByRole('button', { name: 'Home' }).boundingBox())!;
  expect(btn.x).toBeLessThan(40);
  expect(btn.y).toBeLessThan(40);
  for (const b of look) expect(btn.x + btn.width <= b.left || btn.y + btn.height <= b.top).toBe(true);

  // Animals → a card that speaks its word.
  await page.getByRole('button', { name: 'animals', exact: true }).click();
  await expect(page.locator('.screen.cards')).toBeVisible();
  const word = (await page.locator('.subject').getAttribute('aria-label'))!;
  await expect.poll(() => spoken(page)).toContain(word);
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.locator('.subject')).not.toHaveAttribute('aria-label', word);

  // Home goes all the way back to Home, not to Look.
  await page.getByRole('button', { name: 'Home' }).click();
  expect(await ids(page)).toEqual(['look', 'peekaboo', 'bubbles', 'guess']);

  // Vehicles opens the car.
  await page.getByRole('button', { name: 'look', exact: true }).click();
  await page.getByRole('button', { name: 'sounds', exact: true }).click();
  await expect(page.locator('.subject')).toHaveAttribute('aria-label', 'car');
  expect(errors).toEqual([]);
});
