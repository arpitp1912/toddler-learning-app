// Card actions. An item with an `action` in content.json does a motion instead
// of the bounce: the word plays, the motion starts, and the item's sound plays
// at `action.peakMs`. One requestAnimationFrame loop drives the sound, reading
// the CSS animation's own clock so the sound stays locked to the picture.
import { useEffect, useRef, useState } from 'preact/hooks';
import type { Item, Motion } from './content';
import { isCurrent, newSequence, playSound, playWord } from './audio';

// ---------- Tuning ----------
// Every number of every motion. Times are ms from the start of the motion.
// Moves and heights are fractions of the card size; tilts are degrees, positive
// leaning forward (the way the animal faces). Each motion's `peakMs` is when its
// sound plays unless the item's `action.peakMs` in content.json says otherwise.

/** Dog, cat, monkey: crouch, stretch up, peak, fall, landing squash. */
export const JUMP = {
  totalMs: 900,
  crouchMs: 200,   // end of the crouch, take-off
  peakMs: 450,     // top of the jump
  landMs: 750,     // feet back on the ground
  height: 0.25,    // rise
  crouch: { scaleX: 1.1, scaleY: 0.85, tiltDeg: -4 },  // tilt back while crouching
  stretch: { scaleX: 0.92, scaleY: 1.15, at: 0.5 },   // fullest stretch, `at` of the way up
  peakTiltDeg: 4,  // slight forward tilt at the top
  land: { scaleX: 1.08, scaleY: 0.9 },
  spring: { scaleX: 0.97, scaleY: 1.03, at: 0.5 },    // overshoot, `at` of the way through settling
  riseEase: 'cubic-bezier(.2, .7, .4, 1)',            // ease-out
  fallEase: 'cubic-bezier(.6, 0, .8, .3)',            // ease-in
};

/** Frog: the jump, deeper and higher. */
export const LEAP = {
  ...JUMP,
  totalMs: 1000,
  crouchMs: 250,
  peakMs: 520,
  landMs: 820,
  height: 0.4,
  crouch: { scaleX: 1.15, scaleY: 0.8, tiltDeg: 0 },
  stretch: { scaleX: 0.88, scaleY: 1.2, at: 0.4 },
  peakTiltDeg: 0,
};

/** Duck, pig: rock from foot to foot with little lifts. */
export const WADDLE = { totalMs: 900, peakMs: 450, steps: 4, tiltDeg: 9, lift: 0.04 };

/** Hen: two quick pecks forward. */
export const PECK = { totalMs: 900, peakMs: 300, pecks: 2, tiltDeg: 14, reach: 0.04, squash: 0.94 };

/** Crow, parrot: lift off, flutter, settle. */
export const FLAP = {
  totalMs: 1000,
  peakMs: 400,     // top of the lift
  crouchMs: 150,
  hoverMs: 750,    // starts coming down
  height: 0.15,
  flutterMs: 90,   // one wing beat
  flutter: { scaleX: 1.05, scaleY: 0.94, tiltDeg: 3 },
};

/** Horse: rear up on the back legs, then stomp down. */
export const REAR = {
  totalMs: 1000,
  peakMs: 450,     // fully reared
  downMs: 780,     // front feet land
  tiltDeg: -14,
  lift: 0.06,
  stomp: { scaleX: 1.08, scaleY: 0.9 },
};

/** Goat: lean back, then butt forward. */
export const HEADBUTT = { totalMs: 900, peakMs: 480, windupMs: 300, backDeg: -8, back: 0.04, lunge: 0.12, lungeDeg: 8 };

/** Cow, sheep: dip, then lift the head high for the moo or baa. */
export const NOD = { totalMs: 900, peakMs: 350, dipMs: 180, dipDeg: 6, upDeg: -4, stretch: { scaleX: 0.95, scaleY: 1.1 } };

/** Lion, elephant: lean back, then puff up big with a small shake. */
export const ROAR = { totalMs: 1000, peakMs: 400, windupMs: 250, backDeg: -5, puff: 1.15, shakeDeg: 2.5, shakes: 4 };

