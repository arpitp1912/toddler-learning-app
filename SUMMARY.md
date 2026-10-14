# Branch summary: `feature/bubbles`

This branch was created from `feature/peekaboo`, which isn't merged into main yet, so that both mode tiles land without conflicts. It contains the Peekaboo work (see the section below) plus the Bubbles mode. Neither is merged into main.

# Bubbles mode

## What was built
- **Bubbles screen** (`src/components/Bubbles.tsx`) over a sky gradient (`--c-sky-top` to `--c-sky-bottom`). It shows 4 bubbles on iPad and 3 on iPhone, chosen by whether the short edge is at least 600 px. The diameter is max(160 px, 28% of the short edge), with a hit area 15% larger (229 px and 264 px on a 1180×820 iPad, 160 px and 184 px on iPhone).
- **Motion:** a single `requestAnimationFrame` loop writes each bubble's `translate3d` directly. Preact only re-renders when a bubble is added or removed. Only transform and opacity ever animate.
- **Lanes:** they sit to the right of the home button, about half a bubble apart. All bubbles rise at the same speed, so the vertical gaps never change. A bubble only enters at the bottom when it can't touch any bubble whose path it shares (lanes closer than one hit-area width plus the sway). This keeps them apart even on iPhone portrait, where three lanes can't sit side by side.
- **Pop:** on `pointerdown`, so each finger pops its own bubble. The burst is an expanding ring plus 8 droplets in 280 ms. `popSound()` in `audio.ts` synthesises a sine blip that falls from 720 to 240 Hz over 0.14 s. The item stays in place, bounces, plays its word and then its sound through the same `sayItem` as Cards, and fades out after 1.5 s. A new bubble comes 0.5 s later. `sayItem` stops the previous item's audio, so item audio never overlaps. The blip is a separate effect and isn't cut off.
- **Items:** `src/items.ts` now holds the shuffle bag shared with Peekaboo. It skips items already on screen, whether in a bubble or popped, and gives no repeats until the pool is used up.
- **Home tile:** three bubbles with a duck in the largest (`BubblesIcon` in `icons.tsx`), on a sky tile.
- **Tests:** `tests/bubbles.spec.ts`, run with `npm test`. They run in WebKit and Chromium at 1180×820 and 390×844 and check that:
  - the correct bubble count (4 or 3) shows, at the right size;
  - bubbles never overlap and never pass left of the home button (sampled while they rise);
  - a pointerdown pops a bubble, with the burst, the synthesised blip and the item's word;
  - a new bubble with a new id arrives, and the popped item clears;
  - no two bubbles show the same item, and there are no console errors;
  - two fingers pop two bubbles (Chromium, multi-touch via the DevTools protocol);
  - under reduced motion the bubbles stay still and the replacement fades into the same spot;
  - no new bubble appears once the one-minute warning is on.
- **Frame rate:** with Chromium's CPU throttled 4×, the median and 95th-percentile frame times were 16.7 ms (60 fps). That's only an approximation, so please check on a real older iPad.

## Decisions
- **Speed setting:** there's no profile settings screen yet. Speed reads `profile.bubbleSpeed` first, then `defaults.bubbleSpeed` in `content.json` (`"slow"`). Slow takes 10 s from bottom to top and normal takes 6 s. To try normal, set the default to `"normal"` and redeploy. The profile editor (M2) should add the toggle.
- **Tile count:** the SPEC asks for 4–5 home tiles, but nothing in the code enforces a limit. The home now shows 6 tiles by default (4 categories plus Peekaboo and Bubbles). They fit in 2 rows of 3 on iPad and 3 rows of 2 on iPhone. A profile's `modules` list can hide tiles (`bubbles` is the tile id). I didn't add a hard cap because it would have to pick which tile to drop. This is logged in SPEC 14a.
- **Parent-gate corner:** bubbles avoid the home button but may pass under the parent-gate corner (top right). Avoiding both corners leaves too little width on iPhone portrait. A tap there reaches the gate for that moment, but the bubble keeps rising.
- **Opening the screen:** it starts full, with the bubbles spread up the screen, rather than empty for the first few seconds.
- **During the one-minute warning:** no new bubbles appear, including respawns from the top. Bubbles already showing stay until they leave or are popped. Opening Bubbles during the warning still shows the first set of bubbles.
- **Reduced motion:** a 2×2 grid on iPad and a single column of 3 on iPhone portrait. The replacement fades in once the popped item has faded (about 1.8 s) rather than at 0.5 s, so two items never overlap in the same spot.
- **Device type:** "iPad" vs "iPhone" is decided by the short edge (600 px or more counts as iPad), not by the user agent. Rotating the device re-lays out the bubbles.
- **Test port:** Playwright now uses port 4174, so a manual preview on 4173 (or a tunnel to it) can keep running.

## What to test on the iPad
1. Home shows 6 tiles. The new sky tile shows three bubbles with a duck. Check landscape and portrait.
2. Open Bubbles. There should be 4 bubbles (3 on iPhone), each clearly larger than a fingertip. They rise slowly, taking about 10 s, with a slight sway, and never touch or pass under the home button.
3. Pop one. You should hear a soft pop at once, see a ring and droplets, and see the item stay and bounce. Then you hear the word and the sound twice, and the item fades after about 1.5 s. A new bubble rises from the bottom about half a second later.
4. Pop two bubbles at once with two fingers. Both pop. Only the second item's word and sound play, and the first stops straight away.
5. Pop several quickly. Item audio never overlaps, and the pops still sound.
6. Watch for 30 s or more. The motion should stay smooth on the older iPad, with no stutter as bubbles respawn. The same item should never appear in two bubbles at once.
7. Turn on Reduce Motion. The bubbles sit still in a grid. Popping one leaves the item, and a new bubble fades into the same spot once the item has faded.
8. Set the time limit to 5 min in the parent area and wait for the sun. Bubbles stop being replaced, and at the limit the goodbye plays.
9. Set `defaults.bubbleSpeed` to `"normal"` in `content.json` and redeploy. Bubbles should rise in about 6 s.
10. Tap a bubble while it passes under the top-right corner. Nothing pops, which is expected; it pops once it has risen past. Note whether this feels wrong in practice.
11. Rotate the iPad while playing. The bubbles re-lay out without overlapping.
12. Airplane mode after one online launch: Bubbles still plays.

# Peekaboo mode

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
