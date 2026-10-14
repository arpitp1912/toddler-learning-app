import { useCallback, useEffect, useMemo, useState } from 'preact/hooks';
import { itemById, itemsIn, loadContent, SUPPORTED_MODULES, type Category, type Content, type Item } from './content';
import { loadProfile, requestPersistence, saveProfile, type Profile, type SessionLimit } from './db';
import { stopAll, unlockAudio } from './audio';
import { useSession, WARNING_MS } from './session';
import { TapToStart } from './components/TapToStart';
import { Home } from './components/Home';
import { Cards } from './components/Cards';
import { Peekaboo } from './components/Peekaboo';
import { Bubbles } from './components/Bubbles';
import { FadingSun, Goodbye, Lock } from './components/SessionEnd';
import { ParentCheck, ParentCorner } from './components/ParentGate';
import { ParentPanel } from './components/ParentPanel';

type View = { name: 'home' } | { name: 'cards'; categoryId: string } | { name: 'peekaboo' } | { name: 'bubbles' };

/** Home tile ids for the modes in `profile.modules`, alongside category ids. */
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
  const [view, setView] = useState<View>({ name: 'home' });
  const [parent, setParent] = useState<ParentStep>(null);

  const session = useSession(profile, parent !== null);

  useEffect(() => {
    loadContent().then(setContent, (err) => {
      console.error('[content]', err);
      setFailed(true);
    });
    loadProfile().then(setProfile);
  }, []);

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

  // Peekaboo and Bubbles draw items from every category the profile has enabled.
  const mixedItems = useMemo(
    () => (content ? categories.flatMap((c) => itemsIn(content, c.id)) : []),
    [content, categories],
  );
  const modeOn = (id: string) =>
    !!profile && (profile.modules == null || profile.modules.includes(id)) && mixedItems.length > 0;
  const peekabooOn = modeOn(PEEKABOO);
  const bubblesOn = modeOn(BUBBLES);
  const soundHint = profile?.peekabooSoundHint ?? content?.defaults?.peekabooSoundHint ?? false;
  const bubbleSpeed = profile?.bubbleSpeed ?? content?.defaults?.bubbleSpeed ?? 'slow';

  const start = () => {
    unlockAudio();
    void requestPersistence();
    setView({ name: 'home' });
    session.start();
  };
  const goHome = () => {
    stopAll();
    setView({ name: 'home' });
  };

  const openGate = useCallback(() => setParent('check'), []);
  const closeParent = useCallback(() => setParent(null), []);
  const passCheck = useCallback(() => setParent('panel'), []);

  const setLimit = (sessionLimit: SessionLimit) => {
    if (!profile) return;
    const next = { ...profile, sessionLimit };
    setProfile(next);
    void saveProfile(next);
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
      screen = <TapToStart decor={decorItems(content, 'start')} onStart={start} />;
      break;
    case 'goodbye':
      screen = <Goodbye decor={decorItems(content, 'goodbye')} />;
      break;
    case 'locked':
      screen = <Lock />;
      break;
    default:
      screen =
        view.name === 'cards' && deck.length ? (
          <Cards key={view.categoryId} items={deck} onHome={goHome} />
        ) : view.name === 'peekaboo' && peekabooOn ? (
          <Peekaboo items={mixedItems} soundHint={soundHint} onHome={goHome} />
        ) : view.name === 'bubbles' && bubblesOn ? (
          <Bubbles items={mixedItems} speed={bubbleSpeed} spawning={!warning} onHome={goHome} />
        ) : (
          <Home
            categories={categories}
            onOpen={(c) => setView({ name: 'cards', categoryId: c.id })}
            onPeekaboo={peekabooOn ? () => setView({ name: 'peekaboo' }) : undefined}
            onBubbles={bubblesOn ? () => setView({ name: 'bubbles' }) : undefined}
          />
        );
  }

  return (
    <>
      {screen}
      {warning && <FadingSun remainingMs={session.remainingMs!} />}
      {session.phase !== 'goodbye' && <ParentCorner onOpen={openGate} showHint={session.phase === 'locked'} />}
      {parent === 'check' && <ParentCheck onPass={passCheck} onCancel={closeParent} />}
      {parent === 'panel' && (
        <ParentPanel
          profile={profile}
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
          onLimit={setLimit}
        />
      )}
    </>
  );
}
