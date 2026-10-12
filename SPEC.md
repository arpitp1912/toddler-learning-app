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
| Profile fields | id, display name (parent-only), avatar photo (from camera or library) or preset animal avatar, age band, enabled modules, session limit (minutes), assigned voice packs and voice mode, created date |
| Multiple profiles | Unlimited profiles per device, for example Grandma's iPad holding both children. |
| Launch | Opens directly into the last-used profile. The child never sees a picker by default. |
| Switching | Done from the parent area. An optional toddler-facing picker (large avatar faces) can be turned on. |
| Parent gate | Hold two fingers in the top corner for 3 s, then answer a simple adult check (for example "tap 7"). An optional 4-digit PIN can replace the check. |
| Per-profile data | Voice recordings, settings, usage log, custom photo cards |
| Backup | Export or import a profile as a .zip (JSON plus audio and images) to move it between iPad and iPhone or to a relative's device. |
| Cloud sync | None. Each household installs the app on its own device and creates its own profile. Content updates arrive through redeploys, not through sync. |

## 6. Child-facing modules (v1)
1. **Home:** 4–5 giant picture tiles: Animals, Sounds, Places, Counting, Letters. Which tiles appear is set per profile.
2. **Cards:** one item fills the screen. Tapping the item starts the bounce or wiggle animation immediately and plays the word, then the sound. Tapping the right or left edge, or swiping, moves to the next or previous card. A home button sits in a corner and is large and icon-only.
3. **Scenes:** a full-screen illustration (farm, street, house, park, beach) with 6–10 hotspots. Each hotspot plays its word and sound and animates. Hotspot coordinates are defined in the content data.
4. **Counting:** 1–5 identical objects. Tapping each one says "one", "two" and so on. After the last object, the total is spoken again.
5. **Letters:** one large letter beside an object image ("A — apple"). Tapping either plays both. Letters are drawn with a font, not generated images.
6. **Find it (profile setting, off by default; suggested for age 24 months and over):** 2–3 items shown, a prompt says "Where's the cow?". Tapping the correct item celebrates it. Tapping a wrong item names that item and re-prompts. No failure state.

## 7. Session control
- Each profile has a limit of 5, 10, 15 or 20 minutes, or off.
- At the limit, a calm goodbye animation and sound play, then a lock screen shows. Only the parent gate can dismiss it.
- A gentle visual cue (fading sun) appears 1 minute before the end.

## 8. Parent area
- Manage profiles: create, edit, delete, export and import.
- **Voice packs (optional, M5):** see section 8a.
- Custom photo cards: take a photo, record a word, choose a category. Stored per profile.
- Settings: modules on or off, session limit, Find-it mode, toddler-facing profile picker, PIN.
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
- **Find-it prompt:** "Where's the…" is recorded once per pack and joined to the item word. If missing, the default voice says the prompt.
- **Microphone:** iOS asks for microphone permission on first use. Show a short explanation screen before the prompt appears.

## 9. Content model
All built-in content lives in `/public/content/content.json`. The app is a renderer for this file, so adding content requires no code changes.

```json
{
  "version": 1,
  "categories": [
    { "id": "animals", "icon": "img/cat/animals.webp" }
  ],
  "items": [
    {
      "id": "cow",
      "category": "animals",
      "word": "cow",
      "image": "img/animals/cow.webp",
      "wordAudio": "audio/words/cow.mp3",
      "soundAudio": "audio/sounds/cow.mp3",
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

**v1 content target:** 40 animals, 20 everyday sounds (vehicles, household, nature), 5 scenes, counting objects for 1–5, 26 letter–object pairs. Letter objects reuse items wherever possible.

## 10. Asset specifications
| Asset | Specification |
|---|---|
| Item images | 1024×1024 WebP, about 80–150 KB, single subject, plain or soft background, consistent illustration style. The converter (`npm run assets`) makes the background transparent by flood-filling the pale area connected to the image edges; pale areas inside the subject are kept. |
| Scene images | 2048×1536 WebP, about 300–500 KB |
| Style | One locked style prompt (`STYLE.md`) plus the reference image `design/style/style-reference.png`, applied to every image |
| Word audio | MP3 or AAC, mono, 64 kbps, under 1.5 s, with silence trimmed |
| Sound audio | MP3 or AAC, mono, 96 kbps, under 3 s, normalised to −16 LUFS |
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
| M1 | Basic skeleton: PWA install, offline, home, cards, parent gate, timer, one profile. Content: the 5 style images in `design/style/`, copied into `public/content/img/`, with browser text-to-speech for words until recorded audio exists. A temporary "Things" home tile (apple) stands in until M3 brings the full module set. | Installs on iPad, works in airplane mode |
| M2 | Profiles and export/import | Two profiles on one iPad with separate settings |
| M3 | Scenes, Counting, Letters | All modules render from `content.json` |
| M4 | Full v1 content | Asset targets in section 9 met, bundle under 50 MB |
| M5 | Find-it mode, optional parent voice recorder, custom photo cards, usage log | Enabled for the 24-month profile |

## 14a. Decision log
| Date | Decision |
|---|---|
| 2026-10-12 | Cards: the bounce or wiggle starts on tap, alongside the word and sound, rather than after them. |
| 2026-10-12 | Item image backgrounds are made transparent by the converter (edge-connected flood fill only), not in the source art. |
| 2026-10-12 | iPhone hit areas are 25% of the short screen edge. |
| 2026-10-12 | "Things" is a temporary home tile until M3. |

## 15. Acceptance criteria (v1)
- Installs to the iPad and iPhone home screens and launches full-screen with no Safari interface.
- Works with no network after first load.
- The child can't reach settings or leave the app without the parent gate (with Guided Access on).
- The session limit always ends play and needs the parent to resume.
- The built-in default voice plays for every item with no setup.
- Adding a new animal requires only an assets folder and a `content.json` change.
