# Changelog

Reverse-chronological list of meaningful changes through the hackathon.
Hash = local git short SHA. Branch is `main` unless noted.

---

## v0.6 — Gemini 2.0 Flash AI Tutor (Majburiy compliance)

- **Add Gemini 2.0 Flash explanation panel under the diagnosis card**
  Hackathon "Build with AI" stack slide marks Gemini 2.0 Flash as
  Majburiy. The clinical DiagnosisCard stays deterministic (hardcoded
  headline + Flege-style citation → screenshot-worthy). Underneath,
  the new `AITutorPanel` fetches a per-attempt native-language
  explanation from Gemini: 2–3 sentence L1-transfer reason + one
  actionable articulatory tip. UZ / RU / EN toggle re-fetches from
  Gemini in the chosen language.
  - New `api/explain.py` — canonical-handler Gemini proxy. Sends
    `{ transcript, target, pinyin, l1, phoneme, language }`; receives
    `{ explanation, tip }` via `responseMimeType: application/json`
    with a strict response schema. Per-language canned fallback if
    `GEMINI_API_KEY` is missing or the upstream call fails, so the
    panel always has something to render. Source field (`gemini` |
    `fallback`) surfaced in the UI for honesty.
  - `web/src/lib/api.ts` — `api.explain()` with 15 s timeout.
  - `web/src/store/session.ts` — `tutor`, `tutorLoading`,
    `tutorLanguage` (default `uz`); reset on `session.reset()`.
  - `web/src/components/AITutorPanel.tsx` — gold-accented clinical
    card, language toggle (UZ/RU/EN), loader, "Try this" tip block.
  - `web/src/components/stages/DiagnosisStage.tsx` — renders panel
    under DiagnosisCard; auto-advance dropped (panel is the point).
  - `web/src/App.tsx` — `requestTutorExplanation` fires in the
    background when entering diagnosis stage so the card animates
    in immediately; language toggle re-runs the call against the
    cached transcript + trigger phoneme.
  - `.env.example`, `api/.env` — `GEMINI_API_KEY`, `GEMINI_MODEL`
    placeholders (real key set in Vercel + local `.env` only,
    never committed).

---

## v0.5 — Clinical motion pass (in progress)

- **`6cb344a` — Strip playful hover animations** (local, not pushed yet)
  Removed button hover translate-y, signal/gold glow shadows, active scale,
  mic-button ping rings, hover scale + glow halo. Killed `mic-ping`,
  `wave-pulse`, `phoneme-tick` keyframes. Hover is now colour-only — keeps
  the dev handover §10 "sharp, not bouncy, no spring animations, forensic
  not playful" direction. CSS bundle dropped 21.77 KB → 18.78 KB.

---

## v0.4 — HuggingFace Whisper actually working

- **`3ce0d6f` — Migrate HF Whisper to `router.huggingface.co`**
  Root cause of every `?asr=hf` test failing with `ConnectionError`: the
  legacy `api-inference.huggingface.co` host was shut down in HF's
  2024-12 Inference Providers migration. Switched the default endpoint
  to `https://router.huggingface.co/hf-inference/models/openai/whisper-large-v3`.
  Updated `.env.example`, `api/.env`, and the `asrEndpoint` echoed by
  `/api/health` so docs and runtime match. Whisper Large V3 now returns
  real Mandarin transcripts end-to-end — analyzing stage shows
  "WHISPER LARGE V3 · HUGGINGFACE" and the trigger phoneme is derived
  from a real character-level diff against the expected sentence.

- **`0871d81` — Bump `/api/asr` timeout to 90 s + expose ASR reason**
  Frontend was abandoning the HF call at 30 s while HF Whisper cold
  start can run 40–60 s with `x-wait-for-model: true`. Raised the
  client timeout. `session.asrReason` now carries the upstream failure
  reason (`hf · fallback · exception:ConnectionError`,
  `model_cold_start`, `no_hf_token`, `empty_transcript`, …) and
  `NoSpeechStage` renders it as a small clinical line so we can diagnose
  without DevTools.

- **`766b865` — Self-contain `api/asr.py`, `clone.py`, `synth.py`**
  Vercel kept rejecting `api/*.py` with "doesn't match any Serverless
  Functions inside the api directory" even after we listed each file
  explicitly. The actual cause was the indirect `handler = make_xxx_handler(post)`
  pattern: Vercel's static scanner needs a top-level
  `class handler(BaseHTTPRequestHandler):` declaration. Inlined the
  multipart parser, CORS helper, and upstream call into each handler.
  Removed `api/_utils.py` entirely.

