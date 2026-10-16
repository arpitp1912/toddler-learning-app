# Branch summary: `feature/guess-and-home`

Created from `main` on 2026-10-16. Every earlier feature branch (`feature/peekaboo`, `feature/bubbles`, `feature/m2-profiles`, `feature/who-says`, `m1-skeleton`) was already merged into `main`, so nothing was merged into this branch. It is not merged to `main`.

## What was built

### Part 1: Home restructure
- **Home** (`src/components/Home.tsx`) shows at most 4 activity tiles: **Look**, **Peekaboo**, **Bubbles** and **Guess**. In landscape, four tiles sit in two rows of two. Five tiles (when Scenes arrives) fall into the design's 3 + 2 rows with no CSS change. The old 7- and 8-tile CSS is gone.
- **Look screen** (`Look` in `Home.tsx`) has one tile per category enabled for the profile: Animals, Vehicles, Fruits and Things. It uses the same tile size and layout as Home, and the home button sits in the usual corner. A tile opens the existing Cards for that category. The home button, on Look and on the cards, goes back to Home.
- **Vehicles:** the category id stays `sounds`, because saved profiles store it in their tile lists and the image paths use it. It now has `"name": "Vehicles"` in `content.json`, shown in the profile editor. The icon was already the car; I removed the speaker badge (and its CSS). Food is named **Fruits**, as asked.
- **New SVG tile icons** (`icons.tsx`):
  - **Look:** an open eye with a cow's face in the iris.
  - **Guess:** an ear with sound arriving, and a pointing hand. There's no question mark.
  - **Speech bubble:** the word-round replay button.
- The separate Who-says tile is gone.
- **Profile editor:** the "Home screen" card has switches for Look, Peekaboo, Bubbles and Guess. A new "Look" card has the four category switches; these also decide which pictures the games use. The old "Find it" switch is gone, because Find it is now a Guess round type.

### Part 2: Guess
- **One engine** (`src/rounds.ts`, `guessEngine`) makes both round types.
  - Each type has its own target bag, so a type's targets cycle through its pool before repeating.
  - The no-repeated-target rule and the answer-position balance are shared across both types.
  - With both types on, `kindPicker` chooses at random and never gives 3 of the same type in a row.
- **Sound round:** the existing Who-says behaviour, unchanged: "Listen!", then the sound twice; the ear button replays it. It uses only items with `guessable: true` and a sound, and never shows `confusableWith` pairs together.
- **Word round (Find it):** "Where's the" plays, then the target's word. The prompt `wheres` uses a voice-pack clip if there is one, else a built-in clip, else the device voice; the word uses its recorded audio, else the device voice.
  - **Right tap:** the item bounces with a sparkle and says its word and sound, and the others fade.
  - **Wrong tap:** the tapped item wiggles and says its own word, then the question plays again.
  - **Replay:** the speech-bubble button sits where the ear is and repeats the question.
  - **Items:** any item, never with its `lookalikeWith` pairs on screen.
- **Screen** (`src/components/Guess.tsx`, renamed from `WhoSays.tsx`): the same layout, sizes, sparkle, edge zones and swipe as before. `data-kind` on the screen says which round type is showing.
- **Settings per profile** (`guess`, `guessRounds`, `guessChoices`), defaults from `content.json`:
  - Guess off.
  - Rounds "both".
  - 2 choices.

  The editor shows Rounds (Sounds / Words / Both) and Pictures (2 / 3) while Guess is on. A round type with fewer than 2 usable items is skipped. With only Fruits enabled, for example, "both" plays word rounds only. The tile hides if no chosen type can play.
- **`lookalikeWith`** in `content.json`, read both ways, seeded with lemon↔orange, guava↔mango, cup↔jug, goat↔sheep, hen↔duck, crow↔parrot and ball↔orange.
- **Saved profiles carry over** (`upgradeProfile` in `db.ts`, through a database version 3 upgrade and on importing backups made before this version):
  - a saved tile list gains `look`, so children whose tile lists were trimmed still reach their categories;
  - `whoSays` and `whoSaysChoices` become `guess` and `guessChoices` where the parent had set them;
  - `findIt` is dropped.

  Backups are now format version 2.

### Part 3: Housekeeping
- **SPEC.md:** the new Home, the Look screen, Guess with its two round types, the `wheres` prompt, `lookalikeWith`, the category `name`, the new defaults and settings, and 6 decision-log entries.
- **`npm run voice-script`** now lists "Where's the" (`wheres`) under prompts, and uses the category names as headings.
- **Unit tests** (`npm run test:unit`, 309 pass):
  - `src/rounds.test.ts` runs 100 rounds × 5 seeds × 2 and 3 choices, for sound only, word only and both. It uses the real `content.json` pools and a mixed pool with overlapping confusable and look-alike pairs. It checks that:
    - word rounds never pair look-alikes, and sound rounds never pair confusables or use non-guessable items;
    - the round type never runs 3 in a row, and each type gets a fair share;
    - no target repeats in consecutive rounds, and pools cycle;
    - the answer position never sits in one slot 3 times running and stays balanced.

    There are also direct tests of `kindPicker`, `usableKinds` and the seeded look-alike pairs.
  - `src/db.test.ts` tests the profile upgrade.
