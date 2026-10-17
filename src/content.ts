// Typed access to public/content/content.json. The app is a renderer for this file.

export interface Category {
  id: string;
  /** Parent-facing name ("Vehicles"). The child never sees it. */
  name?: string;
  module: 'cards' | 'scenes' | 'counting' | 'letters';
  icon: string;
  tint: 'sage' | 'sky' | 'peach' | 'butter' | 'lilac';
}

export interface Item {
  id: string;
  category: string;
  word: string;
  image: string;
  wordAudio?: string;
  soundAudio?: string;
  anim?: 'bounce' | 'wiggle';
  /** Card action replacing the bounce. See src/actions.ts. */
  action?: ItemAction;
  /** Pose shown while the action is airborne. Set by `npm run assets` when design/style/<id>-action.png exists. */
  actionImage?: string;
  tags?: string[];
  /** Usable in Guess sound rounds (needs a soundAudio too). */
  guessable?: boolean;
  /** Item ids whose sounds are too alike to show together in a Guess sound round. Read both ways. */
  confusableWith?: string[];
  /** Item ids that look too alike to show together in a Guess word round. Read both ways. */
  lookalikeWith?: string[];
}

/** Card action motions, tuned in src/actions.ts. */
export type Motion = 'jump' | 'leap' | 'waddle' | 'peck' | 'flap' | 'rear' | 'headbutt' | 'nod' | 'roar' | 'swim' | 'buzz';

/**
 * A motion preset, when in it the item's sound plays (ms from the motion's
 * start; the preset's own peak if left out), and which way the picture faces,
 * so forward leans and lunges go the right way.
 */
export interface ItemAction {
  motion: Motion;
  peakMs?: number;
  facing?: 'left' | 'right';
}

/** Settings a profile falls back to when it has no value of its own. */
export type BubbleSpeed = 'slow' | 'normal';
export type GuessChoices = 2 | 3;
/** Which Guess rounds play: "Who says that?" sounds, "Find it" words, or both mixed. */
export type GuessRounds = 'sound' | 'word' | 'both';

export interface ContentDefaults {
  peekabooSoundHint?: boolean;
  bubbleSpeed?: BubbleSpeed;
  guess?: boolean;
  guessRounds?: GuessRounds;
  guessChoices?: GuessChoices;
}

/** A spoken prompt ("Listen!", "Where's the"). `audio` is the built-in voice; without it the device voice says `text`. */
export interface Prompt {
  id: string;
  text: string;
  audio?: string;
}

export interface Content {
  version: number;
  defaults?: ContentDefaults;
  categories: Category[];
  items: Item[];
  prompts?: Prompt[];
  decor?: { start?: string[]; goodbye?: string[]; avatars?: string[] };
  scenes?: unknown[];
  letters?: unknown[];
  counting?: unknown[];
}

const BASE = `${import.meta.env.BASE_URL}content/`;

/** Resolves a content-relative path (e.g. "img/animals/cow.webp") to a URL. */
export const asset = (path: string) => BASE + path;

/** Modules this build can render. Categories for other modules are hidden. */
export const SUPPORTED_MODULES: ReadonlySet<Category['module']> = new Set(['cards']);

export async function loadContent(): Promise<Content> {
  const res = await fetch(BASE + 'content.json');
  if (!res.ok) throw new Error(`content.json: ${res.status}`);
  return res.json();
}

export const itemsIn = (content: Content, categoryId: string) =>
  content.items.filter((i) => i.category === categoryId);

/** Parent-facing name for a category ("Vehicles"), falling back to its id. */
export const categoryName = (c: Category) => c.name ?? c.id.charAt(0).toUpperCase() + c.id.slice(1);

export const itemById = (content: Content, id: string) => content.items.find((i) => i.id === id);

/** Preset profile avatars: `decor.avatars`, or the first category's items if that is missing. */
export function avatarItems(content: Content): Item[] {
  const listed = content.decor?.avatars?.map((id) => itemById(content, id)).filter((i): i is Item => !!i);
  if (listed?.length) return listed;
  const first = content.categories[0];
  return first ? itemsIn(content, first.id) : content.items.slice(0, 12);
}
