// Round generation for Guess. Pure: no DOM, no audio, so it can be unit tested.
// Two round types share one engine:
// - sound ("Who says that?"): a sound plays, the child taps who makes it;
// - word ("Find it"): "Where's the cow?", the child taps the cow.
import type { GuessRounds, Item } from './content';

export type RoundKind = 'sound' | 'word';

export interface Round {
  kind: RoundKind;
  target: Item;
  /** Items in screen order, left to right. Includes the target. */
  choices: Item[];
  targetIndex: number;
}

type Rng = () => number;
type Clash = (a: Item, b: Item) => boolean;

/** Items sound rounds can use: marked guessable and with a sound to guess from. */
export const soundPool = (items: Item[]) => items.filter((i) => i.guessable && i.soundAudio);

/** Items word rounds can use: any item. */
export const wordPool = (items: Item[]) => items;

/** A pair list (`confusableWith`, `lookalikeWith`) as a lookup, read both ways. */
function pairs(items: Item[], field: 'confusableWith' | 'lookalikeWith'): Clash {
  const set = new Set<string>();
  for (const i of items) for (const other of i[field] ?? []) {
    set.add(`${i.id}|${other}`);
    set.add(`${other}|${i.id}`);
  }
  return (a, b) => set.has(`${a.id}|${b.id}`);
}

/** Items whose sounds are too alike to share a sound round. */
export const confusables = (items: Item[]) => pairs(items, 'confusableWith');
/** Items that look too alike to share a word round. */
export const lookalikes = (items: Item[]) => pairs(items, 'lookalikeWith');

function shuffle<T>(list: T[], rng: Rng): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Round types that can play: those the setting asks for with at least two usable items. */
export function usableKinds(rounds: GuessRounds, sound: Item[], word: Item[]): RoundKind[] {
  const wanted: RoundKind[] = rounds === 'both' ? ['sound', 'word'] : [rounds];
  return wanted.filter((k) => (k === 'sound' ? sound : word).length >= 2);
}

const MAX_SAME_KIND = 2;

/** Picks round types at random, never more than two of the same type in a row. */
export function kindPicker(kinds: RoundKind[], rng: Rng = Math.random) {
  const recent: RoundKind[] = [];
  return (): RoundKind => {
    const streak = recent.length === MAX_SAME_KIND && recent[0] === recent[1] ? recent[0] : null;
    const allowed = kinds.length > 1 ? kinds.filter((k) => k !== streak) : kinds;
    const kind = allowed[Math.floor(rng() * allowed.length)];
    recent.push(kind);
    if (recent.length > MAX_SAME_KIND) recent.shift();
    return kind;
  };
}

const MAX_SAME_SLOT = 2;

export interface EngineOptions {
  sound: Item[];
  word: Item[];
  /** Round types to play; see `usableKinds`. */
  kinds: RoundKind[];
  /** 2 or 3; a pool too small for that gives fewer (never under 2). */
  choices: number;
  rng?: Rng;
}

/**
 * Makes Guess rounds.
 * - Round types alternate at random, no more than two of a type in a row.
 * - Each type's targets cycle through its whole pool before repeating, and no
 *   target comes twice in a row, whatever the types.
 * - Distractors prefer a different category from the target. Nothing on screen
 *   is confusable (sound rounds) or a look-alike (word rounds) with anything else.
 * - The target's position is random, never in the same slot more than twice in
 *   a row, and slot counts stay within two of each other.
 */
export function guessEngine({ sound, word, kinds, choices, rng = Math.random }: EngineOptions) {
  const pools: Record<RoundKind, Item[]> = { sound, word };
  const clash: Record<RoundKind, Clash> = { sound: confusables(sound), word: lookalikes(word) };
  const bags: Record<RoundKind, Item[]> = { sound: [], word: [] };
  const nextKind = kindPicker(kinds, rng);
  let lastTarget: Item | null = null;
  const recentSlots: number[] = [];
  const slotCounts: number[] = [];

  const nextTarget = (kind: RoundKind): Item => {
    const pool = pools[kind];
    let bag = bags[kind];
    if (!bag.length) bag = bags[kind] = shuffle(pool, rng);
    let i = bag.length - 1;
    if (bag[i] === lastTarget) {
      if (bag.length > 1) i = 0;
      else {
        // The only item left was just played (in the other round type): start
        // this type's next cycle now and keep that item for later in it.
        const held = bag[0];
        bag = bags[kind] = [held, ...shuffle(pool.filter((p) => p !== held), rng)];
        i = bag.length - 1;
      }
    }
    lastTarget = bag.splice(i, 1)[0];
    return lastTarget;
  };

  const pickDistractors = (kind: RoundKind, target: Item, count: number): Item[] => {
    const isClash = clash[kind];
    // Different category first, then the same category; random within each.
    const others = shuffle(pools[kind].filter((i) => i !== target && !isClash(i, target)), rng);
    const ranked = [...others.filter((i) => i.category !== target.category), ...others.filter((i) => i.category === target.category)];
    const picked: Item[] = [];
    for (const i of ranked) {
      if (picked.length === count) break;
      if (picked.some((p) => isClash(p, i))) continue;
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
    const kind = nextKind();
    const target = nextTarget(kind);
    const distractors = pickDistractors(kind, target, Math.max(1, choices - 1));
    const targetIndex = pickSlot(distractors.length + 1);
    const shown = shuffle(distractors, rng);
    shown.splice(targetIndex, 0, target);
    return { kind, target, choices: shown, targetIndex };
  };
}
