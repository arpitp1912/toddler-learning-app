import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { avatarItems, itemById, itemsIn, loadContent, SUPPORTED_MODULES, type Category, type Content, type Item } from './content';
import {
  LOOK, deleteProfile, listProfiles, loadDeviceSettings, loadProfile, putImported, requestPersistence,
  saveDeviceSettings, setLastProfile, type DeviceSettings, type Profile,
} from './db';
import type { ProfileBundle } from './backup';
import { forgetPhotoUrl } from './photos';
import { setBuiltInPrompts, stopAll, unlockAudio } from './audio';
import { useSession, WARNING_MS } from './session';
import { TapToStart } from './components/TapToStart';
import { Home, Look } from './components/Home';
import { Cards } from './components/Cards';
import { Peekaboo } from './components/Peekaboo';
import { Bubbles } from './components/Bubbles';
import { Guess } from './components/Guess';
import { soundPool, usableKinds, wordPool } from './rounds';
import { FadingSun, Goodbye, Lock } from './components/SessionEnd';
import { ParentCheck, ParentCorner } from './components/ParentGate';
import { ParentPanel } from './components/ParentPanel';
import { ProfilePicker } from './components/ProfilePicker';

type View =
  | { name: 'home' }
  | { name: 'look' }
  | { name: 'cards'; categoryId: string }
  | { name: 'peekaboo' }
  | { name: 'bubbles' }
  | { name: 'guess' };

/** Home tile ids in `profile.modules`, alongside Look's category ids (Guess has its own switch). */
const PEEKABOO = 'peekaboo';
const BUBBLES = 'bubbles';
type ParentStep = null | 'check' | 'panel';

function decorItems(content: Content, key: 'start' | 'goodbye'): Item[] {
  const ids = content.decor?.[key];
  const found = ids?.map((id) => itemById(content, id)).filter((i): i is Item => !!i);
  return found?.length ? found : content.items.slice(0, 2);
}

