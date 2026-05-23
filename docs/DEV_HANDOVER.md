# OVOZ — Developer Handover (v01)

**For:** Saidislom
**Build window:** Hackathon
**Working name:** OVOZ ("voice" in Uzbek)
**One-line product:** Hear yourself speak perfect Mandarin — diagnosed by your L1.

---

## 1. The Demo We Are Shipping (Locked)

A 4-step loop, **≤10 seconds end-to-end**, single screen, desktop web:

1. **SPEAK** — User reads a Mandarin sentence into the mic.
2. **DIAGNOSE** — L1-specific error card appears ("RUSSIAN L1 DETECTED: palatalization on /sh/").
3. **GOLDEN VOICE** — User hears their *own* voice saying the same sentence with perfect tones.
4. **MIRROR** — Webcam + target lip overlay; user mimics until the gap closes.

That is the whole product. Nothing else ships. Build for the demo, not the product roadmap.

---

## 2. Stack (Locked)

| Layer | Choice | Why locked |
|---|---|---|
| Audio capture | Browser `MediaRecorder` API, 16 kHz mono PCM, WAV | Standard, no install |
| Phoneme MDD | `mrrubino/wav2vec2-large-xlsr-53-l2-arctic-phoneme` via Hugging Face Inference API | Public, pre-tuned, no GPU provisioning |
| L1 error model | **Hardcoded JSON rule set** (see §5) | We are faking it for the demo. Do not build a classifier. |
| Voice cloning | **ElevenLabs Flash v2.5** + Instant Voice Cloning | Sub-75ms generation, Mandarin supported, no GPU |
| Lip tracking | **MediaPipe Face Mesh** (JS, browser) | 60fps, zero install, 468 landmarks |
| LLM (optional) | Claude or GPT for diagnosis copy generation | Only used to pretty-print the diagnosis. Constrained output. |
| Frontend | Whatever Saidislom prefers (Next.js / Vite + React) | Designer's call |

**API keys needed:** Hugging Face (free tier), ElevenLabs (any tier with cloning), optional LLM provider.

---

## 3. The Reference Audio Trap (Critical — Don't Skip)

If we extract the voice clone from the user speaking *bad Mandarin*, their L1 accent bleeds into the "golden" output. Result: the golden voice still sounds Russian/Uzbek. Demo dies.

**The fix:** capture TWO recordings per session.

1. **REFERENCE** — User speaks 5–10 seconds in their native language (Russian or Uzbek). Pure timbre, no Mandarin contamination. This is what we send to ElevenLabs for cloning.
2. **TARGET** — User attempts the Mandarin sentence. This is what we run MDD on.

Onboarding flow: *"Read this sentence in your own language first."* Russian or Uzbek paragraph hardcoded. Once. Cache the clone.

---

## 4. UI State Machine

```
[IDLE]  ──speak──▶  [RECORDING]  ──stop──▶  [ANALYZING]
                                                │
                                                ▼
[RESOLVED]  ◀──pass──  [MIRROR]  ◀──play──  [GOLDEN_VOICE]  ◀──  [DIAGNOSIS]
     │                     │
     └──retry──────────────┘
```

| State | Duration | What renders |
|---|---|---|
| IDLE | — | Big mic button, sentence prompt, language toggle (RU/UZ) |
| RECORDING | up to 8s | Live waveform, stop button |
| ANALYZING | 1.5s max | Clinical loading state — phoneme grid teasing |
| DIAGNOSIS | 2s held | L1 card slams in, full screen takeover (THE HERO MOMENT) |
| GOLDEN_VOICE | 3s | User's cloned audio plays, waveform animates in gold |
| MIRROR | open-ended | Webcam + target lip overlay split or superimposed |
| RESOLVED | 1.5s | Green checkmark, "next sentence" or "try again" |

Total target: under 10 seconds from end of recording to mirror.

---

## 5. The L1 Detection Cheat (Hardcoded JSON)

We are **not** building a real L1 classifier. We're hardcoding diagnoses tied to:
(a) the language the user picked (RU or UZ), and
(b) the demo sentence they're reading.

```json
{
  "demo_sentences": {
    "wo_xi_huan_xue_zhong_wen": {
      "text": "我喜欢学中文",
      "pinyin": "wǒ xǐhuan xué zhōngwén",
      "expected_phonemes": ["w","ɔ","ɕ","i","x","u","an","ɕ","y","e","ʈʂ","ʊ","ŋ","w","ə","n"],
      "demo_errors": {
        "russian": {
          "trigger_phoneme": "ʈʂ",
          "diagnosis_headline": "RUSSIAN L1 DETECTED",
          "diagnosis_subhead": "Palatalization on /zh/ — your /ш/ is leaking through",
          "research_cite": "Chen et al., Interspeech 2013 · Soloveva 2020"
        },
        "uzbek": {
          "trigger_phoneme": "y",
          "diagnosis_headline": "UZBEK L1 DETECTED",
          "diagnosis_subhead": "/ü/ rounding incomplete — Uzbek vowel inventory missing this contrast",
          "research_cite": "Chinese-Uzbek contrastive analysis, IJEAT 2019"
        }
      }
    }
  }
}
```

Build 3 sentences with the same structure. Pick errors that the MDD will plausibly fire on so the demo feels honest.

