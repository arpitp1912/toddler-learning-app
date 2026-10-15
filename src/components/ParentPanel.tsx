import { useState } from 'preact/hooks';
import type { Content } from '../content';
import type { DeviceSettings, Profile } from '../db';
import { isStandalone } from '../features';
import { asCopy, exportProfile, ImportError, readProfileZip, shareOrDownload, type ProfileBundle } from '../backup';
import { Avatar } from './Avatar';
import { BAND_LABEL, limitLabel, ProfileEditor, Switch } from './ProfileEditor';
import { PinSetup } from './Pin';

interface Props {
  content: Content;
  profile: Profile;      // the profile playing now
  profiles: Profile[];
  device: DeviceSettings;
  locked: boolean;
  elapsedMs: number;
  onBack: () => void;
  onNewSession: () => void;
  onEndNow: () => void;
  onSwitch: (p: Profile) => void;
  onSaved: (p: Profile) => void;
  onDelete: (p: Profile) => void;
  onImport: (bundle: ProfileBundle) => Promise<void>;
  onDevice: (s: DeviceSettings) => void;
}

type Route = { name: 'home' } | { name: 'edit'; id: string | null } | { name: 'pin' };
type Notice = { kind: 'ok' | 'error'; text: string } | null;

const minutes = (ms: number) => Math.floor(ms / 60_000);

