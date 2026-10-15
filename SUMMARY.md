# Branch summary: `feature/who-says`

This branch was created from `main`, which already has Peekaboo and Bubbles. It adds the "Who says that?" mode, and `feature/m2-profiles` (profiles, export/import, toddler picker, PIN) is merged in so both can be tested together. Neither is merged into main.

# Who says that?

## What was built
- **Content** (`public/content/content.json`):
  - Every item now has `guessable`. It's true for all animals except fish, and for car, clock, phone and door.
  - `confusableWith` seeds goat↔sheep, crow↔parrot, car↔bus and car↔motorbike. The rule is read both ways, so each pair is listed on one item only.
  - New defaults: `whoSays: true` and `whoSaysChoices: 2`. The mode was first built off by default, then switched on after local testing.
- **Round generation** (`src/rounds.ts`). This is pure logic, with no screen or audio code.
  - Only items with `guessable: true` and a `soundAudio` are used.
  - Targets come from a shuffle bag: every item is used before any repeats, and the same target never comes twice in a row, even when the bag refills.
  - Distractors come from a different category first. Nothing on screen is ever confusable with anything else on screen.
  - The target's position is random, but never in the same slot three rounds running, and slot counts stay within two of each other.
- **Screen** (`src/components/WhoSays.tsx`):
  - Choices sit side by side on paper discs, with a large ear button at the top centre.
  - **Right tap:** the item bounces with 8 sparks (700 ms), then says its word and sound. The other items fade to 30%, and the answer gets a butter-coloured disc.
  - **Wrong tap:** the item wiggles, says its word and plays its own sound once. After a 0.5 s pause, the target sound plays again.
  - **Next round:** both edge zones and swipes in either direction bring a new round, as in Peekaboo. The next round's images and audio preload in advance.
- **Audio** (`src/audio.ts`): `sayListen`, `replaySound` and `sayWrong`. Each one stops the current audio first, so taps during audio are accepted and nothing overlaps. A tap before "Listen!" starts cancels it. "Listen!" uses the voice-pack prompt `listen` when one is registered, and the device voice otherwise.
- **Home tile** (`WhoSaysIcon`): a cow, sound waves and an ear, all in SVG, on a peach tile.
- **Tests:**
  - **Unit:** `src/rounds.test.ts`, run with `npm run test:unit` (Vitest is a new dev dependency). It runs 100 rounds with 5 seeds, for 2 and 3 choices, against both the real `content.json` pool and a mixed test pool with all the confusable pairs. It checks that confusable items never appear together, that no target repeats in consecutive rounds and the pool is used fully each cycle, that no slot is used three times in a row and slot counts stay within 2, and that distractors come from another category when possible. 82 tests pass.
  - **Browser:** `tests/whosays.spec.ts`, run with `npm run test:e2e`. It runs in WebKit and Chromium at 1180×820 and 390×844, 28 tests in all. It checks that:
    - the tile is hidden when the mode is turned off;
    - the mode loads with "Listen!" then the sound;
    - the choices meet the size rules and never overlap the edge zones or the ear;
    - the ear button replays the sound;
    - a right tap and a wrong tap both play audio;
    - an edge tap, the other edge and a swipe each give a new round with a new target;
    - three choices fit;
    - there are no console errors.

    The browser tests stub audio decoding with short silent buffers, because Playwright's Chromium can't decode AAC.
- **Scripts:** `npm test` now runs the unit tests and then Playwright. All 74 browser tests pass (Peekaboo, Bubbles, profiles and Who says that?).

