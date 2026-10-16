// Writes content-src/voice/VOICE-SCRIPT.md: what to say for each word and prompt,
// the file name to save it under, and what each one uses today.
// Run with `npm run voice-script` after content.json changes.
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { familySource, ttsSource, voiceEntries, VOICE } from './voice.mjs';

const content = JSON.parse(await readFile('public/content/content.json', 'utf8'));
const exists = (file) => readFile(file).then(() => true, () => false);

async function status(e) {
  if (await familySource(e.kind, e.id)) return 'Recorded';
  if (await exists(ttsSource(e.kind, e.id))) return 'TTS';
  return 'Device voice';
}

async function table(entries, heading) {
  const rows = [];
  for (const e of entries) rows.push(`| ${e.text} | \`${e.id}\` | ${await status(e)} |`);
  return [heading, '', '| Say | Save as | Now uses |', '|---|---|---|', ...rows, ''].join('\n');
}

const entries = voiceEntries(content);
const words = entries.filter((e) => e.kind === 'words');
const prompts = entries.filter((e) => e.kind === 'prompts');
const categories = content.categories;
const recorded = (await Promise.all(entries.map(status))).filter((s) => s === 'Recorded').length;

const sections = [];
for (const cat of categories) {
  const inCat = words.filter((e) => e.entry.category === cat.id);
  if (inCat.length) sections.push(await table(inCat, `## ${cat.name ?? cat.id[0].toUpperCase() + cat.id.slice(1)}`));
}

const md = `# Voice script

What to record for the app's built-in voice. Generated from \`content.json\` by \`npm run voice-script\`, so rerun that after adding items.

${recorded} of ${entries.length} recorded.

## How to record
- Say each word warmly and slowly, as if to your toddler. One word per file.
- Record in a quiet room, phone about 20 cm from your mouth. Any format the Mac can open works (Voice Memos \`.m4a\` is fine).
- Leave a short pause before and after; silence is trimmed automatically, and loudness is evened out.
- Keep each word under 1.5 s.
- Save words in \`${VOICE}/family/words/\` and prompts in \`${VOICE}/family/prompts/\`, named by the **Save as** column plus the extension (\`cow.m4a\`).
- Then run \`npm run voice\`. Your recordings always replace the TTS ones, and are never changed or overwritten.

**Now uses:** *Recorded* is your recording, *TTS* is the Gemini voice, *Device voice* is the iPad's own speech.

${sections.join('\n')}
${await table(prompts, '## Prompts')}`;

const out = path.join(VOICE, 'VOICE-SCRIPT.md');
await writeFile(out, md);
console.log(`${out}  ${recorded}/${entries.length} recorded`);
