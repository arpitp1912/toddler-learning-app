// Round generation for "Who says that?". Pure: no DOM, no audio, so it can be unit tested.
import type { Item } from './content';

export interface Round {
  target: Item;
  /** Items in screen order, left to right. Includes the target. */
  choices: Item[];
  targetIndex: number;
}

type Rng = () => number;

/** Items the mode can use: marked guessable and with a sound to guess from. */
export const guessPool = (items: Item[]) => items.filter((i) => i.guessable && i.soundAudio);

/**
 * Confusable pairs as a lookup. `confusableWith` is read both ways, so a pair
 * needs listing on only one of its items (and may name items not added yet).
 */
export function confusables(items: Item[]): (a: Item, b: Item) => boolean {
  const pairs = new Set<string>();
  for (const i of items) for (const other of i.confusableWith ?? []) {
    pairs.add(`${i.id}|${other}`);
    pairs.add(`${other}|${i.id}`);
  }
  return (a, b) => pairs.has(`${a.id}|${b.id}`);
}

function shuffle<T>(list: T[], rng: Rng): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const MAX_SAME_SLOT = 2;

/**
 * Makes rounds from a pool of guessable items.
 * - Targets cycle through the whole pool before repeating, never twice in a row.
 * - Distractors prefer a different category from the target, and no two items
 *   on screen are ever confusable with each other.
 * - The target's position is random, never in the same slot more than twice in
 *   a row, and slot counts stay within two of each other.
 * `choices` is 2 or 3; a pool too small for that gives fewer (never under 2).
 */
export function roundMaker(pool: Item[], choices: number, rng: Rng = Math.random) {
  const isConfusable = confusables(pool);
  let bag: Item[] = [];
  let lastTarget: Item | null = null;
  const recentSlots: number[] = [];
  const slotCounts: number[] = [];

  const nextTarget = (): Item => {
    if (!bag.length) {
      bag = shuffle(pool, rng);
      // Across a refill, the next target must not be the one just played.
      if (bag.length > 1 && bag[bag.length - 1] === lastTarget) {
        [bag[0], bag[bag.length - 1]] = [bag[bag.length - 1], bag[0]];
      }
    }
    lastTarget = bag.pop()!;
    return lastTarget;
  };

  const pickDistractors = (target: Item, count: number): Item[] => {
    // Different category first, then the same category; random within each.
    const others = shuffle(pool.filter((i) => i !== target && !isConfusable(i, target)), rng);
    const ranked = [...others.filter((i) => i.category !== target.category), ...others.filter((i) => i.category === target.category)];
    const picked: Item[] = [];
    for (const i of ranked) {
      if (picked.length === count) break;
      if (picked.some((p) => isConfusable(p, i))) continue;
      picked.push(i);
    }
    return picked;
  };

  const pickSlot = (slots: number): number => {
    while (slotCounts.length < slots) slotCounts.push(0);
    const counts = slotCounts.slice(0, slots);
    const streak = recentSlots.length >= MAX_SAME_SLOT && recentSlots.slice(-MAX_SAME_SLOT).every((s) => s === recentSlots[recentSlots.length - 1])
      ? recentSlots[recentSlots.length - 1]
      : -1;
    // Slots no more than one ahead of the least-used slot, so counts never drift
    // more than two apart, yet the order stays unpredictable.
    const min = Math.min(...counts);
    let allowed = counts.map((_, s) => s).filter((s) => s !== streak && counts[s] <= min + 1);
    if (!allowed.length) allowed = counts.map((_, s) => s).filter((s) => s !== streak);
    const slot = allowed[Math.floor(rng() * allowed.length)];
    slotCounts[slot]++;
    recentSlots.push(slot);
    if (recentSlots.length > MAX_SAME_SLOT) recentSlots.shift();
    return slot;
  };

  return (): Round => {
    const target = nextTarget();
    const distractors = pickDistractors(target, Math.max(1, choices - 1));
    const slots = distractors.length + 1;
    const targetIndex = pickSlot(slots);
    const shown = shuffle(distractors, rng);
    shown.splice(targetIndex, 0, target);
    return { target, choices: shown, targetIndex };
  };
}