## Decisions (also in SPEC 14a)
- **Profile settings.** Since M2 was merged into this branch, the profile editor has a "Who says that?" switch with the other home tiles, and a "2 / 3 to choose from" choice while it's on. The mode reads `profile.whoSays` and `profile.whoSaysChoices` first, then the `content.json` defaults. Backups carry both settings.
- **The tile follows its own switch, not the tile list.** Tile lists saved by the M2 editor before this mode existed don't include it, so letting the list decide would have hidden the tile for those profiles.
- **The mode is on for every profile** through `defaults.whoSays: true`. To hide it, set that to `false` and redeploy. Set `defaults.whoSaysChoices` to `3` to try three choices.
- **Three choices can't each be 35% of the iPad width.** That would need 105%. They share the width between the edge zones, at about 22% each (260 px on a 1180 iPad, well over 160 px). With two choices the edge zones narrow from 180 to 171 design px, so both items reach exactly 35% with no overlap.
- **Seven tiles on iPad.** There's no maximum-tile rule in the code. Six tiles fit in two rows of three, but seven needed three rows, which got cut off in landscape. So more than six tiles now switch to four per row, at 260 design px each, in landscape only. On iPhone portrait the seven tiles already fit in a 2-column grid, with the seventh spanning the full width.
- **Sound repeats.** The target sound plays twice, matching the 2026-10-14 decision. A wrong item's own sound plays once, to keep the detour short before the target sound comes back.
- **After the right answer,** the faded items still respond when tapped, saying their own name and sound, so every tap gets a response. Tapping the answer again repeats the celebration.
- **The pool today is the 16 animals other than fish.** Car, clock, phone and door have no sound clips yet. Bus, train, aeroplane, motorbike, fire truck, boat and bell aren't in the content. The bus↔fire truck pair needs adding when those items arrive.

## What to test on the iPad
1. Home shows a 7th tile, a peach one with a cow and an ear. In landscape all tiles should fit in two rows of four and three. Check portrait too.
2. Open it. Two animals appear, each about a third of the screen wide. About 0.3 s later you hear "Listen!", then one animal's sound twice.
3. Tap the ear button at the top. The sound plays again.
4. Tap the wrong animal. It wiggles, says its name and makes its own sound once, then the right sound plays again. There's no buzzer and no red.
5. Tap the right animal. It bounces with a short sparkle, says its name and makes its sound, and the other animal fades.
6. Tap quickly between the two animals and the ear while sound is playing. Each tap cuts off the last sound, and you never hear two at once.
7. Tap an edge, or swipe. You get a new pair with a different target each time. Over 10 or more rounds, the answer shouldn't sit on the same side three times in a row. Goat and sheep, and crow and parrot, never appear together.
8. Set `defaults.whoSaysChoices: 3` and redeploy. Three animals appear, still easy to tap, and none sits under the arrows.
9. Turn on Reduce Motion. A gentle grow-and-fade replaces the bounce, wiggle and sparkle, and a soft honey ring stands in for the sparkle.
10. Check the time limit. The sun cue and the goodbye still appear over this mode, and the home button stops the audio.
11. Turn on airplane mode after one online launch. The mode still plays.
12. Try it with your child. Note whether two items is right at 20 months, and whether "Listen!" before the sound helps or gets in the way.

# Profiles (M2)

Merged in from `feature/m2-profiles`. Milestone M2 (SPEC section 14): profiles and export/import, plus the toddler profile picker and the parent PIN from the settings list in SPEC section 8. Branched from `main` after Peekaboo and Bubbles were merged.

## What was built
- **Profiles** (`src/db.ts`). There's no limit on how many profiles a device can hold. The app opens into the last-used profile, and the first run still creates the `default` profile. The database moves to version 2, which adds a `photos` table. Deleting a profile also removes its session and photos. You can't delete the last profile.
- **Parent home** (screen 11, `ParentPanel.tsx`):
  - The play session card, which now names the profile that's playing.
  - A profile list. Each row has the avatar, name, age band and time limit, with a "Playing now" badge on the active profile and Switch, Edit and Export buttons.
  - Add a profile and Import a profile buttons.
  - A "This device" card with the profile picker switch and the PIN.
  - The install and Guided Access help as before.
- **Profile editor** (screen 12, `ProfileEditor.tsx`). Changes are kept in a draft until you tap Save or Add profile; Cancel discards them. It has:
  - **Picture:** take or choose a photo, which is cropped to a 512 px square JPEG, or pick a preset animal. The presets come from `decor.avatars` in `content.json`.
  - **Name and age band.**
  - **Home tiles:** one switch per category, plus Peekaboo and Bubbles.
  - **Time limit**, which moved here from the parent home because it's per profile.
  - **Peekaboo sound hint and Bubbles speed.** Each shows the `content.json` default until it's changed.
  - **Find it:** the switch is saved, but the game itself comes in M5.
  - **Delete,** with a confirmation inside the app.
