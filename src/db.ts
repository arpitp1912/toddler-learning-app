// Local, per-device storage (SPEC section 5). IndexedDB through Dexie.
// If IndexedDB is unavailable (private mode, old WebKit bug), fall back to
// in-memory state so playback never breaks.
import Dexie, { type Table } from 'dexie';
import type { BubbleSpeed } from './content';

export type SessionLimit = 0 | 5 | 10 | 15 | 20; // minutes, 0 = off
export type AgeBand = '18-24' | '24-30';

export interface Profile {
  id: string;
  name: string;
  avatar: string;            // preset item id, shown when there is no photo
  avatarPhoto?: string;      // id in the photos table
  ageBand: AgeBand;
  modules: string[] | null;  // enabled home tile ids (category ids, 'peekaboo', 'bubbles'), null = all
  sessionLimit: SessionLimit;
  findIt: boolean;
  peekabooSoundHint?: boolean; // unset = content.json defaults
  bubbleSpeed?: BubbleSpeed;   // unset = content.json defaults
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

/** Images owned by a profile: the avatar photo now, custom photo cards later (M5). */
export interface Photo {
  id: string;
  profileId: string;
  blob: Blob;
}

/** Device-wide settings, shared by every profile on this device. */
export interface DeviceSettings {
  picker: boolean;     // toddler-facing profile picker after tap to start
  pin: string | null;  // 4-digit parent PIN, replaces the "tap seven" check
}

/**
 * How a photo is kept in IndexedDB: bytes, not a Blob, because WebKit refuses
 * Blobs in some sessions (Safari private browsing among them).
 */
interface StoredPhoto {
  id: string;
  profileId: string;
  type: string;
  data: ArrayBuffer;
}

interface Meta { key: string; value: string }

class AppDB extends Dexie {
  profiles!: Table<Profile, string>;
  sessions!: Table<SessionState, string>;
  photos!: Table<StoredPhoto, string>;
  meta!: Table<Meta, string>;

