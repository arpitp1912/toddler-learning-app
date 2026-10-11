# CLAUDE.md

## Project
An offline PWA for toddlers aged 18–30 months, used on iPad and iPhone. Repo folder: `toddler-learning-app`.

- `SPEC.md` is the source of truth for behaviour.
- `DESIGN_BRIEF.md` lists the screens and their numbering.
- `STYLE.md` holds the locked image-generation prompt.
- `PLAN.md` is the build plan for the human. Ignore it unless asked.

## Design files
```
design/
├── export/    Claude Design HTML export. Use for exact layout, spacing, colours, fonts, animations.
├── screens/   PNG per screen, named NN-name-device.png (numbers match DESIGN_BRIEF.md). Use as the visual truth for states the export doesn't show.
└── style/     Locked illustration style: style-reference.png plus the 5 test images (cow, duck, apple, car, farm).
```
- Match the design. If the export and a screen PNG disagree, the PNG wins.
- Treat the export as reference only. Rebuild it as Preact components. Don't copy its HTML or CSS wholesale.
- Extract colours, fonts, radii and spacing from the export into one tokens file (`src/styles/tokens.css`).

## Rules
- Build one milestone at a time (SPEC.md section 14). Don't start the next milestone unless asked.
- No backend, no analytics, no third-party runtime scripts.
- No text in child-facing UI.
- Content is data: never hard-code items. Read everything from `public/content/content.json`.
- Image files are named by item id in lowercase (`cow.webp`). Convert PNG to WebP at the sizes in SPEC section 10.
- Feature-detect and degrade gracefully (SPEC section 4). Never let an unsupported feature break playback.
- Test target: iOS Safari 16 or later, plus the device-check screen on older iPads.
- Explain the plan before writing code at the start of each milestone.

## Commands
- `npm run dev`: local server, reachable on the LAN for iPhone testing (`--host`).
- `npm run build && npm run preview`: production build including the service worker.

## Stack
Vite, TypeScript, Preact, vite-plugin-pwa, Dexie, Web Audio API. Hosted on Cloudflare Pages (build `npm run build`, output `dist`).