/** Fish: dart forward with a wagging tail, then drift back. */
export const SWIM = { totalMs: 1000, peakMs: 300, dart: 0.1, wagDeg: 6, wags: 8, bob: 0.02 };

/** Bee: a buzzing loop in the air. */
export const BUZZ = { totalMs: 1000, peakMs: 250, radius: 0.08, rise: 0.06, jitterDeg: 6, points: 12 };

// ---------- Keyframes ----------

/** Where the card is (x forward, y up). */
type MoveKey = { at: number; x?: number; y?: number; ease?: string };
/** How the picture is posed about its bottom centre. */
type PoseKey = { at: number; sx?: number; sy?: number; deg?: number; ease?: string };
type Preset = { totalMs: number; peakMs: number; air: [number, number]; move: MoveKey[]; pose: PoseKey[] };

const IN_OUT = 'cubic-bezier(.45, 0, .55, 1)';

function jumpPreset(J: typeof JUMP): Preset {
  const stretchMs = J.crouchMs + (J.peakMs - J.crouchMs) * J.stretch.at;
  const springMs = J.landMs + (J.totalMs - J.landMs) * J.spring.at;
  return {
    totalMs: J.totalMs,
    peakMs: J.peakMs,
    air: [J.crouchMs, J.landMs],
    move: [
      { at: 0 },
      { at: J.crouchMs, ease: J.riseEase },
      { at: J.peakMs, y: J.height, ease: J.fallEase },
      { at: J.landMs },
    ],
    pose: [
      { at: 0 },
      { at: J.crouchMs, sx: J.crouch.scaleX, sy: J.crouch.scaleY, deg: J.crouch.tiltDeg, ease: 'ease-out' },
      { at: stretchMs, sx: J.stretch.scaleX, sy: J.stretch.scaleY },
      { at: J.peakMs, deg: J.peakTiltDeg, ease: 'ease-in' },
      { at: J.landMs, sx: J.land.scaleX, sy: J.land.scaleY, ease: 'ease-out' },
      { at: springMs, sx: J.spring.scaleX, sy: J.spring.scaleY },
    ],
  };
}

/** `n` evenly spaced times between `from` and `to`, ends excluded. */
const beats = (from: number, to: number, n: number) => Array.from({ length: n }, (_, i) => from + ((to - from) * (i + 1)) / (n + 1));

function waddle(W = WADDLE): Preset {
  const step = W.totalMs / (W.steps + 1);
  const move: MoveKey[] = [{ at: 0 }];
  const pose: PoseKey[] = [{ at: 0 }];
  for (let i = 1; i <= W.steps; i++) {
    const side = i % 2 ? -1 : 1;
    const fade = i === W.steps ? 0.5 : 1;
    move.push({ at: step * i - step / 2, y: W.lift * fade }, { at: step * i });
    pose.push({ at: step * i, deg: side * W.tiltDeg * fade });
  }
  return { totalMs: W.totalMs, peakMs: W.peakMs, air: [0, W.totalMs], move, pose };
}

function peck(P = PECK): Preset {
  const slot = (P.totalMs * 0.8) / P.pecks;
  const move: MoveKey[] = [{ at: 0 }];
  const pose: PoseKey[] = [{ at: 0 }];
  for (let i = 0; i < P.pecks; i++) {
    const down = slot * i + slot / 2;
    move.push({ at: down, x: P.reach, ease: 'ease-out' }, { at: slot * (i + 1) });
    pose.push({ at: down, deg: P.tiltDeg, sy: P.squash, ease: 'ease-out' }, { at: slot * (i + 1) });
  }
  return { totalMs: P.totalMs, peakMs: P.peakMs, air: [0, P.totalMs * 0.8], move, pose };
}

