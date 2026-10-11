# Design Brief — Toddler Learning App

Paste this brief into Claude Design. `SPEC.md` is the source of truth for behaviour; this brief covers what to draw.

## Users
- **Children:** 20 and 24 months old. They can't read. They tap confidently and swipe sometimes.
- **Parents and grandparent:** use the hidden parent area. The grandparent is not tech-savvy.

## Devices
- **Primary:** iPad, landscape (1180×820 and 1024×768).
- **Secondary:** iPhone, portrait and landscape (390×844).
- Every screen must work at both sizes.

## Visual direction
- Warm, calm, friendly picture-book feel. Not neon, not busy, no flashing.
- Big shapes with soft corners. One subject on screen at a time.
- High contrast between the subject and the background, with soft solid or very light gradient backgrounds.
- Child-facing screens use no text: icons and pictures only.
- Parent screens: plain and readable, 17 px minimum body text, large controls (the grandparent must be able to use them).
- Use placeholder illustrations. The final art comes later from Gemini using a locked style.

## Child-facing screens
1. **Tap to start:** one huge play button, pressed by the parent. It unlocks audio.
2. **Home:** 4–5 giant category tiles (Animals, Sounds, Places, Counting, Letters).
3. **Card:** one item fills the screen. Include tap edge zones for next and previous, a small home icon in a corner, and the "tapped" state (bounce).
4. **Scene:** a farm illustration with visible but subtle tappable hotspots. Show the active hotspot state.
5. **Counting:** 3 apples, each with a tapped and counted state.
6. **Letters:** a large "A" beside an apple.
7. **Find it:** 2–3 items with the prompt shown as an icon or speaker. Include correct and "try again" states, with no failure styling.
8. **Session ending:** a 1-minute warning cue (fading sun), then the goodbye screen, then the lock screen.
9. **Toddler profile picker (optional):** 2–4 large round avatar faces.

## Parent screens
10. **Parent gate:** shows the two-finger hold target and the adult check (for example "tap 7"), plus the optional PIN pad.
11. **Parent home:** profiles, voices, settings, device check, setup help.
12. **Profile editor:** avatar, name, age band, module toggles, session limit, Find-it toggle, assigned voices plus primary or rotate mode.
13. **Voices list:** each pack shows its recorded count (for example 112/140) and any new words to record. Includes import and export.
14. **Guided recorder:** item image and word, a big record button, recording state, playback, and keep or redo.
15. **Device check:** iOS version and a pass/fail line for install, offline, storage, audio and recording.
16. **Setup help:** how to add to the home screen and how to turn on Guided Access, as illustrated steps.

## Interaction notes to show
- Tap target sizes: at least 160 px on iPad, at least 25% of the short edge on iPhone.
- A placement map of the edge zones and the home button, so a toddler's resting palm doesn't trigger navigation.
- Motion: bounce and wiggle under 600 ms, and a reduced-motion variant.

## Deliverable
A clickable prototype covering screens 1–8 on iPad landscape, and the parent flow 10–14. Static frames for the rest. iPhone variants for Home, Card and Parent home.
