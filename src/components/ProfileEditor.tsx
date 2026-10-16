import { useEffect, useMemo, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { asset, avatarItems, categoryName, SUPPORTED_MODULES, type Content, type GuessRounds } from '../content';
import {
  LOOK, blankProfile, deletePhoto, newId, savePhoto, saveProfile,
  type AgeBand, type Profile, type SessionLimit,
} from '../db';
import { forgetPhotoUrl, squarePhoto, usePhotoUrl } from '../photos';
import { BubblesIcon, GuessIcon, LookIcon, PeekabooIcon } from './icons';

export const LIMITS: SessionLimit[] = [0, 5, 10, 15, 20];
export const limitLabel = (l: SessionLimit) => (l === 0 ? 'Off' : `${l} min`);
export const BAND_LABEL: Record<AgeBand, string> = { '18-24': '18–24 months', '24-30': '24–30 months' };

const ROUND_LABEL: Record<GuessRounds, string> = { sound: 'Sounds', word: 'Words', both: 'Both' };

interface Props {
  content: Content;
  /** null creates a new profile. */
  profile: Profile | null;
  canDelete: boolean;
  onSaved: (p: Profile) => void;
  onDelete: (p: Profile) => void;
  onClose: () => void;
}

/** Photo the parent picked but hasn't saved yet: a new one, or removing the current one. */
type PhotoDraft = { kind: 'keep' } | { kind: 'new'; blob: Blob } | { kind: 'remove' };

export function Switch({ on, label, onChange }: { on: boolean; label: string; onChange: (on: boolean) => void }) {
  return (
    <button class="switch" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}>
      <span class="switch-knob" />
    </button>
  );
}

function Row({ title, note, children }: { title: string; note?: ComponentChildren; children: ComponentChildren }) {
  return (
    <div class="prow">
      <div class="prow-text">
        <div class="prow-title">{title}</div>
        {note && <div class="parent-muted prow-note">{note}</div>}
      </div>
      {children}
    </div>
  );
}