// Screen 11 (parent home), with the profile editor (12) and PIN setup inside it.
export function ParentPanel(props: Props) {
  const { content, profile, profiles, device, locked, elapsedMs, onBack, onNewSession, onEndNow } = props;
  const [route, setRoute] = useState<Route>({ name: 'home' });
  const [notice, setNotice] = useState<Notice>(null);
  const [conflict, setConflict] = useState<ProfileBundle | null>(null);
  // Export is two taps: build the file, then share it (iOS needs the share call inside a tap).
  const [exported, setExported] = useState<{ id: string; file: File } | null>(null);
  const [busy, setBusy] = useState(false);

  const home = (n: Notice = null) => {
    setNotice(n);
    setRoute({ name: 'home' });
  };

  if (route.name === 'edit') {
    const editing = route.id ? profiles.find((p) => p.id === route.id) ?? null : null;
    return (
      <div key="edit" class="parent" role="dialog" aria-modal="true" aria-labelledby="parent-title">
        <ProfileEditor
          key={route.id ?? 'new'}
          content={content}
          profile={editing}
          canDelete={profiles.length > 1}
          onClose={() => home()}
          onSaved={(p) => {
            props.onSaved(p);
            home({ kind: 'ok', text: editing ? `Saved ${p.name}.` : `Added ${p.name}. Tap "Switch to ${p.name}" to play as them.` });
          }}
          onDelete={(p) => {
            props.onDelete(p);
            home({ kind: 'ok', text: `Deleted ${p.name}.` });
          }}
        />
      </div>
    );
  }

  if (route.name === 'pin') {
    return (
      <div key="pin" class="parent" role="dialog" aria-modal="true" aria-labelledby="parent-title">
        <PinSetup
          onCancel={() => home()}
          onSet={(pin) => {
            props.onDevice({ ...device, pin });
            home({ kind: 'ok', text: 'PIN set. You will need it to open the parent area.' });
          }}
        />
      </div>
    );
  }

  const used = minutes(elapsedMs);
  const status = locked
    ? `Play time is over for ${profile.name}. Start a new session when you are ready.`
    : profile.sessionLimit
      ? `${profile.name}: ${used} of ${profile.sessionLimit} minutes used in this session.`
      : `${profile.name}: ${used} minutes played. No time limit is set.`;

  const prepareExport = async (p: Profile) => {
    setBusy(true);
    try {
      setExported({ id: p.id, file: await exportProfile(p) });
    } catch (err) {
      console.warn('[export]', err);
      setNotice({ kind: 'error', text: `${p.name} couldn't be exported. Try again.` });
    } finally {
      setBusy(false);
    }
  };
  const share = async () => {
    if (!exported) return;
    const result = await shareOrDownload(exported.file);
    if (result !== 'cancelled') {
      setExported(null);
      setNotice({
        kind: 'ok',
        text: result === 'shared' ? 'Profile file shared.' : `Saved ${exported.file.name} to your downloads.`,
      });
    }
  };

  const finishImport = async (bundle: ProfileBundle) => {
    setConflict(null);
    await props.onImport(bundle);
    setNotice({ kind: 'ok', text: `Imported ${bundle.profile.name}. Tap "Switch to ${bundle.profile.name}" to play as them.` });
  };
  const chooseImport = async (e: Event) => {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    setNotice(null);
    setBusy(true);
    try {
      const bundle = await readProfileZip(file);
      if (profiles.some((p) => p.id === bundle.profile.id)) setConflict(bundle);
      else await finishImport(bundle);
    } catch (err) {
      console.warn('[import]', err);
      setNotice({
        kind: 'error',
        text: err instanceof ImportError ? err.message : "That file couldn't be imported. Try exporting it again.",
      });
    } finally {
      setBusy(false);
    }
  };
  const existing = conflict && profiles.find((p) => p.id === conflict.profile.id);

  return (
    <div key="home" class="parent" role="dialog" aria-modal="true" aria-labelledby="parent-title">
      <div class="parent-wrap">
        <h1 id="parent-title">Parent area</h1>
        {notice && (
          <p class={notice.kind === 'error' ? 'parent-error' : 'parent-ok'} role={notice.kind === 'error' ? 'alert' : 'status'}>
          {notice.text}
          </p>
        )}

        <section class="parent-card">
          <h2>Play session</h2>
          <p>{status}</p>
          <div class="pbtn-row">
            {locked ? (
              <button class="pbtn pbtn--primary" onClick={onNewSession}>Start a new session</button>
            ) : (
              <>
                <button class="pbtn pbtn--primary" onClick={onBack}>Back to play</button>
                <button class="pbtn" onClick={onNewSession}>Restart the timer</button>
                <button class="pbtn" onClick={onEndNow}>End session now</button>
              </>
            )}
          </div>
        </section>

        <section class="parent-card" aria-labelledby="profiles-title">
          <h2 id="profiles-title">Profiles</h2>
          {conflict && existing && (
            <div class="parent-callout" role="alert">
              <p>
                <strong>{existing.name}</strong> is already on this device. Replace it with the copy from the file, or keep both?
              </p>
              <div class="pbtn-row">
                <button class="pbtn pbtn--primary" onClick={() => finishImport(conflict)}>Replace {existing.name}</button>
                <button class="pbtn" onClick={() => finishImport(asCopy(conflict))}>Keep both</button>
                <button class="pbtn" onClick={() => setConflict(null)}>Cancel</button>
              </div>
            </div>
          )}
          <ul class="profile-list">
            {profiles.map((p) => {
              const active = p.id === profile.id;
              return (
                <li key={p.id} class="profile-row" data-profile={p.id}>
                  <div class="profile-who">
                    <Avatar profile={p} content={content} class="avatar--sm" />
                    <div>
                      <div class="prow-title">{p.name}</div>
                      <div class="parent-muted prow-note">
                        {BAND_LABEL[p.ageBand]} · {limitLabel(p.sessionLimit)}
                        {active && <strong class="badge">Playing now</strong>}
                      </div>
                    </div>
                  </div>
                  <div class="pbtn-row">
                    {!active && (
                      <button class="pbtn pbtn--primary" onClick={() => { setNotice(null); props.onSwitch(p); }}>
                        Switch to {p.name}
                      </button>
                    )}
                    <button class="pbtn" onClick={() => setRoute({ name: 'edit', id: p.id })}>Edit</button>
                    {exported?.id === p.id ? (
                      <button class="pbtn pbtn--primary" onClick={share}>Share file</button>
                    ) : (
                      <button class="pbtn" disabled={busy} onClick={() => prepareExport(p)}>Export</button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          <div class="pbtn-row">
            <button class="pbtn" onClick={() => setRoute({ name: 'edit', id: null })}>Add a profile</button>
            <label class={`pbtn pbtn--file${busy ? ' is-disabled' : ''}`}>
              Import a profile
              <input type="file" accept=".zip,application/zip" disabled={busy} onChange={chooseImport} />
            </label>
          </div>
          <p class="parent-muted">
            Export makes a .zip file you can send with AirDrop, WhatsApp or email. Import it on another iPad or iPhone
            to bring the profile across.
          </p>
        </section>

        <section class="parent-card">
          <h2>This device</h2>
          <div class="prow">
            <div class="prow-text">
              <div class="prow-title">Profile picker for children</div>
              <div class="parent-muted prow-note">
                After the play button, show each child's picture so they can choose. Needs two or more profiles.
              </div>
            </div>
            <Switch
              on={device.picker}
              label="Profile picker for children"
              onChange={(picker) => props.onDevice({ ...device, picker })}
            />
          </div>
          <div class="prow">
            <div class="prow-text">
              <div class="prow-title">Parent PIN</div>
              <div class="parent-muted prow-note">
                {device.pin ? 'On. The PIN is asked for instead of "tap a number".' : 'Off. Grown-ups tap a number to get in.'}
              </div>
            </div>
          </div>
          <div class="pbtn-row">
            <button class="pbtn" onClick={() => setRoute({ name: 'pin' })}>{device.pin ? 'Change PIN' : 'Set a PIN'}</button>
            {device.pin && (
              <button
                class="pbtn"
                onClick={() => props.onDevice({ ...device, pin: null })}
              >
                Remove PIN
              </button>
            )}
          </div>
        </section>

        <section class="parent-card">
          <h2>Install on iPad or iPhone</h2>
          <ol>
            <li>Open this page in Safari.</li>
            <li>Tap the Share button, then <strong>Add to Home Screen</strong>.</li>
            <li>Open the app from its new home screen icon while online once. After that it works with no internet.</li>
          </ol>
          <p class="parent-muted">{isStandalone ? 'Running as an installed app.' : 'Running in the browser, not yet installed.'}</p>
        </section>

        <section class="parent-card">
          <h2>Lock the device to this app</h2>
          <ol>
            <li>Open <strong>Settings → Accessibility → Guided Access</strong> and turn it on. Set a passcode.</li>
            <li>Open this app, then triple-click the top (or Home) button and tap <strong>Start</strong>.</li>
            <li>To finish, triple-click again and enter the passcode.</li>
          </ol>
        </section>
      </div>
    </div>
  );
}