- **`16f8a1a` — Rewrite `api/health.py` with canonical handler**
  Diagnostic step that confirmed the factory-handler theory. `/api/health`
  is the first endpoint Vercel detected after the rewrite.

- **`131a421` / `7a75e02`** — Tried `functions: { api/*.py }` glob and
  per-file lists in `vercel.json`. Both failed with pattern-mismatch
  errors. Eventually solved by the canonical-class rewrite, not by
  config changes.

---

## v0.3 — Hackathon submission compliance pass

- **`72c4130` — Rewrite README for hackathon §6**
  Compressed ~30 %. Surfaces live demo URL, repo URL, and active
  branch at the top. Added "Why this is honest" section (folds the L1
  cheat + Reference Audio Trap together). Stack table reflects current
  build. Disclosure table covers HF Whisper, Web Speech, MediaPipe,
  ElevenLabs, MediaRecorder, shadcn/ui. Env-var section keeps to
  placeholders (`your_xxx_here`), never real keys.

- **`2822a58` / `111a1fa` — Brand rename pass**
  Renamed across UI (header wordmark, footer, page title, meta
  description), env labels, package name, and README.

---

## v0.2 — Real backend, real ASR, real lip tracking

- **`820b3ef` — Real MediaPipe lip tracking; gold waveform unfrozen; ?asr=hf**
  `useLipTracker` hook lazily loads `@mediapipe/tasks-vision` + the
  face landmarker model from Google's CDN. Per frame extracts 468
  landmarks, draws the outer/inner lip polygons on a canvas overlaid
  on the mirrored video. Alignment % is computed from real mouth
  openness against a per-sentence target. GoldenStage waveform now
  animates a soft placeholder when no audio is playing and wires into
  an AnalyserNode for real RMS when audio does play; `<audio onError>`
  surfaces an "AUDIO MISSING" callout. Added `?asr=hf` URL flag that
  forces the HF Whisper fallback path even on Chrome.

- **`6642755` — Replace broken HF MDD with browser Web Speech API**
  The original handover named `mrrubino/wav2vec2-large-xlsr-53-l2-arctic-phoneme`
  as the phoneme MDD model, but that model isn't on HF Inference
  Providers — every request fell through to a hardcoded fallback that
  always returned the same `/y/` trigger, even on silence. Replaced
  with `SpeechRecognition` (zh-CN) for the primary ASR path. Added
  `charPhonemeIdx` to every demo sentence in `demoData.ts` so we can
  map the first mismatching character to its signature phoneme and
  highlight that cell in AnalyzingStage. Silent attempts now route
  to a dedicated `NoSpeechStage` instead of fabricating a diagnosis.

- **`7cf274d` — Rewrite audio capture on MediaRecorder**
  Previous `ScriptProcessorNode` + RAF pipeline had three race
  conditions: two parallel `getUserMedia` calls, RAF closure stranding
  the auto-stop loop, manual + auto stop both calling `finalize()`.
  New `useRecorder` owns a single MediaStream, wires MediaRecorder
  for capture + AnalyserNode for live RMS, runs RMS sampling on a
  60 ms `setInterval` and elapsed tracking on a 100 ms `setInterval`,
  and de-dupes `finalize()` via `finalizePromiseRef`. Manual and
  auto stop now go through the same codepath.

- **`288d4d7` — Fix auto-stop recording loss** (precursor to the
  MediaRecorder rewrite)

---

## v0.1 — Pivot to the single-screen loop

- **`265b98d` (and surrounding) — Strip the multi-page MVP**
  Ripped out the original 6-page build (Landing, FreeTest, Practice,
  Dashboard, PinyinChart, Lesson, Firebase auth, react-router) and
  replaced with the single-screen state machine (IDLE → RECORDING →
  ANALYZING → DIAGNOSIS → GOLDEN VOICE → MIRROR → RESOLVED). Stripped
  recharts, pitchy, react-router from `package.json`; added
  `@mediapipe/tasks-vision`. Pinned the early clinical theme (later
  replaced by the Mirror light theme in v0.6). Initial cut still used
  the factory-handler pattern that Vercel later rejected — see v0.4
  commits.

---

## v0.0 — Pre-pivot scaffold

Original Mandarin pronunciation trainer with pitch-curve overlay,
per-syllable scoring, Firebase auth, Firestore sync, adaptive drill
engine, 6 routed pages. Lives on git history before the pivot
(commits `d8476d9` … `265b98d`).
