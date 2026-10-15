// Typed access to public/content/content.json. The app is a renderer for this file.

export interface Category {
  id: string;
  module: 'cards' | 'scenes' | 'counting' | 'letters';
  icon: string;
  tint: 'sage' | 'sky' | 'peach' | 'butter' | 'lilac';
  badge?: 'sound';
}

export interface Item {
  id: string;
  category: string;
  word: string;
  image: string;
  wordAudio?: string;
  soundAudio?: string;
  anim?: 'bounce' | 'wiggle';
  tags?: string[];
}

/** Settings a profile falls back to when it has no value of its own. */
export type BubbleSpeed = 'slow' | 'normal';

export interface ContentDefaults {
  peekabooSoundHint?: boolean;
  bubbleSpeed?: BubbleSpeed;
}

export interface Content {
  version: number;
  defaults?: ContentDefaults;
  categories: Category[];
  items: Item[];
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

export const itemById = (content: Content, id: string) => content.items.find((i) => i.id === id);

/** Preset profile avatars: `decor.avatars`, or the first category's items if that is missing. */
export function avatarItems(content: Content): Item[] {
  const listed = content.decor?.avatars?.map((id) => itemById(content, id)).filter((i): i is Item => !!i);
  if (listed?.length) return listed;
  const first = content.categories[0];
  return first ? itemsIn(content, first.id) : content.items.slice(0, 12);
}
