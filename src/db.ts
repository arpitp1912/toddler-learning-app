// Local, per-device storage (SPEC section 5). IndexedDB through Dexie.
// If IndexedDB is unavailable (private mode, old WebKit bug), fall back to
// in-memory state so playback never breaks.
import Dexie, { type Table } from 'dexie';

export type SessionLimit = 0 | 5 | 10 | 15 | 20; // minutes, 0 = off

export interface Profile {
  id: string;
  name: string;
  avatar: string;            // preset item id until photo avatars arrive (M2)
  ageBand: '18-24' | '24-30';
  modules: string[] | null;  // enabled category ids, null = all
  sessionLimit: SessionLimit;
  findIt: boolean;
  peekabooSoundHint?: boolean; // unset = content.json defaults
  voicePacks: string[];
  voiceMode: 'primary' | 'rotate';
  createdAt: number;
}

export interface SessionState {
  profileId: string;
  elapsedMs: number;   // play time used in the current session
  locked: boolean;     // true once the limit is reached, until the parent resumes
  updatedAt: number;
}

interface Meta { key: string; value: string }

class AppDB extends Dexie {
  profiles!: Table<Profile, string>;
  sessions!: Table<SessionState, string>;
  meta!: Table<Meta, string>;

  constructor() {
    super('toddler-learning');
    this.version(1).stores({ profiles: 'id', sessions: 'profileId', meta: 'key' });
  }
}

const db = new AppDB();
let dbOk = true;

const DEFAULT_PROFILE: Profile = {
  id: 'default',
  name: 'Child',
  avatar: 'cow',
  ageBand: '18-24',
  modules: null,
  sessionLimit: 15,
  findIt: false,
  voicePacks: [],
  voiceMode: 'primary',
  createdAt: 0,
};

/** Opens the last-used profile, creating the single default profile on first run. */
export async function loadProfile(): Promise<Profile> {
  try {
    const last = await db.meta.get('lastProfileId');
    const existing = last ? await db.profiles.get(last.value) : await db.profiles.toCollection().first();
    if (existing) return existing;
    const created = { ...DEFAULT_PROFILE, createdAt: Date.now() };
    await db.profiles.put(created);
    await db.meta.put({ key: 'lastProfileId', value: created.id });
    return created;
  } catch (err) {
    console.warn('[db] unavailable, using in-memory profile', err);
    dbOk = false;
    return { ...DEFAULT_PROFILE, createdAt: Date.now() };
  }
}

export async function saveProfile(p: Profile) {
  if (!dbOk) return;
  try { await db.profiles.put(p); } catch (err) { console.warn('[db] saveProfile', err); }
}

export async function loadSession(profileId: string): Promise<SessionState> {
  const fresh: SessionState = { profileId, elapsedMs: 0, locked: false, updatedAt: Date.now() };
  if (!dbOk) return fresh;
  try { return (await db.sessions.get(profileId)) ?? fresh; } catch { return fresh; }
}

export async function saveSession(s: SessionState) {
  if (!dbOk) return;
  try { await db.sessions.put({ ...s, updatedAt: Date.now() }); } catch (err) { console.warn('[db] saveSession', err); }
}

/** Asks Safari not to evict our data (SPEC section 11). Safe to call repeatedly. */
export async function requestPersistence() {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) await navigator.storage.persist();
  } catch { /* unsupported: nothing to do */ }
}