- **Switching** (`session.ts`, `App.tsx`). Each profile has its own session clock and lock. While a newly chosen profile's session loads, the phase reads as `boot`, so the old profile's timer can't run against the new profile or be saved under it.
- **Toddler picker** (screen 9, `ProfilePicker.tsx`). This is off by default. When it's on and there are two or more profiles, big round faces appear after the play button. They're sized in short-edge units, so they stay at least 160 px on iPad and at least 25% of the short edge on iPhone. There's no text. Picking a locked profile shows its lock screen.
- **PIN** (`Pin.tsx`, `ParentGate.tsx`). The PIN is set by entering it twice, and it replaces the "tap seven" check. Three wrong tries close the gate. "Forgot PIN?" asks a two-digit sum, then removes the PIN and opens the parent area.
- **Export and import** (`backup.ts`, using `fflate`, which is bundled into the app and adds about 8 KB).
  - Export is two taps: Export builds the file, then Share file opens the iOS share sheet, because iOS only allows sharing from a tap. Where the share sheet isn't available, the file downloads instead.
  - On import, the file is checked field by field. If the profile is already on the device, you choose Replace or Keep both. A file that isn't a backup gets a plain-English message.
- **Tests** (`tests/profiles.spec.ts`, 5 tests × 4 browser/size projects). They check that:
  - two profiles keep separate settings, and a reload opens the last-used one;
  - each profile has its own lock;
  - the picker shows faces at the minimum size and opens the chosen profile;
  - the PIN works, including a wrong entry and the forgot-PIN recovery;
  - an export, delete and import round trip brings the profile back with its photo, a second import keeps both copies, and a bad file is refused.

  `tests/helpers.ts` has a new `openParent()` helper that fakes the two-finger hold. A further test checks the editor's "Who says that?" switch and the three-picture choice.

## Decisions (also in SPEC 14a)
- The picker and the PIN apply to the whole device, not to one profile.
- A profile with every tile on stores no tile list, so new tiles from content updates show up for it.
- Photos are stored as bytes rather than Blobs. WebKit refused Blobs in IndexedDB during testing, which is the same limitation Safari private browsing has.
- Recordings and custom photo cards (M5) will go into the same backup `.zip`. Photos already have a `profileId` index for that.
- Voice pack assignment isn't in the editor yet (M5).
- The parent screens follow the existing parent style, because the design export only covers child screens 1–8. Screen 9 (the picker) reuses the home tile tints and the hill from the start screen.

## What to test on the iPad
1. Open the parent area. The profile list shows "Child · Playing now". Tap **Edit** and change the time limit to 5 min. Save, and check the list shows 5 min.
2. **Add a profile.** Take a photo with the camera, name it, choose 24–30 months, turn Bubbles off and save. The photo appears as a round face in the list.
3. **Switch to** the new profile, then **Back to play**. The play button appears. Tap it, and the home screen has no Bubbles tile.
4. Close the app fully and reopen it. It opens into the new profile.
5. End the session for one profile, then switch to the other. The other profile isn't locked. Switch back, and the first is still locked.
6. Turn on **Profile picker for children**. Reopen the app and tap play. Two big faces appear. Check that each child can pick their own, in both orientations.
7. **Set a PIN.** Open the parent area and enter a wrong PIN once, then the right one. Try **Forgot PIN?** too.
8. **Export** a profile, then tap **Share file** and AirDrop it to the iPhone, or save it to Files.
9. On the iPhone, **Import a profile** from that file. The photo, name and settings arrive. Import the same file again and choose **Keep both**.
10. Delete the copy. The confirmation appears inside the app, not as a Safari pop-up.
11. Turn on airplane mode and repeat steps 3 and 6. Everything works offline.
