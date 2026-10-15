import { describe, expect, it } from 'vitest';
import content from '../public/content/content.json';
import type { Content, Item } from './content';
import { confusables, guessPool, roundMaker } from './rounds';

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

// A small pool with every rule in play: two categories and three confusable pairs.
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
];

const ROUNDS = 100;
const SEEDS = [1, 2, 3, 42, 1234];

describe.each([
  ['content.json pool', guessPool(items)],
  ['mixed pool', mixed],
])('rounds from the %s', (_, pool) => {
  const isConfusable = confusables(pool);

  for (const choices of [2, 3]) {
    describe(`${choices} choices`, () => {
      for (const seed of SEEDS) {
        const rounds = Array.from({ length: ROUNDS }, roundMaker(pool, choices, seeded(seed)));

        it(`shows ${choices} items with the target at targetIndex (seed ${seed})`, () => {
          for (const r of rounds) {
            expect(r.choices).toHaveLength(choices);
            expect(r.choices[r.targetIndex]).toBe(r.target);
            expect(new Set(r.choices.map((c) => c.id)).size).toBe(choices);
          }
        });

        it(`never shows confusable items together (seed ${seed})`, () => {
          for (const r of rounds) {
            for (const a of r.choices) for (const b of r.choices) {
              if (a !== b) expect(isConfusable(a, b), `${a.id} with ${b.id}`).toBe(false);
            }
          }
        });

        it(`never repeats a target in consecutive rounds, and cycles the pool (seed ${seed})`, () => {
          for (let i = 1; i < rounds.length; i++) expect(rounds[i].target).not.toBe(rounds[i - 1].target);
          // Each full pass through the pool uses every item once.
          for (let start = 0; start + pool.length <= rounds.length; start += pool.length) {
            const ids = rounds.slice(start, start + pool.length).map((r) => r.target.id);
            expect(new Set(ids).size).toBe(pool.length);
          }
        });

        it(`keeps the target position balanced (seed ${seed})`, () => {
          let run = 1;
          for (let i = 1; i < rounds.length; i++) {
            run = rounds[i].targetIndex === rounds[i - 1].targetIndex ? run + 1 : 1;
            expect(run).toBeLessThanOrEqual(2);
          }
          const counts = Array.from({ length: choices }, (_, s) => rounds.filter((r) => r.targetIndex === s).length);
          expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(2);
        });
      }
    });
  }
});

describe('distractors', () => {
  it('come from a different category when one is available', () => {
    const next = roundMaker(mixed, 2, seeded(7));
    for (let i = 0; i < ROUNDS; i++) {
      const r = next();
      const other = r.choices.find((c) => c !== r.target)!;
      expect(other.category).not.toBe(r.target.category);
    }
  });

  it('only use guessable items that have a sound', () => {
    const pool = guessPool(items);
    expect(pool.length).toBeGreaterThan(2);
    for (const i of pool) {
      expect(i.guessable).toBe(true);
      expect(i.soundAudio).toBeTruthy();
    }
    expect(pool.find((i) => i.id === 'fish')).toBeUndefined();
  });
});