- **Playwright** (WebKit and Chromium, at 1180×820 and 390×844): 98 pass. The 2 skipped are the existing two-finger Bubbles test in WebKit.
  - `tests/home.spec.ts`:
    - Home shows exactly the 4 activity tiles with Guess on, and 3 with it off;
    - Look's 4 tiles match Home's size and position, and the home button never covers them;
    - Animals opens cards that speak and step on;
    - the home button returns to Home;
    - Vehicles opens the car.
  - `tests/guess.spec.ts`:
    - sound rounds: the earlier checks (sizes, "Listen!", ear replay, right and wrong taps, edge and swipe, 3 choices);
    - word rounds: the question and its replay button, a right tap (word, sound, sparkle, fade), and a wrong tap (wiggle, that word, then the question again);
    - "both": 8 rounds that mix types with never 3 in a row.

    Every test checks for no console errors.
  - `tests/profiles.spec.ts`: the editor switches Guess on with Words and 3 pictures, turning Vehicles off removes it from Look, and switching Guess off hides the tile.
- `tsc --noEmit` and `npm run build` pass.

## Decisions
- **Guess is off by default**, as asked. On the iPad, profiles where you had switched "Who says that?" on keep Guess on. Profiles that only had it through the old default (on) now have it off. Switch it on in the profile editor.
- **The Find it designs (screens 7, 7b, 7c) weren't followed.** They show square cards, a speaker button and a "next" arrow after the right answer. Your brief says one engine, the same position as the ear, a speech-bubble icon and no auto-advance, so word rounds keep the Who-says layout and move on by edge tap or swipe. If you want the square cards from the design, that's a CSS change.
- **A wrong tap in a word round says only the tapped item's word,** not its sound, as the brief says. That keeps the detour short before the question returns.
- **"Where's the" is a family recording** (`content-src/voice/family/prompts/wheres.m4a`, added 2026-10-16), built by `npm run voice` into `audio/prompts/wheres.m4a` (1.04 s; only the silence around the phrase was trimmed). Word rounds now use the family voice for the whole question wherever the word is recorded too (the animals). Fruits and things still say their words with the device voice. I didn't run `npm run tts`, which would generate those words with Gemini; that's a separate step.
- **Bus↔fire truck isn't seeded.** Neither item exists, and the field has to sit on one of the pair. Add it when bus or fire truck arrives.
- **Answer-position balance and "no repeat target" are shared across round types.** A cow found in a word round is never the target of the next sound round.
- **Distractors still prefer a different category** in word rounds too, as in sound rounds. It keeps 2-item rounds easy to tell apart.
- **Branch previews:** Cloudflare builds non-main branches with `npx wrangler preview`, which needs a Wrangler config with a `previews` block. The repo had no Wrangler config (production used Wrangler's defaults), so the branch's preview builds failed after a successful `npm run build`. I added `wrangler.jsonc` with the worker name, `dist` as the assets folder and an empty `previews` block. When this merges, production deploys read the same settings; check the first main deploy after the merge.
- **Look's tile ids are the category ids** (`animals`, `sounds`, `food`, `things`); the child never sees them.

## What to test on the iPad
1. After updating, open the app. Your existing profile should still show its usual pictures. Home shows **Look, Peekaboo and Bubbles**: three tiles, two on top and one below, in landscape.
2. In the parent area, edit the profile. Under **Home screen**, switch **Guess** on. Under **Games**, check that **Guess rounds** shows Sounds / Words / Both (Both selected) and **Guess pictures** shows 2 / 3. Save. Home now shows four tiles in a 2 × 2 grid. Check portrait too.
3. Tap **Look** (the eye with a cow). Four tiles appear in the same places as Home's tiles, with the home button top left. Tap the car: the car card plays. Tap the home button: you're back on Home, not on Look.
4. In the editor, switch off **Vehicles** under **Look**. Look now shows three tiles, and Guess and Bubbles no longer use the car.
5. Tap **Guess** (the ear and pointing hand). Play 8–10 rounds with edge taps or swipes. You should get a mix of "Listen!" rounds (ear button) and "Where's the …?" rounds (speech bubble), never three of the same in a row.
6. In a word round, tap the wrong item. It wiggles and says its name, then "Where's the …" comes again. Tap the right one. It bounces with a sparkle, says its name and sound, and the other fades. Tap the speech bubble to hear the question again.
7. Look-alikes: over many word rounds, lemon and orange, ball and orange, guava and mango, cup and jug, goat and sheep, hen and duck, and crow and parrot never appear together.
8. Tap quickly between the items and the replay button while audio plays. You never hear two sounds at once.
9. Set **Guess pictures** to 3. Three items fit, none under the arrows.
10. Set **Guess rounds** to **Words** with only **Fruits** on under Look. Only fruit word rounds play. Then set it to **Sounds**: the Guess tile disappears, because fruits have no sounds.
11. Export a profile and import it on the iPhone. The Guess settings and the Look categories come across.
12. Turn on airplane mode after one online launch. Look and Guess still work.
13. Try word rounds with your 24-month-old. Note whether the recorded "Where's the" followed by a device-voice word (fruits and things) sounds odd enough to record or generate those words soon.

---

# Earlier branch: `feature/who-says` (merged into `main` 2026-10-15)

This branch was created from `main`, which already had Peekaboo and Bubbles. It adds the "Who says that?" mode, and `feature/m2-profiles` (profiles, export/import, toddler picker, PIN) was merged in so both could be tested together. Both are now merged into `main` (2026-10-15).

## Who says that?

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

## Profiles (M2)

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
