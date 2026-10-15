// Profile backup (SPEC section 5): a .zip holding manifest.json, profile.json
// and the profile's photos, to move a profile between devices.
import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from 'fflate';
import { newId, photosFor, type AgeBand, type Photo, type Profile, type SessionLimit } from './db';

const FORMAT = 'toddler-profile';
const VERSION = 1;

interface Manifest {
  format: string;
  version: number;
  exportedAt: string;
  photos: { id: string; file: string; type: string }[];
}

export interface ProfileBundle {
  profile: Profile;
  photos: Photo[];
}

/** A problem with an imported file, worded for the parent. */
export class ImportError extends Error {}

const bytes = async (b: Blob) => new Uint8Array(await new Response(b).arrayBuffer());
const ext = (type: string) => (type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg');

export async function exportProfile(profile: Profile): Promise<File> {
  const photos = await photosFor(profile.id);
  const manifest: Manifest = {
    format: FORMAT,
    version: VERSION,
    exportedAt: new Date().toISOString(),
    photos: photos.map((p) => ({ id: p.id, file: `photos/${p.id}.${ext(p.blob.type)}`, type: p.blob.type || 'image/jpeg' })),
  };
  const files: Zippable = {
    'manifest.json': strToU8(JSON.stringify(manifest, null, 2)),
    'profile.json': strToU8(JSON.stringify(profile, null, 2)),
  };
  // Photos are already compressed, so they are stored rather than deflated.
  for (const [i, p] of photos.entries()) files[manifest.photos[i].file] = [await bytes(p.blob), { level: 0 }];
  const zip = zipSync(files, { level: 6 });
  const safe = profile.name.replace(/[^\p{L}\p{N} _-]+/gu, '').trim() || 'profile';
  return new File([zip], `${safe} profile.zip`, { type: 'application/zip' });
}

const LIMITS: SessionLimit[] = [0, 5, 10, 15, 20];
const BANDS: AgeBand[] = ['18-24', '24-30'];
const strings = (v: unknown): v is string[] => Array.isArray(v) && v.every((s) => typeof s === 'string');

/** Rebuilds a profile from untrusted JSON, keeping only known fields and valid values. */
function cleanProfile(raw: unknown, photoIds: Set<string>): Profile {
  if (!raw || typeof raw !== 'object') throw new ImportError('The profile details in this file are missing.');
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== 'string' || !r.id) throw new ImportError('The profile details in this file are damaged.');
  const p: Profile = {
    id: r.id,
    name: typeof r.name === 'string' && r.name.trim() ? r.name.trim().slice(0, 40) : 'Child',
    avatar: typeof r.avatar === 'string' ? r.avatar : '',
    ageBand: BANDS.includes(r.ageBand as AgeBand) ? (r.ageBand as AgeBand) : '18-24',
    modules: strings(r.modules) ? r.modules : null,
    sessionLimit: LIMITS.includes(r.sessionLimit as SessionLimit) ? (r.sessionLimit as SessionLimit) : 15,
    findIt: r.findIt === true,
    voicePacks: strings(r.voicePacks) ? r.voicePacks : [],
    voiceMode: r.voiceMode === 'rotate' ? 'rotate' : 'primary',
    createdAt: typeof r.createdAt === 'number' ? r.createdAt : Date.now(),
  };
  if (typeof r.avatarPhoto === 'string' && photoIds.has(r.avatarPhoto)) p.avatarPhoto = r.avatarPhoto;
  if (typeof r.peekabooSoundHint === 'boolean') p.peekabooSoundHint = r.peekabooSoundHint;
  if (r.bubbleSpeed === 'slow' || r.bubbleSpeed === 'normal') p.bubbleSpeed = r.bubbleSpeed;
  if (typeof r.whoSays === 'boolean') p.whoSays = r.whoSays;
  if (r.whoSaysChoices === 2 || r.whoSaysChoices === 3) p.whoSaysChoices = r.whoSaysChoices;
  return p;
}

export async function readProfileZip(file: Blob): Promise<ProfileBundle> {
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(await bytes(file));
  } catch {
    throw new ImportError('This file is not a profile backup. Choose the .zip file that was exported from this app.');
  }
  const json = (name: string): unknown => {
    const data = entries[name];
    if (!data) return undefined;
    try { return JSON.parse(strFromU8(data)); } catch { return undefined; }
  };
  const manifest = json('manifest.json') as Manifest | undefined;
  if (!manifest || manifest.format !== FORMAT) {
    throw new ImportError('This file is not a profile backup. Choose the .zip file that was exported from this app.');
  }
  if (typeof manifest.version !== 'number' || manifest.version > VERSION) {
    throw new ImportError('This backup was made by a newer version of the app. Update the app on this device, then try again.');
  }
  const photos: Photo[] = [];
  for (const m of Array.isArray(manifest.photos) ? manifest.photos : []) {
    const data = typeof m?.file === 'string' ? entries[m.file] : undefined;
    if (typeof m?.id !== 'string' || !data) continue;
    photos.push({ id: m.id, profileId: '', blob: new Blob([data as Uint8Array<ArrayBuffer>], { type: typeof m.type === 'string' ? m.type : 'image/jpeg' }) });
  }
  const profile = cleanProfile(json('profile.json'), new Set(photos.map((p) => p.id)));
  for (const p of photos) p.profileId = profile.id;
  return { profile, photos };
}

/** The same bundle under fresh ids, to keep alongside an existing profile with the same id. */
export function asCopy({ profile, photos }: ProfileBundle): ProfileBundle {
  const id = newId();
  const ids = new Map(photos.map((p) => [p.id, `photo-${newId()}`]));
  return {
    profile: { ...profile, id, avatarPhoto: profile.avatarPhoto && ids.get(profile.avatarPhoto), createdAt: Date.now() },
    photos: photos.map((p) => ({ ...p, id: ids.get(p.id)!, profileId: id })),
  };
}

/**
 * Hands the file to the iOS share sheet (AirDrop, WhatsApp, Files), or
 * downloads it where sharing files isn't supported. Must run in a tap handler.
 */
export async function shareOrDownload(file: File): Promise<'shared' | 'downloaded' | 'cancelled'> {
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return 'shared';
    } catch (err) {
      if ((err as DOMException)?.name === 'AbortError') return 'cancelled';
      // Anything else (for example lost tap permission): fall through to a download.
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return 'downloaded';
}