function flap(F = FLAP): Preset {
  const pose: PoseKey[] = [{ at: 0 }, { at: F.crouchMs, sx: 1.06, sy: 0.92, ease: 'ease-out' }];
  for (let t = F.crouchMs + F.flutterMs, up = true; t < F.hoverMs + 100; t += F.flutterMs, up = !up) {
    pose.push(up
      ? { at: t, sx: 1 / F.flutter.scaleX, sy: 1 / F.flutter.scaleY, deg: F.flutter.tiltDeg }
      : { at: t, sx: F.flutter.scaleX, sy: F.flutter.scaleY, deg: -F.flutter.tiltDeg });
  }
  return {
    totalMs: F.totalMs,
    peakMs: F.peakMs,
    air: [F.crouchMs, F.totalMs - 100],
    move: [
      { at: 0 },
      { at: F.crouchMs, ease: 'cubic-bezier(.2, .7, .4, 1)' },
      { at: F.peakMs, y: F.height, ease: IN_OUT },
      { at: F.hoverMs, y: F.height * 0.8, ease: 'ease-in' },
      { at: F.totalMs - 100 },
    ],
    pose,
  };
}

function rear(R = REAR): Preset {
  return {
    totalMs: R.totalMs,
    peakMs: R.peakMs,
    air: [150, R.downMs],
    move: [{ at: 0 }, { at: 150 }, { at: R.peakMs, y: R.lift, ease: 'ease-in' }, { at: R.downMs }],
    pose: [
      { at: 0 },
      { at: 150, deg: 3, sx: 1.04, sy: 0.95, ease: 'ease-out' },
      { at: R.peakMs, deg: R.tiltDeg, sy: 1.05 },
      { at: R.peakMs + 150, deg: R.tiltDeg * 0.8, ease: 'ease-in' },
      { at: R.downMs, sx: R.stomp.scaleX, sy: R.stomp.scaleY, ease: 'ease-out' },
      { at: R.downMs + 100, sx: 0.98, sy: 1.02 },
    ],
  };
}

function headbutt(H = HEADBUTT): Preset {
  return {
    totalMs: H.totalMs,
    peakMs: H.peakMs,
    air: [H.windupMs, H.peakMs + 200],
    move: [
      { at: 0, ease: IN_OUT },
      { at: H.windupMs, x: -H.back, ease: 'ease-in' },
      { at: H.peakMs, x: H.lunge, ease: 'ease-out' },
      { at: H.peakMs + 220 },
    ],
    pose: [
      { at: 0, ease: IN_OUT },
      { at: H.windupMs, deg: H.backDeg, sx: 1.03, sy: 0.96, ease: 'ease-in' },
      { at: H.peakMs, deg: H.lungeDeg, sx: 1.06, sy: 0.95, ease: 'ease-out' },
      { at: H.peakMs + 220, deg: -2 },
      { at: H.peakMs + 320 },
    ],
  };
}

function nod(N = NOD): Preset {
  return {
    totalMs: N.totalMs,
    peakMs: N.peakMs,
    air: [N.dipMs, N.totalMs - 150],
    move: [{ at: 0 }],
    pose: [
      { at: 0, ease: IN_OUT },
      { at: N.dipMs, deg: N.dipDeg, sx: 1.05, sy: 0.93, ease: 'ease-out' },
      { at: N.peakMs, deg: N.upDeg, sx: N.stretch.scaleX, sy: N.stretch.scaleY, ease: IN_OUT },
      { at: N.peakMs + 300, deg: N.upDeg / 2, sx: (1 + N.stretch.scaleX) / 2, sy: (1 + N.stretch.scaleY) / 2, ease: IN_OUT },
    ],
  };
}

function roar(R = ROAR): Preset {
  const pose: PoseKey[] = [
    { at: 0, ease: IN_OUT },
    { at: R.windupMs, deg: R.backDeg, sx: 1.04, sy: 0.95, ease: 'ease-out' },
    { at: R.peakMs, deg: 3, sx: R.puff, sy: R.puff },
  ];
  beats(R.peakMs, R.peakMs + 350, R.shakes).forEach((t, i) =>
    pose.push({ at: t, deg: i % 2 ? R.shakeDeg : -R.shakeDeg, sx: R.puff * 0.98, sy: R.puff * 0.98 }));
  pose.push({ at: R.peakMs + 350, sx: R.puff * 0.97, sy: R.puff * 0.97, ease: IN_OUT });
  return { totalMs: R.totalMs, peakMs: R.peakMs, air: [R.windupMs, R.totalMs - 150], move: [{ at: 0 }], pose };
}

