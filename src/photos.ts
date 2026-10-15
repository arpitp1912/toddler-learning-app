// Profile photos: square-cropped on the device and kept as Blobs in IndexedDB.
import { useEffect, useState } from 'preact/hooks';
import { getPhoto } from './db';

const SIZE = 512;
const QUALITY = 0.85;

/**
 * Centre-crops an image file to a 512 px square JPEG. JPEG, not WebP, because
 * Safari 16 can't encode WebP from a canvas.
 */
export async function squarePhoto(file: Blob): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    if (!side) throw new Error('empty image');
    const out = Math.min(SIZE, side);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = out;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, out, out);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode failed'))), 'image/jpeg', QUALITY),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

// One object URL per stored photo, shared by every <Avatar> showing it.
const urls = new Map<string, string>();

/** Drops a cached URL once its photo is replaced or deleted. */
export function forgetPhotoUrl(id: string) {
  const url = urls.get(id);
  if (url) URL.revokeObjectURL(url);
  urls.delete(id);
}

/** Object URL for a stored photo, or null while loading or if it is missing. */
export function usePhotoUrl(id: string | undefined): string | null {
  const [url, setUrl] = useState<string | null>(id ? urls.get(id) ?? null : null);
  useEffect(() => {
    if (!id) return setUrl(null);
    const cached = urls.get(id);
    if (cached) return setUrl(cached);
    setUrl(null);
    let cancelled = false;
    getPhoto(id).then((p) => {
      if (cancelled || !p) return;
      const made = urls.get(id) ?? URL.createObjectURL(p.blob);
      urls.set(id, made);
      setUrl(made);
    });
    return () => { cancelled = true; };
  }, [id]);
  return url;
}
