# Peekaboo mode: summary

Branch: `feature/peekaboo` (not merged to main).

## What was built
- **Peekaboo screen** (`src/components/Peekaboo.tsx`). One cover sits over an item, at the same size and position as the item on a Card. That is about 68% of the short edge on iPad, 63% on a 1024×768 iPad and 87% of the width on iPhone portrait. Each new cover says "peekaboo" as it appears, then wiggles every 3 s while waiting. Tapping it opens it (450 ms), then the app says the word, plays the item's sound and then bounces the item. Tapping the item replays the word and sound. An edge tap or a swipe closes a new cover (400 ms) over the next item.
- **Covers** (`src/components/covers.tsx`). Bush, door, cloud and blanket, drawn in inline SVG using the colour tokens. They rotate in that order each round. Under reduced motion the cover cross-fades instead of moving, and the idle wiggle is off.
- **Home tile**: a bush with two eyes peeking, drawn in SVG (`PeekabooIcon` in `icons.tsx`).
- **Audio** (`src/audio.ts`): `sayPeekaboo` plays the "peekaboo" prompt as a cover appears, followed by the sound hint at 40% volume when it's on. The reveal uses the same `sayItem` as Cards: the word clip, or text-to-speech if there's no clip, then the sound twice. A clip that is stopped while it's still loading no longer starts late, which also helps Cards.
- **Swipe** is now a shared hook (`src/swipe.ts`) used by both Cards and Peekaboo. Cards behave as before.
- **Tests**: `npm test` runs the Playwright smoke tests (`tests/peekaboo.spec.ts`) against the production build. They run in WebKit and Chromium at 1180×820 and 390×844. They check that Peekaboo opens, that the cover is at least 60% of the short edge, that "peekaboo" is said as the cover appears, and that a double tap on the cover then says the item's word exactly once. They also check that an edge tap and a swipe each bring a new covered item, that reduced motion still reveals the item, and that there are no console errors.

## Decisions
- **Peekaboo is a home tile with the id `peekaboo` in `profile.modules`**, which is the existing per-profile tile list. There's no parent screen yet for choosing tiles (it's planned for M2), so the tile shows for every profile until that screen exists. A profile with a `modules` list that leaves out `peekaboo` hides it. The tile also hides when no item categories are enabled.
- **The sound hint has no settings screen yet.** It reads `profile.peekabooSoundHint` first, then `defaults.peekabooSoundHint` in `content.json` (set to `false`). To try it, set the default to `true` and redeploy. The profile editor (M2) should add the toggle.
- **The "peekaboo" voice-pack clip** is read from a prompt registry in `audio.ts` (`setPromptClip('peekaboo', path)`). Voice packs don't exist yet (M5), so the registry is empty and the device voice always says "peekaboo" for now. SPEC 8a now lists "Peekaboo" next to "Where's the…".
- **Both edges and both swipe directions bring a new cover.** The order is random, so there's no "previous" item to go back to.
- **Timing of the bounce.** The bounce comes after the reveal audio, as the request specified. Tapping the revealed item bounces it straight away, as on Cards.
- **"Peekaboo" is said when each cover appears**, not when it's tapped (changed after first testing). The reveal audio starts once the cover has finished opening, so the word lines up with the item appearing (about 450 ms after the tap).
- **Tapping Next on a closed cover** (before it has been opened) swaps in a new cover and item straight away with a short pop, since there is nothing to close.
- **Item pool.** Items come from every enabled category whose module is `cards`. Scene images are never used. A new item is never the same as the one just shown, even when the shuffle starts over.
- Playwright (`@playwright/test`) is a new dev dependency. It never runs in the app.

## What to test on the iPad
1. Home shows the lilac Peekaboo tile (bush with eyes) after the four category tiles. Check it in landscape and portrait.
2. "Peekaboo" is said as the cover appears, then the cover wiggles gently about every 3 s while you wait.
3. Tap the cover. It opens in under half a second, then you hear the word and the sound twice, and then the item bounces.
4. Tap the cover 2–3 times quickly while it opens. The word should play only once.
5. Tap the revealed item. The word and sound replay and the item bounces.
6. Tap the right or left edge, or swipe. A new cover closes over a different item and says "peekaboo". Repeat at least four times to see the bush, door, cloud and blanket in turn, and check that the motion looks smooth.
7. Keep going through more than 46 items (all enabled categories). No item should repeat until all have been shown.
8. Turn on Settings → Accessibility → Motion → Reduce Motion. The wiggle stops and the covers fade instead of moving.
9. Sound hint: set `defaults.peekabooSoundHint` to `true` in `content.json` and redeploy. A quiet sound should play after "peekaboo" when each new cover appears.
10. Check the time limit and fading sun still appear over Peekaboo, and that the home button returns to Home and stops the audio.
11. Check offline. After one online launch, turn on airplane mode and play Peekaboo.
