import { describe, expect, it } from 'vitest';
import { upgradeProfile } from './db';

describe('upgradeProfile (profiles saved before Look and Guess)', () => {
  it('adds Look to a saved tile list and moves the Who-says settings to Guess', () => {
    const p: Record<string, unknown> = { modules: ['animals', 'food', 'peekaboo'], whoSays: true, whoSaysChoices: 3, findIt: true };
    upgradeProfile(p);
    expect(p).toEqual({ modules: ['look', 'animals', 'food', 'peekaboo'], guess: true, guessChoices: 3 });
  });

  it('leaves "all tiles" and unset settings alone, so content defaults still apply', () => {
    const p: Record<string, unknown> = { modules: null };
    upgradeProfile(p);
    expect(p).toEqual({ modules: null });
  });

  it('is safe to run twice', () => {
    const p: Record<string, unknown> = { modules: ['look', 'bubbles'], guess: false };
    upgradeProfile(p);
    expect(p).toEqual({ modules: ['look', 'bubbles'], guess: false });
  });
});
