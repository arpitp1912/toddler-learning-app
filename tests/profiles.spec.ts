import { expect, test, type Page } from '@playwright/test';
import { openParent } from './helpers';

// M2: profiles, switching, toddler picker, PIN, export and import.
test.use({ hasTouch: true });

// A 2×1 PNG, so the photo path (decode, crop, JPEG) runs for real.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAYAAAD0In+KAAAAEUlEQVR4nGP4z8DwHwQZGBgAUwgH+TnOBq0AAAAASUVORK5CYII=',
  'base64',
);

let errors: string[] = [];
test.beforeEach(async ({ page }) => {
  errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  // No share sheet in desktop test browsers: exports fall back to a download.
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'canShare', { value: undefined });
  });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Start' })).toBeVisible();
});
test.afterEach(() => expect(errors).toEqual([]));

const row = (page: Page, name: string) => page.locator('.profile-row').filter({ hasText: name });

/** From the parent home: adds a profile with a 5-minute limit and the Bubbles tile off. */
async function addBea(page: Page, photo = false) {
  await page.getByRole('button', { name: 'Add a profile' }).click();
  await page.getByPlaceholder('For example, Mia').fill('Bea');
  if (photo) await page.locator('input[type="file"][accept="image/*"]').setInputFiles({ name: 'bea.png', mimeType: 'image/png', buffer: PNG });
  await page.getByRole('button', { name: '24–30 months' }).click();
  await page.getByRole('button', { name: '5 min', exact: true }).click();
  await page.getByRole('switch', { name: 'Bubbles' }).click();
  await page.getByRole('button', { name: 'Add profile' }).click();
  await expect(row(page, 'Bea')).toBeVisible();
}

async function play(page: Page) {
  await page.getByRole('button', { name: 'Back to play' }).click();
  await page.getByRole('button', { name: 'Start' }).click();
}

test('two profiles keep separate settings, and launch opens the last used', async ({ page }) => {
  await openParent(page);
  await addBea(page);
  await expect(row(page, 'Child')).toContainText('Playing now');

  await row(page, 'Bea').getByRole('button', { name: 'Switch to Bea' }).click();
  await expect(row(page, 'Bea')).toContainText('Playing now');
  await expect(page.getByText('Bea: 0 of 5 minutes')).toBeVisible();
  await play(page);
  await expect(page.getByRole('button', { name: 'peekaboo' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'bubbles' })).toHaveCount(0);

  // Reload: still Bea, with no picker.
  await page.reload();
  await page.getByRole('button', { name: 'Start' }).click();
  await expect(page.getByRole('button', { name: 'bubbles' })).toHaveCount(0);

  await openParent(page);
  await row(page, 'Child').getByRole('button', { name: 'Switch to Child' }).click();
  await expect(page.getByText('Child: 0 of 15 minutes')).toBeVisible();
  await play(page);
  await expect(page.getByRole('button', { name: 'bubbles' })).toBeVisible();
});

test('each profile has its own lock', async ({ page }) => {
  await openParent(page);
  await addBea(page);
  await page.getByRole('button', { name: 'End session now' }).click();
  await expect(page.locator('.lock')).toBeVisible({ timeout: 10_000 });

  await openParent(page);
  await row(page, 'Bea').getByRole('button', { name: 'Switch to Bea' }).click();
  await page.getByRole('button', { name: 'Back to play' }).click();
  await expect(page.getByRole('button', { name: 'Start' })).toBeVisible();

  await openParent(page);
  await row(page, 'Child').getByRole('button', { name: 'Switch to Child' }).click();
  await expect(page.getByText('Play time is over for Child')).toBeVisible();
});

test('toddler picker shows big faces and opens the chosen profile', async ({ page }) => {
  await openParent(page);
  await addBea(page);
  await page.getByRole('switch', { name: 'Profile picker for children' }).click();
  await page.getByRole('button', { name: 'Back to play' }).click();
  await page.getByRole('button', { name: 'Start' }).click();

  const faces = page.locator('.picker-face');
  await expect(faces).toHaveCount(2);
  const vp = page.viewportSize()!;
  const min = Math.min(vp.width, vp.height) >= 600 ? 160 : 0.25 * Math.min(vp.width, vp.height);
  for (const box of await faces.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().width))) {
    expect(box).toBeGreaterThanOrEqual(min);
  }
  await page.getByRole('button', { name: 'Bea' }).click();
  await expect(page.getByRole('button', { name: 'peekaboo' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'bubbles' })).toHaveCount(0);

  // Next launch: the picker again, and Child brings the Bubbles tile back.
  await page.reload();
  await page.getByRole('button', { name: 'Start' }).click();
  await page.getByRole('button', { name: 'Child' }).click();
  await expect(page.getByRole('button', { name: 'bubbles' })).toBeVisible();
});

