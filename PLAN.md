# PLAN.md — Build Plan (Phase 4 onward)

Phases 0–3 are done: setup, style lock, design and validation.

## Phase 4: Prepare the repo folder

### 4.1 Lay out the folder
```
toddler-learning-app/
├── CLAUDE.md
├── SPEC.md
├── DESIGN_BRIEF.md
├── STYLE.md
├── PLAN.md
└── design/
    ├── export/      ← Claude Design HTML export (unzipped)
    ├── screens/     ← one PNG per screen
    └── style/       ← style-reference.png + cow.png, duck.png, apple.png, car.png, farm.png
```
- Move your 5 reference images from `design/` into `design/style/`.
- Name them in lowercase by item id: `cow.png`, `duck.png`, `apple.png`, `car.png`, `farm.png`.
- Save a copy of the best one as `style-reference.png`.

### 4.2 Export the design (both formats)
- **HTML:** in Claude Design, export or download the prototype as HTML. Unzip it into `design/export/`. This gives Claude Code exact sizes, colours and fonts.
- **Screen images:** take a PNG of every screen and state, iPad landscape first. Name each file by its number in `DESIGN_BRIEF.md`:
  - `01-start-ipad.png`, `02-home-ipad.png`, `02-home-iphone.png`
  - `03-card-ipad.png`, `03-card-tapped-ipad.png`
  - `04-scene-ipad.png` … `14-recorder-ipad.png`
  - Include the key states: tapped, correct, try again, warning, lock.
- **If you can only do one,** do the HTML export plus screenshots of the screens it doesn't show well.

### 4.3 Put the folder under version control and push it
Run these in the `toddler-learning-app` folder:
```
git init
git add .
git commit -m "Spec, design and style"
git branch -M main
```
Create an empty GitHub repo named `toddler-learning-app` (no README), then:
```
git remote add origin https://github.com/<your-username>/toddler-learning-app.git
git push -u origin main
```

## Phase 5: Build M1 (Claude Code)
1. Run `cd toddler-learning-app`, then `claude`.
2. Give it this instruction:
   > Read CLAUDE.md, SPEC.md, DESIGN_BRIEF.md and design/. Implement milestone M1 only, using the 5 images in design/style/ as content. Explain the plan before writing code.
3. Review the plan and approve it. Answer its questions.
4. Test locally with `npm run dev -- --host`. Open the network URL it prints on your iPhone (same Wi-Fi).
5. When it works:
   ```
   git add . && git commit -m "M1" && git push
   ```

**M1 is done when** home and cards work, the parent gate and timer work, and the app plays in airplane mode after first load.

## Phase 6: Deploy (once)
1. In Cloudflare, go to Workers & Pages → Create → Pages → Connect to Git, and select `toddler-learning-app`.
2. Use framework preset **None**, build command `npm run build`, output directory `dist`.
3. Open the `.pages.dev` URL on your iPhone and add it to the home screen. Then send the link to your wife for the iPad (Safari → Share → Add to Home Screen).
4. Every `git push` redeploys automatically from now on.

## Phase 7: Milestones M2 to M5 (repeat for each)
1. In Claude Code, type `/clear` to start fresh.
2. Give it this instruction:
   > Implement M[n] per SPEC.md, matching design/. Explain the plan first.
3. Test on your iPhone, then commit and push. Your family tests on the iPad.
4. Optional: in Codex, ask for a review of this milestone's changes for iOS Safari bugs.

| Milestone | What to check on the device |
|---|---|
| M2 | Two profiles with different settings. Export one profile and import it on another device. |
| M3 | Scene hotspots line up with the image on both iPad and iPhone. |
| M4 | Full content plays offline. Bundle under 50 MB. |
| M5 | Find-it mode, voice recorder, photo cards, usage log. |

## Phase 8: Content (alongside M3 and M4)
| Asset | Tool | Save to |
|---|---|---|
| Item images | Gemini + STYLE.md, batches of 10–20 | `public/content/img/<category>/<id>.png` |
| Scene images | Gemini + STYLE.md scene prompt | `public/content/img/scenes/<id>.png` |
| Sounds | Freesound, CC0 filter, source noted in `CREDITS.md` | `public/content/audio/sounds/<id>.mp3` |
| Default voice | Google AI Studio or ChatGPT text-to-speech, one file per word | `public/content/audio/words/<id>.mp3` |

Then tell Claude Code:
> Add the new files to content.json, convert images to WebP, and check that sizes meet SPEC section 10.

## Phase 9: Voice packs (after M5)
1. You and your wife each record a pack in the app's parent area.
2. Export each pack and send it over WhatsApp.
3. Import the packs on each child's iPad and on your mom's iPad.

## Recovery rules
- **Something broke:** `git checkout .` discards everything since the last commit.
- **An error appeared:** paste the exact error text into Claude Code.
- **A new idea came up:** add it to `SPEC.md` first. Build it only in a later milestone.