export function App() {
  const [content, setContent] = useState<Content | null>(null);
  const [failed, setFailed] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [device, setDevice] = useState<DeviceSettings>({ picker: false, pin: null });
  const [view, setView] = useState<View>({ name: 'home' });
  const [parent, setParent] = useState<ParentStep>(null);
  // Toddler picker showing (after tap to start), and a pick waiting for its profile's session to load.
  const [picking, setPicking] = useState(false);
  const startOnLoad = useRef(false);

  const session = useSession(profile, parent !== null);

  const refreshProfiles = useCallback(() => listProfiles().then(setProfiles), []);

  useEffect(() => {
    loadContent().then(
      async (c) => {
        setContent(c);
        setBuiltInPrompts(c.prompts);
        setProfile(await loadProfile(avatarItems(c)[0]?.id ?? ''));
        await refreshProfiles();
      },
      (err) => {
        console.error('[content]', err);
        setFailed(true);
      },
    );
    loadDeviceSettings().then(setDevice);
  }, []);

  // A child picked a different face: start play once that profile's session has loaded.
  useEffect(() => {
    if (!startOnLoad.current) return;
    if (session.phase === 'start') {
      startOnLoad.current = false;
      session.start();
    } else if (session.phase === 'locked') startOnLoad.current = false;
  }, [session.phase]);

  // Look's categories, in content.json order.
  const categories = useMemo<Category[]>(() => {
    if (!content || !profile) return [];
    return content.categories.filter(
      (c) =>
        SUPPORTED_MODULES.has(c.module) &&
        (profile.modules == null || profile.modules.includes(c.id)) &&
        itemsIn(content, c.id).length > 0,
    );
  }, [content, profile]);

  const deck = useMemo(
    () => (content && view.name === 'cards' ? itemsIn(content, view.categoryId) : []),
    [content, view],
  );

  // Peekaboo, Bubbles and Guess draw items from every category the profile has enabled.
  const mixedItems = useMemo(
    () => (content ? categories.flatMap((c) => itemsIn(content, c.id)) : []),
    [content, categories],
  );
  const modeOn = (id: string) =>
    !!profile && (profile.modules == null || profile.modules.includes(id)) && mixedItems.length > 0;
  const lookOn = modeOn(LOOK);
  const peekabooOn = modeOn(PEEKABOO);
  const bubblesOn = modeOn(BUBBLES);
  const soundHint = profile?.peekabooSoundHint ?? content?.defaults?.peekabooSoundHint ?? false;
  const bubbleSpeed = profile?.bubbleSpeed ?? content?.defaults?.bubbleSpeed ?? 'slow';

  // Guess: shown when the profile (or content defaults) turns it on and at least
  // one of its chosen round types has two usable items in the enabled categories.
  // Its own switch, not the tile list, decides (as "Who says that?" did before it).
  const soundItems = useMemo(() => soundPool(mixedItems), [mixedItems]);
  const wordItems = useMemo(() => wordPool(mixedItems), [mixedItems]);
  const guessRounds = profile?.guessRounds ?? content?.defaults?.guessRounds ?? 'both';
  const guessKinds = useMemo(() => usableKinds(guessRounds, soundItems, wordItems), [guessRounds, soundItems, wordItems]);
  const guessOn = (profile?.guess ?? content?.defaults?.guess ?? false) && guessKinds.length > 0;
  const guessChoices = profile?.guessChoices ?? content?.defaults?.guessChoices ?? 2;

  const showPicker = device.picker && profiles.length > 1;
  const start = () => {
    unlockAudio();
    void requestPersistence();
    setView({ name: 'home' });
    if (showPicker) setPicking(true);
    else session.start();
  };
  const switchTo = (p: Profile) => {
    stopAll();
    setView({ name: 'home' });
    setPicking(false);
    void setLastProfile(p.id);
    setProfile(p);
  };
  const pick = (p: Profile) => {
    setPicking(false);
    if (p.id === profile?.id) return session.start();
    startOnLoad.current = true;
    switchTo(p);
  };
  const goHome = () => {
    stopAll();
    setView({ name: 'home' });
  };

  const openGate = useCallback(() => setParent('check'), []);
  const closeParent = useCallback(() => setParent(null), []);
  const passCheck = useCallback(() => setParent('panel'), []);

  const changeDevice = (next: DeviceSettings) => {
    setDevice(next);
    void saveDeviceSettings(next);
  };
  const pinForgotten = useCallback(() => {
    setDevice((d) => {
      const next = { ...d, pin: null };
      void saveDeviceSettings(next);
      return next;
    });
    setParent('panel');
  }, []);

  const profileSaved = (p: Profile) => {
    if (p.id === profile?.id) setProfile(p);
    void refreshProfiles();
  };
  const profileDeleted = async (p: Profile) => {
    if (p.avatarPhoto) forgetPhotoUrl(p.avatarPhoto);
    await deleteProfile(p.id);
    const rest = await listProfiles();
    setProfiles(rest);
    if (p.id === profile?.id && rest[0]) switchTo(rest[0]);
  };
  const imported = async ({ profile: p, photos }: ProfileBundle) => {
    const old = profiles.find((x) => x.id === p.id);
    if (old?.avatarPhoto) forgetPhotoUrl(old.avatarPhoto);
    await putImported(p, photos);
    // Replacing the profile that is playing: show its imported settings straight away.
    if (p.id === profile?.id) setProfile(p);
    await refreshProfiles();
  };

  if (failed) {
    // Content could not load (first visit while offline). No text for the child:
    // a tap anywhere retries.
    return <div class="screen boot" onClick={() => location.reload()} />;
  }
  if (!content || !profile || session.phase === 'boot') return <div class="screen boot" />;

  const warning =
    session.phase === 'play' && session.remainingMs != null && session.remainingMs <= WARNING_MS;

  let screen;
  switch (session.phase) {
    case 'start':
      screen =
        picking && showPicker ? (
          <ProfilePicker profiles={profiles} content={content} onPick={pick} />
        ) : (
          <TapToStart decor={decorItems(content, 'start')} onStart={start} />
        );
      break;
    case 'goodbye':
      screen = <Goodbye decor={decorItems(content, 'goodbye')} />;
      break;
    case 'locked':
      screen = <Lock />;
      break;
    default:
      screen =
        view.name === 'look' && lookOn ? (
          <Look categories={categories} onOpen={(c) => setView({ name: 'cards', categoryId: c.id })} onHome={goHome} />
        ) : view.name === 'cards' && deck.length ? (
          <Cards key={view.categoryId} items={deck} onHome={goHome} />
        ) : view.name === 'peekaboo' && peekabooOn ? (
          <Peekaboo items={mixedItems} soundHint={soundHint} onHome={goHome} />
        ) : view.name === 'bubbles' && bubblesOn ? (
          <Bubbles items={mixedItems} speed={bubbleSpeed} spawning={!warning} onHome={goHome} />
        ) : view.name === 'guess' && guessOn ? (
          <Guess
            key={`${guessKinds.join()}-${guessChoices}`}
            soundItems={soundItems}
            wordItems={wordItems}
            kinds={guessKinds}
            choices={guessChoices}
            onHome={goHome}
          />
        ) : (
          <Home
            onLook={lookOn ? () => setView({ name: 'look' }) : undefined}
            onPeekaboo={peekabooOn ? () => setView({ name: 'peekaboo' }) : undefined}
            onBubbles={bubblesOn ? () => setView({ name: 'bubbles' }) : undefined}
            onGuess={guessOn ? () => setView({ name: 'guess' }) : undefined}
          />
        );
  }

  return (
    <>
      {screen}
      {warning && <FadingSun remainingMs={session.remainingMs!} />}
      {session.phase !== 'goodbye' && <ParentCorner onOpen={openGate} showHint={session.phase === 'locked'} />}
      {parent === 'check' && (
        <ParentCheck pin={device.pin} onPass={passCheck} onCancel={closeParent} onPinForgotten={pinForgotten} />
      )}
      {parent === 'panel' && (
        <ParentPanel
          content={content}
          profile={profile}
          profiles={profiles}
          device={device}
          locked={session.phase === 'locked' || session.phase === 'goodbye'}
          elapsedMs={session.elapsedMs}
          onBack={closeParent}
          onNewSession={() => {
            unlockAudio();
            setView({ name: 'home' });
            session.resumeFresh();
            setParent(null);
          }}
          onEndNow={() => {
            stopAll();
            setParent(null);
            session.endNow();
          }}
          onSwitch={switchTo}
          onSaved={profileSaved}
          onDelete={profileDeleted}
          onImport={imported}
          onDevice={changeDevice}
        />
      )}
    </>
  );
}
