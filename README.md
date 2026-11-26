![Vocals](assets/banner.svg)

# Vocals

A modern premium web studio for voice + song creation — record or clone a voice, generate a beat, and mix & master a song, all in the browser.

## Features

- **Voice Lab** — record your voice (MediaRecorder) or upload a sample; script/lyrics editor; pronunciation fixer (`word=say-as` dictionary applied before speaking); local preview with browser voices, pitch and rate controls.
- **Beat Lab** — procedural instrumental generator (WebAudio): mood (happy/sad/chill/energetic/cinematic), genre (pop/lofi/trap/cinematic), BPM, key and seed. Same seed = same beat.
- **Mix & Master** — voice/beat gains, stereo pan, reverb, compression and normalization; offline render to a real **WAV** download. MP4/WebM recording uses your browser's MediaRecorder and is labelled with the actual format produced.
- **Bring Your Own AI** — connect any OpenAI-compatible TTS endpoint with your own API key (stored only in your browser) for studio-grade voice quality.
- **Pet companion** — Forge the orb pet reacts while you record, generate and export. Rename him anytime.

## Honest quality notes

- **Local mode** = browser TTS preview + your recorded/uploaded voice + procedural beats + real WAV mix/export. It is free, private, and needs no key — but browser TTS will sound like browser TTS.
- **Studio-grade voice cloning** comes from BYO AI mode with your own API key and endpoint. Vocals itself ships no AI model.
- AI-generated exports carry an `ai-generated` disclosure in the filename. A consent checkbox ("I own this voice or have permission to use it") gates clone/export actions.

## Run it

Open `index.html` in a modern browser, or serve the folder:

```bash
npx serve .
```

## Tests

```bash
node --test tests/
```

## Credits

Created by **Priyanshu Kumar Thakur (Gravion)**. Pet companion: Forge.

## License

MIT