function swim(S = SWIM): Preset {
  const pose: PoseKey[] = [{ at: 0 }];
  beats(0, S.totalMs - 100, S.wags).forEach((t, i) => pose.push({ at: t, deg: i % 2 ? S.wagDeg : -S.wagDeg }));
  pose.push({ at: S.totalMs - 100 });
  return {
    totalMs: S.totalMs,
    peakMs: S.peakMs,
    air: [0, S.totalMs],
    move: [
      { at: 0, ease: 'cubic-bezier(.2, .7, .4, 1)' },
      { at: S.peakMs, x: S.dart, y: S.bob, ease: IN_OUT },
      { at: S.peakMs + 350, x: -S.dart * 0.4, y: -S.bob, ease: IN_OUT },
    ],
    pose,
  };
}

function buzz(B = BUZZ): Preset {
  const loopFrom = 150, loopTo = B.totalMs - 150;
  const move: MoveKey[] = [{ at: 0, ease: 'ease-out' }, { at: loopFrom, y: B.rise }];
  const pose: PoseKey[] = [{ at: 0 }];
  for (let i = 1; i <= B.points; i++) {
    const a = (2 * Math.PI * i) / B.points;
    const at = loopFrom + ((loopTo - loopFrom) * i) / B.points;
    move.push({ at, x: B.radius * Math.sin(a), y: B.rise + B.radius * (1 - Math.cos(a)) * 0.6, ease: 'linear' });
    pose.push({ at, deg: i % 2 ? B.jitterDeg : -B.jitterDeg });
  }
  move.push({ at: B.totalMs });
  pose.push({ at: B.totalMs });
  return { totalMs: B.totalMs, peakMs: B.peakMs, air: [loopFrom, loopTo], move, pose };
}

/** Builds each preset from its tuning object (read on first use, so tweaks above apply). */
const PRESETS: Record<Motion, () => Preset> = {
  jump: () => jumpPreset(JUMP),
  leap: () => jumpPreset(LEAP),
  waddle: () => waddle(),
  peck: () => peck(),
  flap: () => flap(),
  rear: () => rear(),
  headbutt: () => headbutt(),
  nod: () => nod(),
  roar: () => roar(),
  swim: () => swim(),
  buzz: () => buzz(),
};

const pct = (ms: number, total: number) => `${((Math.min(Math.max(ms, 0), total) / total) * 100).toFixed(2)}%`;
const n = (v: number) => +v.toFixed(4);

/** Fills in a rest frame at 0 and at the end if a preset leaves them out. */
function bookend<K extends { at: number }>(keys: K[], total: number): K[] {
  const out = [...keys];
  if (out[0]?.at !== 0) out.unshift({ at: 0 } as K);
  if (out[out.length - 1].at < total) out.push({ at: total } as K);
  return out;
}

function frames<K extends { at: number; ease?: string }>(keys: K[], total: number, value: (k: K) => string): string {
  return bookend(keys, total)
    .map((k) => `  ${pct(k.at, total)} { transform: ${value(k)}; animation-timing-function: ${k.ease ?? IN_OUT}; }`)
    .join('\n');
}

/**
 * One motion as CSS keyframes. The card moves (translate only); the picture
 * inside squashes, stretches and tilts about its bottom centre, so it moves
 * from the ground. `L` mirrors it for pictures that face left. A and B are
 * identical so a re-tap restarts the animation.
 */