// Screen 12. Edits a draft; nothing is stored until Save.
export function ProfileEditor({ content, profile, canDelete, onSaved, onDelete, onClose }: Props) {
  const presets = useMemo(() => avatarItems(content), [content]);
  const [draft, setDraft] = useState<Profile>(() => profile ?? { ...blankProfile(presets[0]?.id ?? ''), name: '' });
  const [photo, setPhoto] = useState<PhotoDraft>({ kind: 'keep' });
  const [photoError, setPhotoError] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);
  const isNew = profile == null;

  const set = <K extends keyof Profile>(key: K, value: Profile[K]) => setDraft((d) => ({ ...d, [key]: value }));

  // Avatar preview: the unsaved photo, else the stored one, else the preset.
  const stored = usePhotoUrl(photo.kind === 'keep' ? draft.avatarPhoto : undefined);
  const [pending, setPending] = useState<string | null>(null);
  useEffect(() => {
    if (photo.kind !== 'new') return setPending(null);
    const url = URL.createObjectURL(photo.blob);
    setPending(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);
  const preview = pending ?? stored;
  const presetItem = presets.find((i) => i.id === draft.avatar) ?? content.items.find((i) => i.id === draft.avatar);

  const choosePhoto = async (e: Event) => {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    try {
      setPhoto({ kind: 'new', blob: await squarePhoto(file) });
      setPhotoError(false);
    } catch (err) {
      console.warn('[photo]', err);
      setPhotoError(true);
    }
  };
  const choosePreset = (id: string) => {
    set('avatar', id);
    if (photo.kind === 'new' || draft.avatarPhoto) setPhoto({ kind: 'remove' });
  };
  const hasPhoto = photo.kind === 'new' || (photo.kind === 'keep' && !!draft.avatarPhoto);

  // Everything `modules` can switch: the home tiles (Guess has its own switch)
  // and Look's categories.
  const homeTiles = [
    { id: LOOK, name: 'Look', icon: <LookIcon /> },
    { id: 'peekaboo', name: 'Peekaboo', icon: <PeekabooIcon /> },
    { id: 'bubbles', name: 'Bubbles', icon: <BubblesIcon /> },
  ];
  const categoryTiles = useMemo(
    () =>
      content.categories
        .filter((c) => SUPPORTED_MODULES.has(c.module))
        .map((c) => ({ id: c.id, name: categoryName(c), icon: <img class="art" src={asset(c.icon)} alt="" /> })),
    [content],
  );
  const tiles = [...homeTiles, ...categoryTiles];
  const tileOn = (id: string) => draft.modules == null || draft.modules.includes(id);
  const toggleTile = (id: string, on: boolean) => {
    const current = draft.modules ?? tiles.map((t) => t.id);
    const next = on ? [...current, id] : current.filter((t) => t !== id);
    // Everything on is stored as "all", so tiles added in later updates show too.
    set('modules', tiles.every((t) => next.includes(t.id)) ? null : tiles.map((t) => t.id).filter((t) => next.includes(t)));
  };

  const hintDefault = content.defaults?.peekabooSoundHint ?? false;
  const speedDefault = content.defaults?.bubbleSpeed ?? 'slow';
  // Guess has its own on/off (`guess`), not an entry in the tile list.
  const guessOn = draft.guess ?? content.defaults?.guess ?? false;
  const roundsDefault = content.defaults?.guessRounds ?? 'both';
  const choicesDefault = content.defaults?.guessChoices ?? 2;
  const noCategories = categoryTiles.every((t) => !tileOn(t.id));

  const save = async () => {
    if (saving) return;
    setSaving(true);
    let next: Profile = { ...draft, name: draft.name.trim() || 'Child' };
    const old = profile?.avatarPhoto;
    if (photo.kind === 'new') {
      const id = `photo-${newId()}`;
      // If it can't be stored, keep the current picture rather than point at nothing.
      if (await savePhoto({ id, profileId: next.id, blob: photo.blob })) next = { ...next, avatarPhoto: id };
    } else if (photo.kind === 'remove') {
      const { avatarPhoto: _, ...rest } = next;
      next = rest;
    }
    await saveProfile(next);
    if (old && old !== next.avatarPhoto) {
      await deletePhoto(old);
      forgetPhotoUrl(old);
    }
    onSaved(next);
  };

  return (
    <div class="parent-wrap">
      <div class="parent-top">
        <button class="pbtn" onClick={onClose}>Cancel</button>
        <h1 id="parent-title">{isNew ? 'New profile' : `Edit ${profile.name}`}</h1>
      </div>

      <section class="parent-card">
        <h2>Picture</h2>
        <p class="parent-muted">Shown in the parent area, and to your child if the profile picker is on.</p>
        <div class="avatar-edit">
          <span class="avatar avatar--lg" aria-hidden="true">
            {preview ? (
              <img class="avatar-photo" src={preview} alt="" />
            ) : (
              presetItem && <img class="avatar-art art" src={asset(presetItem.image)} alt="" />
            )}
          </span>
          <div class="pbtn-col">
            <label class="pbtn pbtn--file">
              {hasPhoto ? 'Change photo' : 'Take or choose a photo'}
              <input type="file" accept="image/*" onChange={choosePhoto} />
            </label>
            {hasPhoto && (
              <button class="pbtn" onClick={() => setPhoto({ kind: 'remove' })}>Remove photo</button>
            )}
          </div>
        </div>
        {photoError && <p class="parent-error">That photo couldn't be opened. Try another one.</p>}
        <p class="parent-muted">Or pick an animal:</p>
        <div class="avatar-grid" role="group" aria-label="Animal pictures">
          {presets.map((item) => (
            <button
              key={item.id}
              class="avatar-choice"
              aria-label={item.word}
              aria-pressed={!hasPhoto && draft.avatar === item.id}
              onClick={() => choosePreset(item.id)}
            >
              <img class="art" src={asset(item.image)} alt="" />
            </button>
          ))}
        </div>
      </section>

      <section class="parent-card">
        <h2>About your child</h2>
        <label class="pfield">
          <span class="prow-title">Name</span>
          <span class="parent-muted prow-note">Only grown-ups see this.</span>
          <input
            class="pinput"
            type="text"
            maxLength={40}
            autoComplete="off"
            placeholder="For example, Mia"
            value={draft.name}
            onInput={(e) => set('name', (e.currentTarget as HTMLInputElement).value)}
          />
        </label>
        <div class="prow-title">Age</div>
        <div class="seg" role="group" aria-label="Age">
          {(Object.keys(BAND_LABEL) as AgeBand[]).map((b) => (
            <button key={b} class="pbtn" aria-pressed={draft.ageBand === b} onClick={() => set('ageBand', b)}>
              {BAND_LABEL[b]}
            </button>
          ))}
        </div>
      </section>

      <section class="parent-card">
        <h2>Home screen</h2>
        <p class="parent-muted">Choose which pictures appear on your child's home screen.</p>
        {homeTiles.map((t) => (
          <div class="prow" key={t.id}>
            <span class="prow-icon" aria-hidden="true">{t.icon}</span>
            <div class="prow-text"><div class="prow-title">{t.name}</div></div>
            <Switch on={tileOn(t.id)} label={t.name} onChange={(on) => toggleTile(t.id, on)} />
          </div>
        ))}
        <div class="prow">
          <span class="prow-icon" aria-hidden="true"><GuessIcon /></span>
          <div class="prow-text">
            <div class="prow-title">Guess</div>
            <div class="parent-muted prow-note">"Who says that?" sounds and "Where's the cow?" words. Suggested from 24 months.</div>
          </div>
          <Switch on={guessOn} label="Guess" onChange={(on) => set('guess', on)} />
        </div>
        {homeTiles.every((t) => !tileOn(t.id)) && !guessOn && (
          <p class="parent-error">With everything off, the home screen will be empty.</p>
        )}
      </section>

      <section class="parent-card">
        <h2>Look</h2>
        <p class="parent-muted">Choose the picture groups. Look shows one tile for each, and the games use their pictures.</p>
        {categoryTiles.map((t) => (
          <div class="prow" key={t.id}>
            <span class="prow-icon" aria-hidden="true">{t.icon}</span>
            <div class="prow-text"><div class="prow-title">{t.name}</div></div>
            <Switch on={tileOn(t.id)} label={t.name} onChange={(on) => toggleTile(t.id, on)} />
          </div>
        ))}
        {noCategories && <p class="parent-error">With every group off, there are no pictures to play with.</p>}
      </section>

      <section class="parent-card">
        <h2>Time limit</h2>
        <p class="parent-muted">A sun fades one minute before the end. Then a goodbye plays and the screen locks.</p>
        <div class="seg" role="group" aria-label="Time limit">
          {LIMITS.map((l) => (
            <button key={l} class="pbtn" aria-pressed={draft.sessionLimit === l} onClick={() => set('sessionLimit', l)}>
              {limitLabel(l)}
            </button>
          ))}
        </div>
      </section>

      <section class="parent-card">
        <h2>Games</h2>
        <Row title="Peekaboo sound hint" note="Plays the hidden item's sound quietly before each reveal.">
          <Switch
            on={draft.peekabooSoundHint ?? hintDefault}
            label="Peekaboo sound hint"
            onChange={(on) => set('peekabooSoundHint', on)}
          />
        </Row>
        <div class="prow-title">Bubbles speed</div>
        <div class="seg" role="group" aria-label="Bubbles speed">
          {(['slow', 'normal'] as const).map((s) => (
            <button key={s} class="pbtn" aria-pressed={(draft.bubbleSpeed ?? speedDefault) === s} onClick={() => set('bubbleSpeed', s)}>
              {s === 'slow' ? 'Slow' : 'Normal'}
            </button>
          ))}
        </div>
        {guessOn && (
          <>
            <div class="prow-title">Guess rounds</div>
            <div class="parent-muted prow-note">Sounds: "Who says that?" Words: "Where's the cow?" Both: a mix of the two.</div>
            <div class="seg" role="group" aria-label="Guess rounds">
              {(['sound', 'word', 'both'] as const).map((r) => (
                <button key={r} class="pbtn" aria-pressed={(draft.guessRounds ?? roundsDefault) === r} onClick={() => set('guessRounds', r)}>
                  {ROUND_LABEL[r]}
                </button>
              ))}
            </div>
            <div class="prow-title">Guess pictures</div>
            <div class="seg" role="group" aria-label="Guess pictures">
              {([2, 3] as const).map((n) => (
                <button key={n} class="pbtn" aria-pressed={(draft.guessChoices ?? choicesDefault) === n} onClick={() => set('guessChoices', n)}>
                  {n === 2 ? '2 to choose from' : '3 to choose from'}
                </button>
              ))}
            </div>
          </>
        )}
      </section>

      <div class="pbtn-row">
        <button class="pbtn pbtn--primary" onClick={save} disabled={saving}>
          {isNew ? 'Add profile' : 'Save'}
        </button>
        <button class="pbtn" onClick={onClose}>Cancel</button>
      </div>

      {!isNew && canDelete && (
        <section class="parent-card">
          <h2>Delete profile</h2>
          {confirmDelete ? (
            <>
              <p>
                Delete {profile.name}? Their settings and photo are removed from this device. This can't be undone.
                Export the profile first if you might want it back.
              </p>
              <div class="pbtn-row">
                <button class="pbtn pbtn--danger" onClick={() => onDelete(profile)}>Delete {profile.name}</button>
                <button class="pbtn" onClick={() => setConfirmDelete(false)}>Keep</button>
              </div>
            </>
          ) : (
            <button class="pbtn" onClick={() => setConfirmDelete(true)}>Delete this profile</button>
          )}
        </section>
      )}
    </div>
  );
}
