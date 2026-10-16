import { describe, expect, it } from 'vitest';
import content from '../public/content/content.json';
import type { Content, Item } from './content';
import { confusables, guessEngine, kindPicker, lookalikes, soundPool, usableKinds, wordPool, type Round, type RoundKind } from './rounds';

const items = (content as Content).items;

/** Seeded PRNG (mulberry32), so a failure can be replayed. */
function seeded(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const item = (id: string, category: string, extra: Partial<Item> = {}): Item => ({
  id, category, word: id, image: `${id}.webp`, soundAudio: `${id}.m4a`, guessable: true, ...extra,
});

// A small pool with every rule in play: four categories, confusable pairs for
// sound rounds and look-alike pairs (some overlapping) for word rounds.
const mixed: Item[] = [
  item('goat', 'animals', { confusableWith: ['sheep'] }),
  item('sheep', 'animals'),
  item('crow', 'animals', { confusableWith: ['parrot'] }),
  item('parrot', 'animals'),
  item('cow', 'animals'),
  item('car', 'sounds', { confusableWith: ['bus', 'motorbike'] }),
  item('bus', 'sounds', { confusableWith: ['firetruck'] }),
  item('motorbike', 'sounds'),
  item('firetruck', 'sounds'),
  item('bell', 'things'),
  item('lemon', 'food', { guessable: false, soundAudio: undefined, lookalikeWith: ['orange'] }),
  item('orange', 'food', { guessable: false, soundAudio: undefined }),
  item('ball', 'things', { guessable: false, soundAudio: undefined, lookalikeWith: ['orange'] }),
  item('hen', 'animals', { lookalikeWith: ['duck'] }),
  item('duck', 'animals'),
];
// Look-alikes on the sound items too, so word rounds over the mixed pool meet them.
mixed.find((i) => i.id === 'goat')!.lookalikeWith = ['sheep'];
mixed.find((i) => i.id === 'crow')!.lookalikeWith = ['parrot'];

const ROUNDS = 100;
const SEEDS = [1, 2, 3, 42, 1234];


const make = (kinds: RoundKind[], sound: Item[], word: Item[], choices: number, seed: number) =>
  Array.from({ length: ROUNDS }, guessEngine({ sound, word, kinds, choices, rng: seeded(seed) }));

const together = (r: Round, clash: (a: Item, b: Item) => boolean) =>
  r.choices.flatMap((a) => r.choices.filter((b) => a !== b && clash(a, b)).map((b) => `${a.id} with ${b.id}`));

/** Checks every rule that holds whatever the round types. */
function commonRules(rounds: Round[], choices: number) {
  it('shows the right number of distinct items, target at targetIndex', () => {
    for (const r of rounds) {
      expect(r.choices).toHaveLength(choices);
      expect(r.choices[r.targetIndex]).toBe(r.target);
      expect(new Set(r.choices.map((c) => c.id)).size).toBe(choices);
    }
  });

  it('never repeats a target in consecutive rounds', () => {
    for (let i = 1; i < rounds.length; i++) expect(rounds[i].target.id).not.toBe(rounds[i - 1].target.id);
  });

  it('keeps the target position balanced', () => {
    let run = 1;
    for (let i = 1; i < rounds.length; i++) {
      run = rounds[i].targetIndex === rounds[i - 1].targetIndex ? run + 1 : 1;
      expect(run).toBeLessThanOrEqual(2);
    }
    const counts = Array.from({ length: choices }, (_, s) => rounds.filter((r) => r.targetIndex === s).length);
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(2);
  });
}

const contentSound = soundPool(items);
const contentWord = wordPool(items);
const mixedSound = soundPool(mixed);
const mixedWord = wordPool(mixed);

describe.each([
  ['content.json', contentSound, contentWord],
  ['mixed', mixedSound, mixedWord],
])('Guess rounds from the %s pool', (_, sound, word) => {
  const isConfusable = confusables(sound);
  const isLookalike = lookalikes(word);

  for (const choices of [2, 3]) {
    for (const seed of SEEDS) {
      describe(`sound only, ${choices} choices, seed ${seed}`, () => {
        const rounds = make(['sound'], sound, word, choices, seed);
        commonRules(rounds, choices);
        it('uses only guessable items with sounds, never confusables together', () => {
          for (const r of rounds) {
            expect(r.kind).toBe('sound');
            for (const c of r.choices) expect(sound).toContain(c);
            expect(together(r, isConfusable)).toEqual([]);
          }
        });
        it('cycles the whole pool before repeating', () => {
          for (let start = 0; start + sound.length <= rounds.length; start += sound.length) {
            expect(new Set(rounds.slice(start, start + sound.length).map((r) => r.target.id)).size).toBe(sound.length);
          }
        });
      });

      describe(`word only, ${choices} choices, seed ${seed}`, () => {
        const rounds = make(['word'], sound, word, choices, seed);
        commonRules(rounds, choices);
        it('never shows look-alikes together', () => {
          for (const r of rounds) {
            expect(r.kind).toBe('word');
            expect(together(r, isLookalike)).toEqual([]);
          }
        });
        it('cycles the whole pool before repeating', () => {
          const n = Math.min(word.length, rounds.length);
          expect(new Set(rounds.slice(0, n).map((r) => r.target.id)).size).toBe(n);
        });
      });

      describe(`both, ${choices} choices, seed ${seed}`, () => {
        const rounds = make(['sound', 'word'], sound, word, choices, seed);
        commonRules(rounds, choices);
        it('never pairs look-alikes in word rounds or confusables in sound rounds', () => {
          for (const r of rounds) {
            if (r.kind === 'word') expect(together(r, isLookalike)).toEqual([]);
            else {
              expect(together(r, isConfusable)).toEqual([]);
              for (const c of r.choices) expect(sound).toContain(c);
            }
          }
        });
        it('alternates round types, never more than two of a type in a row', () => {
          let run = 1;
          for (let i = 1; i < rounds.length; i++) {
            run = rounds[i].kind === rounds[i - 1].kind ? run + 1 : 1;
            expect(run).toBeLessThanOrEqual(2);
          }
          const sounds = rounds.filter((r) => r.kind === 'sound').length;
          // Random, but both types get a fair share.
          expect(sounds).toBeGreaterThan(ROUNDS * 0.3);
          expect(sounds).toBeLessThan(ROUNDS * 0.7);
        });
      });
    }
  }
});

describe('kindPicker', () => {
  it('never gives three of a type in a row, over many draws', () => {
    for (const seed of SEEDS) {
      const pick = kindPicker(['sound', 'word'], seeded(seed));
      const kinds = Array.from({ length: 1000 }, pick);
      for (let i = 2; i < kinds.length; i++) {
        expect(kinds[i] === kinds[i - 1] && kinds[i] === kinds[i - 2], `draw ${i}`).toBe(false);
      }
    }
  });

  it('repeats the only type when just one is usable', () => {
    const pick = kindPicker(['word'], seeded(1));
    expect(Array.from({ length: 5 }, pick)).toEqual(['word', 'word', 'word', 'word', 'word']);
  });
});

describe('usableKinds', () => {
  it('keeps the chosen types that have at least two items', () => {
    expect(usableKinds('both', mixedSound, mixedWord)).toEqual(['sound', 'word']);
    expect(usableKinds('word', mixedSound, mixedWord)).toEqual(['word']);
    // Only fruit enabled: no sounds to guess, so "both" plays word rounds only.
    const fruit = mixed.filter((i) => i.category === 'food');
    expect(usableKinds('both', soundPool(fruit), wordPool(fruit))).toEqual(['word']);
    expect(usableKinds('sound', soundPool(fruit), wordPool(fruit))).toEqual([]);
  });
});

describe('distractors', () => {
  it('come from a different category when one is available', () => {
    const next = guessEngine({ sound: mixedSound, word: mixedWord, kinds: ['sound', 'word'], choices: 2, rng: seeded(7) });
    for (let i = 0; i < ROUNDS; i++) {
      const r = next();
      const other = r.choices.find((c) => c !== r.target)!;
      expect(other.category).not.toBe(r.target.category);
    }
  });

  it('sound rounds only use guessable items that have a sound', () => {
    expect(contentSound.length).toBeGreaterThan(2);
    for (const i of contentSound) {
      expect(i.guessable).toBe(true);
      expect(i.soundAudio).toBeTruthy();
    }
    expect(contentSound.find((i) => i.id === 'fish')).toBeUndefined();
  });
});

describe('content.json look-alikes', () => {
  it('has the seeded pairs, read both ways', () => {
    const isLookalike = lookalikes(items);
    const byId = (id: string) => items.find((i) => i.id === id)!;
    for (const [a, b] of [['lemon', 'orange'], ['guava', 'mango'], ['cup', 'jug'], ['goat', 'sheep'], ['hen', 'duck'], ['crow', 'parrot'], ['ball', 'orange']]) {
      expect(isLookalike(byId(a), byId(b)), `${a}–${b}`).toBe(true);
      expect(isLookalike(byId(b), byId(a)), `${b}–${a}`).toBe(true);
    }
  });
});
