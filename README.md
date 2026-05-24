# Mirror

Hear yourself speak perfect Mandarin — diagnosed by your L1.

Built for the Build with AI EdTech Hackathon 2026, General Education track, New Uzbekistan University, Tashkent.

- Live demo: https://sheganai.vercel.app
- Repo: https://github.com/SaidislomSaidazimovv/mirror

## The Problem

Mainstream language apps grade Mandarin speakers with a green tick that says nothing. Russian and Uzbek learners get the same generic feedback as everyone else; their actual L1-driven articulation errors (palatalized retroflexes, missing /ü/) are never named. After months of practice, the same mistakes stay.

## The Loop

A single-screen demo that runs end-to-end without leaving the page.

1. SPEAK — read a Mandarin sentence into the mic.
2. DIAGNOSE — an L1-specific phoneme card lands with the offending sound, an expected-versus-detected box, and a pattern citation.
3. GOLDEN VOICE — the user's own cloned voice plays the same sentence in perfect Mandarin.
4. AVATAR MIRROR — a synthetic native-mouth target on the left, the user's live face-mesh on the right, with a match score that turns success-green at 90 and locks at 95.

Before the first attempt, a separate Step 0 captures a short reference clip in the user's native language so the voice clone is seeded from clean timbre, not their accented Mandarin.

## Current Features

Everything below is wired and running in production on the live URL.

- Four-step state machine driven by Zustand, fully keyboard-driven (Space hold to record, Enter to advance, Escape to reset).
- Dual-provider ASR: browser Web Speech API as the primary path, HuggingFace Whisper Large V3 as the server fallback when the browser engine is unavailable or returns nothing.
- Real character-level mismatch derivation: the first wrong hanzi maps to its signature phoneme, and that phoneme drives the diagnosis card.
- L1-aware diagnosis card with the spec composition: red pulsing dot, "L1 PATTERN DETECTED" label, "RUSSIAN L1" / "UZBEK L1" headline, phoneme-shift box, pattern counter, citation, internal stagger.
- Gemini 2.0 Flash AI Tutor panel under the diagnosis card with a UZ / RU / EN toggle that re-fetches the explanation on language change.
- ElevenLabs Flash v2.5 Instant Voice Cloning. The reference clip clones the user's timbre once; every subsequent Golden Voice playback uses the same voice_id. A pre-cloned demo voice is hardcoded into the build so visitors hear a sample without recording first.
- Pre-rendered MP3 fallback for each of the three demo sentences. If the live synthesis ever fails, the Golden Voice still plays.
- MediaPipe Tasks-Vision Face Landmarker on the live side of the mirror (468 face landmarks at 60 fps). The left side shows a synthetic 468-point Mandarin avatar with FACEMESH-style tessellation lines and a procedural mouth-open envelope.
- Match score: a large counter that smoothly tracks alignment, with a deterministic boost ramp so the demo always reaches 95 within 6 to 8 seconds. Crossing 95 fires a single 180 ms gold "lock" pulse on both cards.
- Numeric Resolved screen: "10.4s / total time", "0 / native speakers required", "1 / voice — yours", with sequential reveal.
- Step indicator across the top of the stage so the viewer always knows where they are in the four-step loop.
- Auto-transitions: diagnosis holds for 7 seconds (or Enter), Golden Voice advances 400 ms after audio ends, Mirror advances after 95 % match holds for 1 second.
- Honest no-speech state: when both ASR paths return empty, the app routes to a dedicated screen with the actual upstream reason rather than fabricating a diagnosis.

## Roadmap

These are scoped but not in the production build yet.

- Mirror Live: real-time accent morphing between two speakers via streaming ElevenLabs Flash v2.5, targeting sub-75 ms latency.
- Gemini-powered Session Report on the Resolved screen: coverage percentage, strengths, weak phoneme, and a one-line "next focus".
- Native Mandarin pre-recorded avatar landmark JSON for the left mirror panel (currently synthetic).
- Adaptive practice: Gemini generates three new Mandarin sentences targeting the user's identified weakness pattern.
- More L1 coverage beyond Russian and Uzbek.
- B2B API: license the L1-fingerprint engine to EdTech platforms; per-query pricing.
- Self-hosted PP Neue Montreal (the build currently uses Switzer as the licensed fallback).

## Stack

| Layer | Choice |
|---|---|
| Frontend | Vite + React 19 + TypeScript + Tailwind v4 |
| State | Zustand (single global session) |
| Motion | Motion (formerly Framer Motion) |
| Audio capture | MediaRecorder + AnalyserNode (single mic stream) |
| ASR primary | Browser Web Speech API (zh-CN) |
| ASR fallback | HuggingFace Whisper Large V3 via /api/asr |
| Voice cloning | ElevenLabs Flash v2.5 + Instant Voice Cloning via /api/clone and /api/synth |
| AI Tutor | Google Gemini 2.0 Flash via /api/explain |
| Face tracking | MediaPipe Tasks-Vision Face Landmarker |
| Backend | Vercel Python serverless functions (proxies that hide HF / ElevenLabs / Gemini keys) |
| Deploy | Vercel — one repo, frontend + serverless |

## Local Setup

Requires Node.js 20+ and Python 3.11+ for the serverless functions.

```bash
git clone https://github.com/SaidislomSaidazimovv/mirror.git
cd mirror/web
npm install
```

Create `api/.env` with the keys you have (none of them are required to boot the app — missing keys degrade gracefully):

```env
HF_TOKEN=your_huggingface_token_here
HF_ASR_ENDPOINT=https://router.huggingface.co/hf-inference/models/openai/whisper-large-v3

ELEVENLABS_API_KEY=your_elevenlabs_key_here
ELEVENLABS_MODEL=eleven_flash_v2_5

GEMINI_API_KEY=your_gemini_key_here
GEMINI_MODEL=gemini-2.0-flash

ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
```

Run:

```bash
# Frontend only — ASR will use the browser engine and fall back gracefully
npm run dev                # http://localhost:5173

# Full stack — frontend + serverless functions on one port
npm i -g vercel
vercel dev                 # http://localhost:3000
```

## Why This Is Honest

The phoneme trigger is derived from real ASR. Whisper Large V3 or the browser engine returns Mandarin, which Mirror diffs against the expected sentence character by character. The first mismatching character maps to its signature phoneme, and that phoneme drives the analysis grid and the diagnosis card. The L1 label is taken from the user's manual language toggle, not from the audio. The diagnosis copy is grounded in published phonetic literature, with citations on the card.

If the mic heard nothing, the app routes to NO SPEECH DETECTED instead of inventing an error.

No audio is persisted server-side. The reference clip goes to ElevenLabs once for cloning, and the target attempt goes to HuggingFace for ASR; neither is stored. Mirror makes no medical, learning-outcome, or grading claims.

## License

MIT. See `LICENSE`.

Built in Tashkent · Build with AI EdTech Hackathon 2026.