function motionCss(motion: Motion, p: Preset, facing: 'R' | 'L', par: 'A' | 'B'): string {
  const d = facing === 'R' ? 1 : -1;
  const T = p.totalMs;
  const id = `act-${motion}-${facing}`;
  const move = (k: MoveKey) => `translate(${n(d * (k.x ?? 0) * 100)}%, ${n(-(k.y ?? 0) * 100)}%)`;
  const pose = (k: PoseKey) => `rotate(${n(d * (k.deg ?? 0))}deg) scale(${n(k.sx ?? 1)}, ${n(k.sy ?? 1)})`;
  const [a0, a1] = p.air;
  return `
@keyframes ${id}-move-${par} {
${frames(p.move, T, move)}
}
@keyframes ${id}-pose-${par} {
${frames(p.pose, T, pose)}
}
@keyframes ${id}-air-${par} {
  0%, ${pct(a0 - 1, T)} { opacity: 0; }
  ${pct(a0, T)}, ${pct(a1 - 1, T)} { opacity: 1; }
  ${pct(a1, T)}, 100% { opacity: 0; }
}
.${id}-${par} { animation: ${id}-move-${par} ${T}ms linear; }
.${id}-${par} .act-pose { animation: ${id}-pose-${par} ${T}ms linear; }
.${id}-${par} .art--action { animation: ${id}-air-${par} ${T}ms linear; }
@media (prefers-reduced-motion: reduce) {
  .${id}-${par} { animation-name: act-still-${par}; }
  .${id}-${par} .act-pose, .${id}-${par} .art--action { animation: none; }
}`;
}

const built: Partial<Record<Motion, Preset>> = {};
const preset = (m: Motion) => (built[m] ??= (PRESETS[m] ?? PRESETS.jump)());

let styled = false;
function ensureStyles() {
  if (styled || typeof document === 'undefined') return;
  styled = true;
  let css = '@keyframes act-still-A { from { opacity: 1; } to { opacity: 1; } }\n' +
    '@keyframes act-still-B { from { opacity: 1; } to { opacity: 1; } }\n';
  for (const m of Object.keys(PRESETS) as Motion[]) {
    for (const f of ['R', 'L'] as const) for (const par of ['A', 'B'] as const) css += motionCss(m, preset(m), f, par);
  }
  const el = document.createElement('style');
  el.dataset.actions = '';
  el.textContent = css;
  document.head.appendChild(el);
}

/**
 * The running CSS animation's clock, if the browser exposes it. Under reduced
 * motion the "still" animation runs instead, so the clock is the same.
 */
function animClock(el: Element | null): number | null {
  for (const a of el?.getAnimations?.() ?? []) {
    const name = (a as Animation & { animationName?: string }).animationName ?? '';
    if (/^act-(.+-move|still)-[AB]$/.test(name) && typeof a.currentTime === 'number') return a.currentTime;
  }
  return null;
}

/**
 * Plays an item's action: word, then motion, with the sound at peakMs.
 * `cls` goes on the subject button; `ref` must point at it.
 */
export function useCardAction() {
  const ref = useRef<HTMLButtonElement>(null);
  const [run, setRun] = useState<{ n: number; id: string } | null>(null); // null: resting
  const count = useRef(0);
  const frame = useRef(0);

  useEffect(() => {
    ensureStyles();
    return () => cancelAnimationFrame(frame.current);
  }, []);

  const play = async (item: Item) => {
    if (!item.action) return;
    cancelAnimationFrame(frame.current);
    const mine = newSequence(); // stops any word or sound still playing
    setRun(null);               // at rest while the word plays
    if (!(await playWord(item, mine))) return;

    const { motion, facing } = item.action;
    const p = preset(motion);
    count.current++;
    setRun({ n: count.current, id: `act-${PRESETS[motion] ? motion : 'jump'}-${facing === 'left' ? 'L' : 'R'}` });
    const soundAt = item.action.peakMs ?? p.peakMs;
    const t0 = performance.now();
    let sounded = false;
    const tick = () => {
      if (!isCurrent(mine)) return;
      const t = animClock(ref.current) ?? performance.now() - t0;
      if (!sounded && t >= soundAt) {
        sounded = true;
        void playSound(item, mine, 1);
      }
      if (!sounded || t < p.totalMs) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
  };

  const cls = run ? `${run.id}-${run.n % 2 ? 'A' : 'B'}` : '';
  return { ref, cls, play };
}
