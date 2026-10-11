# STYLE.md — Locked Illustration Style

Reference image: `design/style/style-reference.png`. Attach it to every generation request.

## Master prompt
Replace this block with your final prompt if you changed it while testing.

> Children's picture-book illustration of a **[SUBJECT]**. Single subject, centred, filling 70% of the frame. Soft rounded shapes, flat colours with subtle paper texture, gentle outlines, friendly expression. Plain pale solid background. No text, no border. Square 1:1.

**Scenes** use the same prompt, but replace "Single subject, centred…" with:

> Wide landscape scene of a **[PLACE]** with **[6–10 objects]** clearly separated and not overlapping. 4:3.

## Rules
- Change only `[SUBJECT]` or `[PLACE]`. Never edit the rest of the prompt mid-batch.
- Work in batches of 10–20 per Gemini session. Attach the reference image to each batch.
- Reject and regenerate any image that drifts in palette, outline weight or proportions.
- Name each file by its item id in lowercase (`cow.png`, `fire-truck.png`).
- Save to `public/content/img/<category>/`. Claude Code converts files to WebP.

## Approved test set
cow, duck, apple, car, farm (scene). These are in `design/style/`.