  constructor() {
    super('toddler-learning');
    this.version(1).stores({ profiles: 'id', sessions: 'profileId', meta: 'key' });
    this.version(2).stores({ photos: 'id, profileId' });
  }
}

const db = new AppDB();
let dbOk = true;

// In-memory stand-ins used when IndexedDB is unavailable.
const memProfiles = new Map<string, Profile>();
const memPhotos = new Map<string, Photo>();
const memMeta = new Map<string, string>();

export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export function blankProfile(avatar: string, id = newId()): Profile {
  return {
    id,
    name: 'Child',
    avatar,
    ageBand: '18-24',
    modules: null,
    sessionLimit: 15,
    findIt: false,
    voicePacks: [],
    voiceMode: 'primary',
    createdAt: Date.now(),
  };
}

async function guard<T>(what: string, run: () => Promise<T>, fallback: () => T): Promise<T> {
  if (!dbOk) return fallback();
  try {
    return await run();
  } catch (err) {
    console.warn(`[db] ${what}`, err);
    return fallback();
  }
}

/**
 * Opens the last-used profile, creating the default profile on first run.
 * `avatar` is the preset used for that first profile.
 */
export async function loadProfile(avatar: string): Promise<Profile> {
  try {
    const last = await db.meta.get('lastProfileId');
    const existing = (last && (await db.profiles.get(last.value))) || (await db.profiles.orderBy('id').first());
    if (existing) return existing;
    const created = blankProfile(avatar, 'default');
    await db.profiles.put(created);
    await db.meta.put({ key: 'lastProfileId', value: created.id });
    return created;
  } catch (err) {
    console.warn('[db] unavailable, using in-memory profile', err);
    dbOk = false;
    const created = blankProfile(avatar, 'default');
    memProfiles.set(created.id, created);
    return created;
  }
}

/** All profiles, oldest first. */
export const listProfiles = () =>
  guard(
    'listProfiles',
    async () => (await db.profiles.toArray()).sort((a, b) => a.createdAt - b.createdAt),
    () => [...memProfiles.values()].sort((a, b) => a.createdAt - b.createdAt),
  );

export const getProfile = (id: string) =>
  guard('getProfile', () => db.profiles.get(id), () => memProfiles.get(id));

export const saveProfile = (p: Profile) =>
  guard('saveProfile', async () => { await db.profiles.put(p); }, () => { memProfiles.set(p.id, p); });

/** Remembers which profile the app opens into next time. */
export const setLastProfile = (id: string) =>
  guard('setLastProfile', async () => { await db.meta.put({ key: 'lastProfileId', value: id }); }, () => {});

/** Removes a profile with its session and photos. */
export const deleteProfile = (id: string) =>
  guard(
    'deleteProfile',
    () =>
      db.transaction('rw', db.profiles, db.sessions, db.photos, async () => {
        await db.profiles.delete(id);
        await db.sessions.delete(id);
        await db.photos.where('profileId').equals(id).delete();
      }),
    () => {
      memProfiles.delete(id);
      for (const [k, ph] of memPhotos) if (ph.profileId === id) memPhotos.delete(k);
    },
  );

const toStored = async ({ id, profileId, blob }: Photo): Promise<StoredPhoto> =>
  ({ id, profileId, type: blob.type || 'image/jpeg', data: await new Response(blob).arrayBuffer() });
const fromStored = ({ id, profileId, type, data }: StoredPhoto): Photo =>
  ({ id, profileId, blob: new Blob([data], { type }) });

export const getPhoto = (id: string) =>
  guard('getPhoto', async () => { const p = await db.photos.get(id); return p && fromStored(p); }, () => memPhotos.get(id));

export const photosFor = (profileId: string) =>
  guard(
    'photosFor',
    async () => (await db.photos.where('profileId').equals(profileId).toArray()).map(fromStored),
    () => [...memPhotos.values()].filter((p) => p.profileId === profileId),
  );

/** Returns false if the photo couldn't be stored. */
export async function savePhoto(p: Photo): Promise<boolean> {
  if (!dbOk) {
    memPhotos.set(p.id, p);
    return true;
  }
  try {
    await db.photos.put(await toStored(p));
    return true;
  } catch (err) {
    console.warn('[db] savePhoto', err);
    return false;
  }
}

export const deletePhoto = (id: string) =>
  guard('deletePhoto', () => db.photos.delete(id), () => { memPhotos.delete(id); });

/** Writes an imported profile and its photos in one go. */
export const putImported = (profile: Profile, photos: Photo[]) =>
  guard(
    'putImported',
    async () => {
      // Read the bytes first: an IndexedDB transaction closes if it awaits anything else.
      const stored = await Promise.all(photos.map(toStored));
      await db.transaction('rw', db.profiles, db.photos, async () => {
        await db.photos.where('profileId').equals(profile.id).delete();
        await db.photos.bulkPut(stored);
        await db.profiles.put(profile);
      });
    },
    () => {
      for (const p of photos) memPhotos.set(p.id, p);
      memProfiles.set(profile.id, profile);
    },
  );

const DEVICE_DEFAULTS: DeviceSettings = { picker: false, pin: null };

export const loadDeviceSettings = () =>
  guard(
    'loadDeviceSettings',
    async () => {
      const row = await db.meta.get('device');
      return row ? { ...DEVICE_DEFAULTS, ...JSON.parse(row.value) } as DeviceSettings : { ...DEVICE_DEFAULTS };
    },
    () => {
      const v = memMeta.get('device');
      return v ? { ...DEVICE_DEFAULTS, ...JSON.parse(v) } as DeviceSettings : { ...DEVICE_DEFAULTS };
    },
  );

export const saveDeviceSettings = (s: DeviceSettings) =>
  guard(
    'saveDeviceSettings',
    async () => { await db.meta.put({ key: 'device', value: JSON.stringify(s) }); },
    () => { memMeta.set('device', JSON.stringify(s)); },
  );

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