test('a PIN replaces the number check and can be recovered', async ({ page }) => {
  await openParent(page);
  await page.getByRole('button', { name: 'Set a PIN' }).click();
  for (const d of '2468') await page.getByRole('button', { name: d, exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Enter it again' })).toBeVisible();
  for (const d of '2468') await page.getByRole('button', { name: d, exact: true }).click();
  await expect(page.getByText('PIN set.')).toBeVisible();
  await page.getByRole('button', { name: 'Back to play' }).click();

  // Wrong PIN, then right.
  await page.locator('.gate-corner').evaluate((el) => {
    const e = new Event('touchstart', { bubbles: true, cancelable: true });
    Object.defineProperty(e, 'targetTouches', { value: { length: 2 } });
    el.dispatchEvent(e);
  });
  await expect(page.getByRole('heading', { name: 'Enter your PIN' })).toBeVisible({ timeout: 5_000 });
  for (const d of '1111') await page.getByRole('button', { name: d, exact: true }).click();
  await expect(page.getByText("That PIN isn't right")).toBeVisible();
  for (const d of '2468') await page.getByRole('button', { name: d, exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Parent area' })).toBeVisible();
  await page.getByRole('button', { name: 'Back to play' }).click();

  // Forgot PIN: answer the sum, the PIN is removed and the parent area opens.
  await page.locator('.gate-corner').evaluate((el) => {
    const e = new Event('touchstart', { bubbles: true, cancelable: true });
    Object.defineProperty(e, 'targetTouches', { value: { length: 2 } });
    el.dispatchEvent(e);
  });
  await page.getByRole('button', { name: 'Forgot PIN?' }).click({ timeout: 5_000 });
  const [, a, b] = (await page.locator('#check-title').textContent())!.match(/(\d+) \+ (\d+)/)!;
  for (const d of String(Number(a) + Number(b))) await page.getByRole('button', { name: d, exact: true }).click();
  await page.getByRole('button', { name: 'Remove PIN' }).click();
  await expect(page.getByRole('heading', { name: 'Parent area' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Set a PIN' })).toBeVisible();
});

test('export and import a profile with its photo', async ({ page }) => {
  await openParent(page);
  await addBea(page, true);
  await expect(row(page, 'Bea').locator('.avatar-photo')).toBeVisible();

  await row(page, 'Bea').getByRole('button', { name: 'Export' }).click();
  const download = page.waitForEvent('download');
  await row(page, 'Bea').getByRole('button', { name: 'Share file' }).click();
  const file = await (await download).path();
  expect((await download).suggestedFilename()).toBe('Bea profile.zip');

  // Delete Bea, then bring her back from the file.
  await row(page, 'Bea').getByRole('button', { name: 'Edit' }).click();
  await page.getByRole('button', { name: 'Delete this profile' }).click();
  await page.getByRole('button', { name: 'Delete Bea' }).click();
  await expect(row(page, 'Bea')).toHaveCount(0);

  const importInput = page.locator('input[type="file"][accept=".zip,application/zip"]');
  await importInput.setInputFiles(file);
  await expect(page.getByText('Imported Bea.')).toBeVisible();
  await expect(row(page, 'Bea')).toContainText('24–30 months · 5 min');
  await expect(row(page, 'Bea').locator('.avatar-photo')).toBeVisible();

  // Importing again finds the same profile: keep both makes a copy.
  await importInput.setInputFiles(file);
  await page.getByRole('button', { name: 'Keep both' }).click();
  await expect(row(page, 'Bea')).toHaveCount(2);

  // A file that isn't a backup is refused with a readable message.
  await importInput.setInputFiles({ name: 'notes.zip', mimeType: 'application/zip', buffer: Buffer.from('hello') });
  await expect(page.getByText('This file is not a profile backup')).toBeVisible();
  errors = errors.filter((e) => !e.includes('[import]'));
});

test('the editor turns "Who says that?" off and sets three pictures', async ({ page }) => {
  await openParent(page);
  await row(page, 'Child').getByRole('button', { name: 'Edit' }).click();
  await page.getByRole('button', { name: '3 to choose from' }).click();
  await page.getByRole('button', { name: 'Save' }).click();
  await play(page);
  await page.getByRole('button', { name: 'who says that' }).click();
  await expect(page.locator('.ws-choice')).toHaveCount(3);
  await page.getByRole('button', { name: 'Home' }).click();

  await openParent(page);
  await row(page, 'Child').getByRole('button', { name: 'Edit' }).click();
  await page.getByRole('switch', { name: 'Who says that?' }).click();
  await expect(page.getByRole('button', { name: '3 to choose from' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Save' }).click();
  await page.getByRole('button', { name: 'Back to play' }).click();
  await expect(page.getByRole('button', { name: 'bubbles' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'who says that' })).toHaveCount(0);
});
