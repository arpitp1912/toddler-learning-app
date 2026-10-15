# Branch summary: `feature/m2-profiles`

Milestone M2 (SPEC section 14): profiles and export/import, plus the toddler profile picker and the parent PIN from the settings list in SPEC section 8. Branched from `main` after Peekaboo and Bubbles were merged.

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

  `tests/helpers.ts` has a new `openParent()` helper that fakes the two-finger hold. All 42 tests pass, including the existing Peekaboo and Bubbles tests.

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
