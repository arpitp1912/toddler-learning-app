// Card actions (prototype: the dog's jump). An item with an `action` in
// content.json does its motion instead of the bounce: the word plays, the
// motion starts, and the item's sound plays at `action.peakMs`. One
// requestAnimationFrame loop drives the sound, reading the CSS animation's own
// clock so the bark stays locked to the picture.
import { useEffect, useRef, useState } from 'preact/hooks';
import type { Item } from './content';
import { isCurrent, newSequence, playSound, playWord } from './audio';

/**
 * Every number in the jump. Times are ms from the start of the motion; the
 * height is a fraction of the card's height. The bark fires at the item's
 * `action.peakMs` in content.json, else at `peakMs` here.
 */
export const JUMP = {
  totalMs: 900,
  crouchMs: 200,   // end of the crouch, take-off
  peakMs: 450,     // top of the jump
  landMs: 750,     // feet back on the ground
  height: 0.25,    // rise, as a fraction of the card height
  crouch: { scaleX: 1.1, scaleY: 0.85, tiltDeg: -4 },  // tilt back while crouching
  stretch: { scaleX: 0.92, scaleY: 1.15, at: 0.5 },   // fullest stretch, `at` of the way up
  peakTiltDeg: 4,  // slight forward tilt at the top
  land: { scaleX: 1.08, scaleY: 0.9 },
  spring: { scaleX: 0.97, scaleY: 1.03, at: 0.5 },    // overshoot, `at` of the way through settling
  riseEase: 'cubic-bezier(.2, .7, .4, 1)',            // ease-out
  fallEase: 'cubic-bezier(.6, 0, .8, .3)',            // ease-in
};

const pct = (ms: number) => `${((ms / JUMP.totalMs) * 100).toFixed(2)}%`;
const pose = (sx: number, sy: number, deg = 0) => `transform: rotate(${deg}deg) scale(${sx}, ${sy});`;

/**
 * The jump as CSS keyframes, built from JUMP. The button rises and falls
 * (translate only); the picture inside it squashes, stretches and tilts about
 * its bottom centre, so it launches from the ground. A and B are identical so
 * a re-tap restarts the animation.
 */
function jumpCss(): string {
  const J = JUMP;
  const stretchMs = J.crouchMs + (J.peakMs - J.crouchMs) * J.stretch.at;
  const springMs = J.landMs + (J.totalMs - J.landMs) * J.spring.at;
  const lift = `${(-J.height * 100).toFixed(1)}%`;
  const ease = 'cubic-bezier(.45, 0, .55, 1)';
  return (['A', 'B'] as const)
    .map((p) => `
@keyframes jump-rise-${p} {
  0%, ${pct(J.crouchMs)} { transform: translateY(0); animation-timing-function: ${J.riseEase}; }
  ${pct(J.peakMs)} { transform: translateY(${lift}); animation-timing-function: ${J.fallEase}; }
  ${pct(J.landMs)}, 100% { transform: translateY(0); }
}
@keyframes jump-pose-${p} {
  0% { transform: none; animation-timing-function: ${ease}; }
  ${pct(J.crouchMs)} { ${pose(J.crouch.scaleX, J.crouch.scaleY, J.crouch.tiltDeg)} animation-timing-function: ease-out; }
  ${pct(stretchMs)} { ${pose(J.stretch.scaleX, J.stretch.scaleY)} animation-timing-function: ${ease}; }
  ${pct(J.peakMs)} { ${pose(1, 1, J.peakTiltDeg)} animation-timing-function: ease-in; }
  ${pct(J.landMs)} { ${pose(J.land.scaleX, J.land.scaleY)} animation-timing-function: ease-out; }
  ${pct(springMs)} { ${pose(J.spring.scaleX, J.spring.scaleY)} animation-timing-function: ${ease}; }
  100% { transform: none; }
}
@keyframes jump-air-${p} {
  0%, ${pct(J.crouchMs - 1)} { opacity: 0; }
  ${pct(J.crouchMs)}, ${pct(J.landMs - 1)} { opacity: 1; }
  ${pct(J.landMs)}, 100% { opacity: 0; }
}
@keyframes jump-still-${p} { from { opacity: 1; } to { opacity: 1; } }
.act-jump-${p} { animation: jump-rise-${p} ${J.totalMs}ms linear; }
.act-jump-${p} .act-pose { animation: jump-pose-${p} ${J.totalMs}ms linear; }
.act-jump-${p} .art--action { animation: jump-air-${p} ${J.totalMs}ms linear; }
@media (prefers-reduced-motion: reduce) {
  .act-jump-${p} { animation-name: jump-still-${p}; }
  .act-jump-${p} .act-pose, .act-jump-${p} .art--action { animation: none; }
}`)
    .join('\n');
}

let styled = false;
function ensureStyles() {
  if (styled || typeof document === 'undefined') return;
  styled = true;
  const el = document.createElement('style');
  el.dataset.actions = '';
  el.textContent = jumpCss();
  document.head.appendChild(el);
}

/**
 * The running CSS animation's clock, if the browser exposes it. Under reduced
 * motion the "still" animation runs instead, so the clock is the same.
 */
function animClock(el: Element | null): number | null {
  const anims = el?.getAnimations?.() ?? [];
  for (const a of anims) {
    const name = (a as Animation & { animationName?: string }).animationName ?? '';
    if (/^jump-(rise|still)-/.test(name) && typeof a.currentTime === 'number') return a.currentTime;
  }
  return null;
}

/**
 * Plays an item's action: word, then motion, with the sound at peakMs.
 * `cls` goes on the subject button; `ref` must point at it.
 */
export function useCardAction() {
  const ref = useRef<HTMLButtonElement>(null);
  const [run, setRun] = useState(0); // 0: resting; otherwise its parity picks A or B
  const count = useRef(0);
  const frame = useRef(0);

  useEffect(() => {
    ensureStyles();
    return () => cancelAnimationFrame(frame.current);
  }, []);

  const play = async (item: Item) => {
    cancelAnimationFrame(frame.current);
    const mine = newSequence(); // stops any word or bark still playing
    setRun(0);                  // back on the ground while the word plays
    if (!(await playWord(item, mine))) return;

    count.current++;
    setRun(count.current);
    const barkAt = item.action?.peakMs ?? JUMP.peakMs;
    const t0 = performance.now();
    let barked = false;
    const tick = () => {
      if (!isCurrent(mine)) return;
      const t = animClock(ref.current) ?? performance.now() - t0;
      if (!barked && t >= barkAt) {
        barked = true;
        void playSound(item, mine, 1);
      }
      if (!barked || t < JUMP.totalMs) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
  };

  const cls = run ? `act-jump-${run % 2 ? 'A' : 'B'}` : '';
  return { ref, cls, play };
}
