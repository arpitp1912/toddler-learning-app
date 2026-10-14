import type { Page } from '@playwright/test';

type Spy = { __spoken: string[]; __clips: number; __blips: number };

/** Records what the app asks the speech synth and Web Audio to play. */
export async function spyOnAudio(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as Spy;
    w.__spoken = [];
    w.__clips = 0;
    w.__blips = 0;
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
    const oscStart = OscillatorNode.prototype.start;
    OscillatorNode.prototype.start = function (this: OscillatorNode, when?: number) {
      w.__blips++;
      return oscStart.call(this, when);
    };
  });
}

export const spoken = (page: Page) => page.evaluate(() => (window as unknown as Spy).__spoken);
export const blips = (page: Page) => page.evaluate(() => (window as unknown as Spy).__blips);

/** Loads the app, presses play and opens a home tile. Returns collected console errors. */
export async function openTile(page: Page, tile: string) {
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  await spyOnAudio(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Start' }).click();
  await page.getByRole('button', { name: tile, exact: true }).click();
  return errors;
}