**The illusion:** the phoneme MDD genuinely runs, and finds A real error. We then map that error to the pre-written diagnosis from the JSON. The L1 part is hardcoded; the error detection is real. This is honest enough.

---

## 6. Demo Sentences (Locked — Pre-Render Everything)

Pick 3, no more. Each must exercise a different difficulty:

1. **`你好，我叫...`** — Tone 3 sandhi + neutral particle. Easy opener.
2. **`我喜欢学中文`** — Retroflex zh, vowel progression. The hero sentence — use this in the demo.
3. **`这是一个绿色的雨伞`** — /ü/ vowel, multiple errors possible.

**For each sentence, pre-render:**
- A "golden voice" version in 3 different timbres (male warm, male bright, female warm) as fallback if cloning fails on stage.
- The target lip animation per phoneme (record once from a native speaker).

Pre-rendered files live in `/public/demo/` and are loaded if any API call exceeds 3s.

---

## 7. Failure Insurance (The Demo Cannot Fail)

| Failure | Mitigation |
|---|---|
| Wi-Fi dies mid-demo | All 3 demo sentences pre-rendered in `/public/demo/`. Switch to offline mode automatically. |
| ElevenLabs latency spike (>3s) | Timeout at 3s, fallback to pre-rendered golden voice matching user's gender. |
| HF MDD endpoint hangs | Hardcode the "right" error per demo sentence + language. The phoneme grid still animates honestly. |
| Mic noise / venue ambient | Use a directional USB mic on stage. Test 30 min before demo. Hard-gate audio input above noise floor. |
| MediaPipe webcam lag | Pre-record a target lip animation; sync to golden voice playback. Webcam can be skipped if it fails. |
| Voice clone leaks accent (the Reference Audio Trap) | See §3. NEVER clone from the bad Mandarin recording. Always from native-language reference. |

**Rule:** every API call has a 3-second timeout and a fallback that maintains the demo flow. The demo must complete even if the laptop has no internet.

---

## 8. Build Priority (Mid-Hackathon Triage)

Build in this order. Stop when time runs out — the earlier items are demo-critical, later ones are polish.

| Priority | Task | Hours |
|---|---|---|
| P0 | UI shell + state machine + record/playback | 2 |
| P0 | ElevenLabs cloning (reference audio → clone → playback) | 3 |
| P0 | 3 demo sentences + pre-rendered fallback golden audio | 1 |
| P0 | Diagnosis card animation (the hero moment) | 1 |
| P1 | HF phoneme MDD wired in | 1.5 |
| P1 | MediaPipe lip overlay + target lip animation | 2 |
| P1 | Failure-mode fallbacks (offline mode, timeouts) | 1.5 |
| P2 | LLM-generated diagnosis copy (optional pretty-print) | 1 |
| P2 | Polish, easing, sound design | 2 |
| P2 | Demo rehearsal + fixing what breaks | 2 |

**If we have to cut something, cut MediaPipe last and LLM first.** The lip overlay is the third wow — it carries weight even if simple.

---

## 9. Out Of Scope (Do Not Build)

- ❌ Login / accounts / database
- ❌ Streaks, XP, leaderboards, gamification
- ❌ Mobile app or responsive mobile UI
- ❌ Tutorial / onboarding beyond the language toggle
- ❌ Multi-language UI translations
- ❌ Settings, preferences, profiles
- ❌ Free conversation mode
- ❌ Any "learning path" or curriculum
- ❌ Anything that adds a button to the screen we haven't named in this doc

The demo screen has at most: record button, language toggle, sentence prompt, state visuals. That's it.

---

## 10. Visual Direction (Hand-off to Oppoq's Frontend)

The frontend is a clinical, high-end **diagnostic instrument**, not a gamified language app.

- Background: deep black `#0a0a0a`
- Foreground: pure white `#FFFFFF`
- Signal red (the L1 error): `#FF3838` or similar hot
- Golden voice (the corrected output): warm metallic gold, animated
- Typography: heavy, condensed, high-density. Think medical imaging UI or Bloomberg terminal, not Duolingo.
- Grid: strict Josef Müller-Brockmann columns.
- Webcam: frosted dispersion glass overlay, lip mesh in white at 60% opacity.
- Motion: state transitions are sharp, not bouncy. No spring animations. Easing should feel forensic, not playful.

The user is being **diagnosed**, not entertained.

---

## 11. Demo Day Checklist

- [ ] Laptop charged + charger packed
- [ ] USB directional mic (do not use built-in mic)
- [ ] HDMI / USB-C adapter for venue projector
- [ ] All 3 sentences pre-rendered and loaded offline
- [ ] Reference audio for the on-stage user pre-recorded
- [ ] Voice clone pre-generated and cached (don't clone live if possible)
- [ ] Test the full demo loop 3× minutes before going on
- [ ] Have a second laptop ready as backup
- [ ] Screen recorder running silently as a final fallback (worst case: play the recording)

---

## 12. Questions That Should Block Build

If any of these aren't answered, stop and resolve:

1. Who is the on-stage user? Their voice gets pre-cloned the night before.
2. ElevenLabs subscription tier — does it support Instant Voice Cloning + Mandarin on Flash v2.5?
3. Venue Wi-Fi quality — if unreliable, switch to fully offline demo mode using pre-renders.

Everything else: just ship.
