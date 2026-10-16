# Toddler Learning PWA — Specification v1

## 1. Purpose
An offline-capable, installable web app for toddlers aged 18–30 months. It replaces open-ended YouTube use with tap-to-discover learning: animals, sounds, places, early counting and letter exposure. It is designed for co-play with a parent and has hard session limits.

## 2. Users
| User | Description |
|---|---|
| Child profile 1 | 20 months. Taps confidently, swipes sometimes. Primary device: iPad. |
| Child profile 2 | 24 months. Same capabilities, plus is ready for receptive "find the X" play. |
| Parent / admin | Creates profiles, records voice clips, sets limits. Only reachable through the parent gate. |

## 3. Design principles (non-negotiable)
- No text in the child-facing UI. Pictures and sound only.
- Tap targets at least 25% of the short screen edge on phone and at least 160 px on iPad. On iPhone the hit area is held at 25% of the short edge even where the scaled visual is smaller.
- Every tap produces a response. No wrong answers, no error states, no dead zones.
- No scores, streaks, stars, rewards, ads, external links or autoplay chains.
- Gestures: tap is primary. Horizontal swipe is optional and never required.
- Calm visual style. Short animations under 600 ms. No flashing.
- Works fully offline after first load.

## 4. Platforms
- iPadOS Safari, installed to the home screen. Landscape first; portrait supported.
- iOS Safari on iPhone, installed to the home screen. Responsive layout, both orientations.
- Locking the device to the app is done with iOS Guided Access. Document this in the parent setup screen.
- Minimum target: iPadOS and iOS 16. Older devices (for example Grandma's iPad) must be checked against this before rollout.
- Known devices: the primary child iPad runs iPadOS 18. Grandma's iPad version is not yet known.
- **Single codebase, graceful degradation.** The same URL works as a plain website in Safari, without installing, and as the installed app. Detect features at runtime and hide anything the device can't do rather than breaking:
  - Playback (cards, scenes, sounds): Safari 13 and later.
  - Offline and home-screen install: iOS 11.3 and later, more reliable from 16.4.
  - Voice recording (MediaRecorder): iOS 14.5 and later. Hidden if unsupported, and packs can still be imported.
- **Device check screen** (parent area): shows the iOS/Safari version and a pass/fail line for install, offline, storage, audio and recording. Use it to validate older devices before rollout.

## 5. Profiles and access
**Model:** local profiles stored on each device. Children have no accounts, emails or passwords.

| Item | Behaviour |
|---|---|
| Profile fields | id, display name (parent-only), avatar photo (from camera or library) or preset animal avatar, age band, enabled modules (home tile ids `look`, `peekaboo`, `bubbles`, plus the category ids Look shows; none listed means all), session limit (minutes), Peekaboo sound hint, Bubbles speed, Guess on or off, its round types and its number of choices, assigned voice packs and voice mode, created date |
| Multiple profiles | Unlimited profiles per device, for example Grandma's iPad holding both children. |
| Launch | Opens directly into the last-used profile. The child never sees a picker by default. |
| Switching | Done from the parent area. An optional toddler-facing picker (large avatar faces) can be turned on. |
| Parent gate | Hold two fingers in the top corner for 3 s, then answer a simple adult check (for example "tap 7"). An optional 4-digit PIN can replace the check. |
| Per-profile data | Voice recordings, settings, usage log, custom photo cards |
| Backup | Export or import a profile as a .zip (JSON plus audio and images) to move it between iPad and iPhone or to a relative's device. |
| Cloud sync | None. Each household installs the app on its own device and creates its own profile. Content updates arrive through redeploys, not through sync. |

## 6. Child-facing modules (v1)
1. **Home:** at most 4 giant activity tiles, in this order: **Look**, **Peekaboo**, **Bubbles**, **Guess** (Scenes will be a 5th later, giving the design's 3 + 2 rows). Each profile chooses which show. Four tiles sit in two rows of two in landscape and a 2-column grid in portrait. There is no home button on Home.
   - **Look tile:** an eye with a cow inside it, drawn in SVG. It shows when the profile's modules allow `look` and at least one category is enabled.
   - **Look screen:** one tile per item category enabled for the profile (Animals, Vehicles, Fruits, Things, in `content.json` order), with the same tile size and layout as Home and the home button in its usual corner. Tapping a tile opens Cards for that category. There is no back gesture; the home button (here and on the cards) returns to Home.
2. **Cards (opened from Look):** one item fills the screen. When a card appears it plays the word, then the sound twice (with a short gap), with the bounce or wiggle starting at the same time, so the child sees the item responds. Tapping the item replays this. Tapping the right or left edge, or swiping, moves to the next or previous card. A home button sits in a corner and is large and icon-only.
3. **Scenes:** a full-screen illustration (farm, street, house, park, beach) with 6–10 hotspots. Each hotspot plays its word and sound and animates. Hotspot coordinates are defined in the content data.
4. **Counting:** 1–5 identical objects. Tapping each one says "one", "two" and so on. After the last object, the total is spoken again.
5. **Letters:** one large letter beside an object image ("A — apple"). Tapping either plays both. Letters are drawn with a font, not generated images.
6. **Find it:** now a round type of Guess (word round, item 9).
7. **Peekaboo:** one large cover (at least 60% of the short edge) hides an item. While waiting, the cover gives a gentle wiggle every 3 s (static under reduced motion). Each new cover says "peekaboo" as it appears. Tapping it opens the cover (500 ms or less) and reveals the item, which plays the word, then the item's sound (as on a card: twice with a short gap), then bounces. Tapping the revealed item replays the word and sound. Edge taps or a swipe, as on Cards, close a new cover over the next item; there is no auto-advance. Taps on the cover while it is opening are ignored, so audio never plays twice.
   - **Covers:** bush (parts left and right), door (swings open), cloud (drifts up), blanket (lifts from one corner). They are drawn in inline SVG with the design tokens, no image files, and rotate in that order each round. Under reduced motion the cover cross-fades instead.
   - **Items:** drawn at random from the item categories enabled for the profile, with no repeats until every item has been shown. Item images only, never scene images. Item audio and fallbacks as on Cards.
   - **Sound hint (profile setting, off by default):** when on, the hidden item's sound plays once at 40% volume after "peekaboo" as each new cover appears. The default comes from `defaults.peekabooSoundHint` in `content.json`; a profile value overrides it.
   - **Home tile:** a bush with two eyes peeking, drawn in SVG. It shows when the profile's enabled modules allow `peekaboo` (all tiles are on when no list is set).
8. **Bubbles:** item bubbles rise slowly over a soft sky gradient. There are 4 on iPad and 3 on iPhone (short edge under 600 px).
   - **Size and paths:** each bubble is at least max(160 px, 28% of the short edge) across, with a hit area 15% larger. Bubbles rise from bottom to top in about 10 s (slow, default) or 6 s (normal) with a gentle sway. They stay to the right of the home button and never overlap: all bubbles rise at the same speed, and a bubble only enters at the bottom when it can't touch any bubble whose path it shares. A bubble that leaves the top comes back at the bottom with a new item.
   - **Look:** a translucent bubble (rim highlight and soft sheen) drawn in inline SVG, with the item image inside at 70% of its diameter.
   - **Pop:** a bubble pops on pointerdown, not click, and each finger pops its own bubble. The pop is a burst (expanding ring and small droplets, 300 ms or less) with a soft synthesised pop (a sine blip with falling pitch, no audio file). The item stays where the bubble was, bounces, says its word and then its sound (as on Cards), and fades after 1.5 s. A new bubble arrives 0.5 s later. A new pop stops the previous item's word or sound at once, so item audio never overlaps.
   - **Items:** drawn at random from the item categories enabled for the profile, never two of the same on screen, and no repeats until every item has been shown.
   - **Speed (profile setting):** slow (default) or normal. The default comes from `defaults.bubbleSpeed` in `content.json`; a profile value overrides it.
   - **Reduced motion:** the bubbles sit still in a grid. A tap pops in place, and a new bubble fades into the same spot once the popped item has faded.
   - **Session:** from the one-minute warning, no new bubbles appear (the bubbles already showing stay until they leave or are popped). At the limit, the goodbye takes over as usual.
   - **Motion budget:** positions are set with `translate3d` from one `requestAnimationFrame` loop. Only transform and opacity animate (no filters, blur or animated shadows), to hold 60 fps on older iPads.
   - **Home tile:** three bubbles with a duck inside the largest, drawn in SVG. It follows the same `modules` rule as Peekaboo (`bubbles`).
9. **Guess (profile setting, off by default via `defaults.guess`; suggested from 24 months):** 2 items side by side (3 if the profile asks for 3), and a question. Two round types share one engine:
   - **Sound round ("Who says that?"):** 300 ms after the items appear, "Listen!" plays (voice-pack prompt `listen`, else the built-in clip, else the device voice), then the target item's sound (twice with a short gap, as on Cards). A large ear button (SVG, top centre, at least 120 px) replays the target sound. **Wrong tap:** that item wiggles and says its own word and its own sound (once), then the target sound plays again.
   - **Word round ("Find it"):** 300 ms after the items appear, "Where's the" plays (voice-pack prompt `wheres`, else the built-in clip, else the device voice), then the target's word (recorded word audio, else the device voice). A speech-bubble button in the ear button's place repeats the question. **Wrong tap:** that item wiggles and says its own word, then the question plays again.
   - **Round types (profile setting):** sound, word or both (default both, from `defaults.guessRounds`). With both, the type is picked at random each round, never more than 2 of the same type in a row. A type with fewer than 2 usable items in the enabled categories is left out; the tile hides when no chosen type is usable.
   - **Choices (profile setting):** 2 or 3 (default 2, from `defaults.guessChoices`).
   - **Sizes:** with 2 choices each item is at least 35% of the screen width on iPad. 3 choices can't reach 35% side by side, so they share the width between the edge zones (about 22% each, still over 160 px). On iPhone each is at least 25% of the short edge.
   - **Right tap (both types):** the item bounces with a gentle sparkle (SVG and CSS, under 800 ms), says its word, then its sound, and the other items fade to 30% opacity. After that, any item can be tapped to hear its name.
   - No negative visuals or sounds, and the round goes on.
   - **Audio:** taps are accepted while audio plays; a new tap stops the current audio first, so audio never overlaps. A tap before the question starts cancels it.
   - **Next round:** edge-zone tap or swipe, as on Cards (both directions bring a new round). No auto-advance.
   - **Items:** from the categories enabled for the profile. Sound rounds use only items with `guessable: true` and a `soundAudio`; word rounds use any item. Each type's targets cycle through its pool before repeating, and no target repeats in consecutive rounds, whatever the types. The target's position is random, never in the same slot more than twice in a row, and balanced over time (shared across both types). Distractors come from a different category than the target where possible. Items listed as `confusableWith` each other never appear in the same sound round; items listed as `lookalikeWith` each other never appear in the same word round.
   - **Reduced motion:** a gentle scale and fade replaces the bounce, wiggle and sparkle.
   - **Home tile:** an ear listening and a pointing hand, drawn in SVG, on peach. It shows only when Guess is on for the profile (its own switch, not the `modules` list).

## 7. Session control
- Each profile has a limit of 5, 10, 15 or 20 minutes, or off.
- At the limit, a calm goodbye animation and sound play, then a lock screen shows. Only the parent gate can dismiss it.
- A gentle visual cue (fading sun) appears 1 minute before the end.

## 8. Parent area
- Manage profiles: create, edit, delete, export and import.
- **Voice packs (optional, M5):** see section 8a.
- Custom photo cards: take a photo, record a word, choose a category. Stored per profile.
- Settings: home tiles on or off (Look, Peekaboo, Bubbles, Guess), Look's categories on or off (these also set which items the games use), session limit, Peekaboo sound hint, Bubbles speed (slow or normal), Guess round types (sounds, words or both) and 2 or 3 choices, toddler-facing profile picker, PIN.
- Usage log: sessions per day, minutes, most-tapped items. Local only.
- Setup help: how to install to the home screen and how to enable Guided Access.

## 8a. Voice packs
A voice pack is a named set of recordings by one adult, such as "Papa", "Mumma" or "Nani". It is stored separately from profiles, so one pack can serve several profiles and several devices.

- **Create:** parent area → Voices → New pack (name, optional photo). Recording can happen on any device with the app installed. The child's device isn't needed.
- **Guided recording:** steps through every item in `content.json` showing its image and word. Tap record, say the word, recording stops on silence (or on a tap), auto-replays, then keep or redo. Progress saves after each word, so a session can stop and resume at any point. A filter shows unrecorded items only, and the Voices list shows a "new words to record" count after content updates.
- **Processing on the device:** trim silence, normalise loudness, encode AAC (MediaRecorder audio/mp4). Target under 20 KB per word.
- **Export:** a `.voicepack` file (zip of `manifest.json` plus audio files), sent through the iOS share sheet (WhatsApp, AirDrop, Drive, email). A full pack is about 3–5 MB.
- **Import:** parent area → Voices → Import, then assign the pack to one or more profiles. Re-importing a newer version of the same pack merges it, and the newer recordings win.
- **Assigning voices to a profile:** an ordered list of packs. Voice mode is either *primary* (always use the first pack that has the word) or *rotate* (pick at random from the packs that have the word).
- **Fallback:** the built-in default voice plays for any word that no assigned pack has recorded.
- **Prompts:** recorded once per pack, alongside the item words. If a pack has no recording, the default voice says the prompt.
  - "Where's the…" (Guess word rounds, prompt id `wheres`): joined to the item word.
  - "Peekaboo" (Peekaboo): said as each new cover appears.
  - "Listen!" (Guess sound rounds, prompt id `listen`): said at the start of each round, before the target sound.
- **Microphone:** iOS asks for microphone permission on first use. Show a short explanation screen before the prompt appears.

## 9. Content model
All built-in content lives in `/public/content/content.json`. The app is a renderer for this file, so adding content requires no code changes.

```json
{
  "version": 1,
  "defaults": { "peekabooSoundHint": false, "bubbleSpeed": "slow", "guess": false, "guessRounds": "both", "guessChoices": 2 },
  "categories": [
    { "id": "animals", "name": "Animals", "module": "cards", "icon": "img/animals/cow.webp", "tint": "sage" }
  ],
  "items": [
    {
      "id": "cow",
      "category": "animals",
      "word": "cow",
      "image": "img/animals/cow.webp",
      "wordAudio": "audio/words/cow.mp3",
      "soundAudio": "audio/sounds/cow.mp3",
      "guessable": true,
      "tags": ["farm"]
    }
  ],
  "scenes": [
    {
      "id": "farm",
      "image": "img/scenes/farm.webp",
      "hotspots": [
        { "itemId": "cow", "x": 0.32, "y": 0.58, "r": 0.09 }
      ]
    }
  ],
  "letters": [ { "letter": "A", "itemId": "apple" } ],
  "counting": [ { "itemId": "apple" }, { "itemId": "duck" } ]
}
```
- Hotspot x, y and r are fractions of the image's width and height, so they scale across devices.
- `word` is used as the text-to-speech fallback if `wordAudio` is missing.
- Categories: `name` is the parent-facing name (shown in the profile editor; the child sees only the icon). The `sounds` category is named Vehicles: its id stays `sounds` because saved profiles and image paths use it.
- `prompts` lists the spoken prompts (`listen`, `wheres`, `peekaboo`, `bye`) with their `text` and, once built, `audio` (the built-in voice). A voice pack's recording of a prompt wins over `audio`; with neither, the device voice says `text`.
- `defaults` holds profile settings used until a profile sets its own (currently `peekabooSoundHint`, `bubbleSpeed`, `guess`, `guessRounds` and `guessChoices`).
- `guessable` marks items that Guess sound rounds can use (they also need a `soundAudio`). Currently true for all animals except fish, vehicle horns and sirens (car, bus, train, aeroplane, motorbike, fire truck, boat), bell, clock, phone and door; false for everything else. Set it on new items as they are added.
- `confusableWith` (optional) lists item ids whose sounds are too alike to show together in a Guess sound round. It is read both ways, so a pair needs listing on only one item, and it may name items not yet added. Seeded pairs: goat–sheep, crow–parrot, car–bus, car–motorbike, bus–fire truck.
- `lookalikeWith` (optional) lists item ids that look too alike to show together in a Guess word round, read the same way. Seeded pairs: lemon–orange, guava–mango, cup–jug, goat–sheep, hen–duck, crow–parrot, ball–orange. Bus–fire truck is to be added when either item arrives.
- `decor` lists item ids used as decoration: `start` and `goodbye` for those screens, and `avatars` for the preset profile pictures in the profile editor.

**v1 content target:** 40 animals, 20 everyday sounds (vehicles, household, nature), 5 scenes, counting objects for 1–5, 26 letter–object pairs. Letter objects reuse items wherever possible.

## 10. Asset specifications
| Asset | Specification |
|---|---|
| Item images | 1024×1024 WebP, about 80–150 KB, single subject, plain or soft background, consistent illustration style. The converter (`npm run assets`) makes the background transparent by flood-filling the pale area connected to the image edges; pale areas inside the subject are kept, even behind a small gap in the outline. Small pale pockets between legs or feet are removed, and so are enclosed holes that match the background colour (inside a cup handle). The converter builds every item listed in `content.json` from `design/style/<id>.png`. |
| Scene images | 2048×1536 WebP, about 300–500 KB |
| Style | One locked style prompt (`STYLE.md`) plus the reference image `design/style/style-reference.png`, applied to every image |
| Word audio | MP3 or AAC, mono, 64 kbps, under 1.5 s, with silence trimmed. The built-in voice covers item words and prompts. `npm run voice` (macOS only) builds each from `content-src/voice/family/{words,prompts}/<id>.*` (family recordings, which always win) or else `content-src/voice/tts/{words,prompts}/<id>.wav`, with the same processing as the sounds at 64 kbps, except that silence is trimmed against each clip's own room noise and only the speech around the loudest moment is kept (a pause over 0.25 s ends it, which drops taps and breaths), into `audio/{words,prompts}/<id>.m4a`, and sets `wordAudio` or the prompt's `audio`. It reports clips over 1.5 s rather than cutting words. `npm run tts` first fills the gaps with Gemini text-to-speech (`GEMINI_API_KEY` in `.env`): for every item and prompt with no family recording, TTS file or audio file yet, it asks for the word "warmly and slowly, in a gentle Indian English accent, as if to a toddler", saves the WAV without ever overwriting a file, waits out rate limits, then runs `npm run voice`. `npm run voice-script` writes `content-src/voice/VOICE-SCRIPT.md`, the recording list for family members: each word and prompt, its file name and what it uses today. |
| Sound audio | MP3 or AAC, mono, 96 kbps, under 3 s, normalised to −16 LUFS. The converter (`npm run audio`, macOS only, uses `afconvert`) builds every item with a `soundAudio` path from `content-src/audio/raw/<id>.*`, skipping any start offset set in `content-src/audio/start.json`: it trims silence, cuts clips that are too long with a fade-out, and normalises loudness, with a limiter holding short peaks at −1 dBFS (up to 9 dB of reduction; beyond that it peak-normalises instead). Output is AAC in `.m4a`. |
| Sources | Images from Gemini (fallback: ChatGPT). Sounds from Freesound, CC0 licence only, with the source recorded in `CREDITS.md`. |
| Total offline bundle | Under 50 MB |

## 11. Technical stack
- **Build:** Vite and TypeScript. UI is Preact, or vanilla TypeScript if the component count stays small.
- **PWA:** `vite-plugin-pwa` (Workbox). Precache the app shell and all content assets. Web manifest uses `display: standalone` and `orientation: any`, with icons and a splash screen.
- **Audio:** Web Audio API through a small wrapper (or Howler.js). Audio is unlocked on the first parent tap ("tap to start" screen). Each item's audio is preloaded when its card or scene opens.
- **Storage:** IndexedDB through Dexie for profiles, settings, recordings (Blob) and logs. Call `navigator.storage.persist()` on first run.
- **Animations:** CSS transforms only, with no layout thrash.
- **Hosting:** Cloudflare Pages, deployed automatically from the GitHub main branch over HTTPS.
- **No backend, no analytics, no third-party scripts at runtime.**

## 12. Out of scope for v1 (v2 candidates)
- Cloud sync. Only add it if the same child needs identical recordings on several devices. Free options are Cloudflare D1 and R2 or Supabase's free tier.
- A second language.
- New content packs (food, body parts, colours, shapes).

## 13. Non-functional requirements
- First meaningful paint under 2 s on an iPad over 4G. Every tap responds within 100 ms.
- Full functionality in airplane mode after first load.
- Privacy: all child data stays on the device. No personal data leaves it unless the parent exports it.
- Accessibility: high contrast between subject and background. No information carried by colour alone.

## 14. Milestones
| # | Deliverable | Done when |
|---|---|---|
| M0 | Clickable prototype (5 animal cards) | Tested with both children. Notes captured. |
| M1 | Basic skeleton: PWA install, offline, home, cards, parent gate, timer, one profile. Content: the 5 style images in `design/style/`, copied into `public/content/img/`, with browser text-to-speech for words until recorded audio exists. A "Things" home tile (apple) stood in until M3; it later became a permanent tile alongside Food (see decision log). | Installs on iPad, works in airplane mode |
| M2 | Profiles and export/import | Two profiles on one iPad with separate settings |
| M3 | Scenes, Counting, Letters | All modules render from `content.json` |
| M4 | Full v1 content | Asset targets in section 9 met, bundle under 50 MB |
| M5 | Optional parent voice recorder, custom photo cards, usage log (Find it arrived early, as a Guess round type) | Enabled for the 24-month profile |

## 14a. Decision log
| Date | Decision |
|---|---|
| 2026-10-12 | Cards: the bounce or wiggle starts on tap, alongside the word and sound, rather than after them. |
| 2026-10-12 | Item image backgrounds are made transparent by the converter (edge-connected flood fill only), not in the source art. |
| 2026-10-12 | iPhone hit areas are 25% of the short screen edge. |
| 2026-10-12 | "Things" is a temporary home tile until M3. |
| 2026-10-12 | Cards play word, sound and animation once on arrival (not only on tap), because tap-to-play was not discoverable. This is a single play per card, not an autoplay chain. |
| 2026-10-13 | Food and Things are separate, permanent card tiles (food items in Food, everyday objects in Things), replacing the temporary Things tile. This brings forward part of the food pack listed in section 12. With M3 the home would reach 7 tiles, above the 4–5 in section 6, so the tile set must be decided before M3. |
| 2026-10-15 | Peekaboo added as a mode tile (built on branch `feature/peekaboo`, outside the milestone plan). It draws from all enabled item categories, so it adds one home tile rather than one per category. |
| 2026-10-15 | Peekaboo: "peekaboo" is said when each cover appears, not when it is tapped, so the reveal goes straight to the item. |
| 2026-10-15 | Peekaboo: both edge zones and both swipe directions bring a new cover, since a random sequence has no "previous". The bounce follows the reveal audio as specified; a replay tap bounces at once, as on Cards. |
| 2026-10-15 | Bubbles added as a mode tile (branch `feature/bubbles`, built on `feature/peekaboo`). The home now has 6 tiles by default (4 categories, Peekaboo, Bubbles), above the 4–5 in section 6. Nothing enforces a maximum yet; a profile's `modules` list can trim the tiles. The tile set still needs deciding before M3 (see 2026-10-13). |
| 2026-10-15 | Bubbles: bubbles may pass under the parent-gate corner (top right). Avoiding it as well as the home button leaves too little width on iPhone portrait for even one bubble. A single tap there reaches the gate, not the bubble, but the bubble keeps rising into reach. |
| 2026-10-15 | Bubbles: the screen starts filled (bubbles spread up the screen) rather than empty, including when opened during the one-minute warning. Only new bubbles stop during the warning. |
| 2026-10-15 | Bubbles, reduced motion: the replacement bubble fades in once the popped item has faded (about 1.8 s), not at 0.5 s, so the old item and the new bubble never overlap in the same spot. |
| 2026-10-15 | Who says that? added as a mode tile (branch `feature/who-says`), off by default. With it on, the home has 7 tiles; nothing enforces the 4–5 in section 6 (see 2026-10-13), so on iPad landscape more than 6 tiles switch to 4 smaller tiles per row (260 design px, still over 160 px) to fit in two rows. |
| 2026-10-15 | Who says that?: 3 choices can't each be 35% of the iPad width side by side (105%), so they share the space between the edge zones (about 22% each). With 2 choices the edge zones narrow slightly (171 design px) so both items reach 35% with no overlap. |
| 2026-10-15 | Who says that?: the target sound plays twice after "Listen!" and on the ear button, as items do elsewhere (2026-10-14). On a wrong tap the tapped item's own sound plays once, to keep the detour short before the target sound returns. |
| 2026-10-15 | Who says that?: after the right answer, the faded items stay tappable and just say their own word and sound (every tap responds); the target replays its celebration. |
| 2026-10-15 | Who says that?: only animals have sound clips today, so the pool is the 16 animals other than fish. Car, clock, phone and door are marked guessable but join once their sounds exist. Bus, train, aeroplane, motorbike, fire truck, boat and bell aren't in the content yet; the bus–fire truck pair has to be added to one of those items when they arrive. |
| 2026-10-15 | Who says that? is on by default (`defaults.whoSays: true`), changed from off after first local testing. A profile can turn it off in the profile editor. |
| 2026-10-15 | Merging M2 into Who says that?: the mode's own `whoSays` switch decides whether its tile shows, not the `modules` list, because tile lists saved by the M2 editor before the mode existed don't include it. The editor shows it with the other home tiles, and offers 2 or 3 pictures while it is on. Backups carry both settings. |
| 2026-10-15 | M2 profiles: the toddler picker and the parent PIN are device-wide settings, not per profile, since they decide who plays and who gets into the parent area on that device. |
| 2026-10-15 | M2 profiles: the picker appears after tap to start (the parent's tap still unlocks audio), only when it is on and the device has two or more profiles. Choosing a locked profile shows its lock screen. |
| 2026-10-15 | M2 profiles: each profile keeps its own session clock and lock. Switching from the parent area returns to tap to start for the new profile. |
| 2026-10-15 | M2 profiles: a profile with every home tile on stores no tile list, so tiles added by later content updates appear for it automatically. |
| 2026-10-15 | M2 profiles: a forgotten PIN can be removed by answering a two-digit sum (for example 37 + 48), which keeps out toddlers and young siblings without locking the parent out. Three wrong PIN tries close the gate. |
| 2026-10-15 | M2 profiles: avatar photos are cropped to a 512 px square JPEG (Safari 16 can't encode WebP) and stored as bytes, not Blobs, because WebKit refuses Blobs in IndexedDB in some sessions, including private browsing. |
| 2026-10-15 | M2 profiles: the backup is a .zip of `manifest.json` (format `toddler-profile`, version 1), `profile.json` and `photos/`. The session clock is not exported. Importing a profile that is already on the device offers replace or keep both. |
| 2026-10-14 | Item sounds play twice with a 400 ms gap after the word, because single clips (under 3 s) felt too short. Clips stay under 3 s on disk. |
| 2026-10-16 | Built-in voice: item words and prompts can come from Gemini TTS (`npm run tts`) until family recordings replace them. Family source files always win and are never overwritten. The style instruction is sent as a speech style note, because sent as text before the word the model read the whole instruction aloud. |
| 2026-10-16 | Prompts moved into `content.json` (`prompts`), so their built-in audio is content, not code. "Bye bye!" on the goodbye screen became prompt `bye`. |
| 2026-10-16 | Home restructure (branch `feature/guess-and-home`): Home holds at most 4 activity tiles (Look, Peekaboo, Bubbles, Guess; Scenes later as a 5th). The category tiles moved to a Look screen with the same layout. This settles the tile set left open on 2026-10-13 and 2026-10-15. |
| 2026-10-16 | The "Sounds" category is shown as Vehicles (`name` in `content.json`). Its id stays `sounds`, since saved profiles and image paths use it. Its icon was already the car; the speaker badge is gone. Food is shown as Fruits. |
| 2026-10-16 | Profiles saved before this change (database version 3 upgrade, backup format version 2): a saved tile list gains `look`; `whoSays` and `whoSaysChoices` become `guess` and `guessChoices` where the parent had set them; `findIt` is dropped. |
| 2026-10-16 | "Who says that?" became Guess, with sound and word ("Find it") rounds. Guess is off by default (`defaults.guess: false`), changed from Who says that? being on; profiles where the parent switched Who says that? on keep Guess on. |
| 2026-10-16 | Guess word rounds: the replay button is a speech bubble in the ear button's place, and a wrong tap says only the tapped item's word (no sound) before the question returns. The Find it screens in the design (speaker button, a next arrow after the right answer) predate this and were not followed: Guess keeps the Who-says layout and moves on by edge tap or swipe only. |
| 2026-10-16 | Guess: the answer slot balance and the no-repeat rule run across both round types, so a cow found in a word round is never the next sound round's target. |

## 15. Acceptance criteria (v1)
- Installs to the iPad and iPhone home screens and launches full-screen with no Safari interface.
- Works with no network after first load.
- The child can't reach settings or leave the app without the parent gate (with Guided Access on).
- The session limit always ends play and needs the parent to resume.
- The built-in default voice plays for every item with no setup.
- Adding a new animal requires only an assets folder and a `content.json` change.
