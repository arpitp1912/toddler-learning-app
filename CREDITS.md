# Credits

Sources and licences for third-party assets bundled with the app.

## Sounds

All sounds are from [Freesound](https://freesound.org) and use the CC0 licence (SPEC section 10). Raw files live in `content-src/audio/raw/`.

| Item | File | Freesound URL | Author | Licence |
|---|---|---|---|---|
| cat | `cat.wav` | TODO | TODO | CC0 |
| cow | `cow.wav` | TODO | TODO | CC0 |
| dog | `dog.wav` | TODO | TODO | CC0 |
| goat | `goat.wav` | TODO | TODO | CC0 |
| horse | `horse.wav` | TODO | TODO | CC0 |
| pig | `pig.wav` | TODO | TODO | CC0 |
| sheep | `sheep.mp3` | TODO | TODO | CC0 |

## Images

Illustrations were generated with Gemini (fallback: ChatGPT) using the locked prompt in `STYLE.md`.

## Voice

The built-in word and prompt audio is generated with Gemini text-to-speech (`npm run tts`, voice Sulafat unless `GEMINI_TTS_VOICE` says otherwise), until family recordings in `content-src/voice/family/` replace it.

## Fonts

The app uses the device's system font. No font files are bundled.
