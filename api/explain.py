"""POST /api/explain — Gemini 2.0 Flash proxy for native-language tutoring.

The hardcoded DiagnosisCard headline + citation stay deterministic so the
demo screenshot moment is preserved. This endpoint adds a *second voice*
underneath the card: a 2–3 sentence native-language explanation of why
the user's L1 pulls them into this specific phoneme error, plus one
actionable articulatory tip.

Why Gemini specifically: the hackathon "Build with AI" stack slide marks
Gemini 2.0 Flash as Majburiy (mandatory). Wiring it to the diagnosis
explanation gives every attempt a unique, attempt-specific explanation
without sacrificing the screenshot-worthy clinical card.

Request:
    {
      "transcript": "user heard text (Mandarin)",
      "target":     "expected hanzi",
      "pinyin":     "expected pinyin",
      "l1":         "russian" | "uzbek",
      "phoneme":    "ʈʂ",
      "language":   "uz" | "ru" | "en"   # explanation language
    }

Response:
    {
      "explanation": "...",   # 2-3 sentences in `language`
      "tip":         "...",   # 1 short articulatory move
      "source":      "gemini" | "fallback",
      "reason":      "..."?
    }

Self-contained per the Vercel canonical-handler requirement (see asr.py).
"""
from __future__ import annotations

import json
import os
from http.server import BaseHTTPRequestHandler
from typing import Any

import requests


GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "").strip()
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.0-flash").strip()
GEMINI_ENDPOINT = (
    f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"
)
ALLOWED_ORIGINS = [
    o.strip()
    for o in os.environ.get("ALLOWED_ORIGINS", "*").split(",")
    if o.strip()
]

LANGUAGE_LABELS = {
    "uz": "Uzbek (O'zbek tili — Latin script)",
    "ru": "Russian (Русский язык)",
    "en": "English",
}

L1_LABELS = {
    "russian": "Russian (native Russian speaker)",
    "uzbek": "Uzbek (native Uzbek speaker)",
}


def _pick_origin(origin: str | None) -> str:
    if not origin:
        return "*"
    if "*" in ALLOWED_ORIGINS:
        return "*"
    if origin in ALLOWED_ORIGINS:
        return origin
    return ALLOWED_ORIGINS[0] if ALLOWED_ORIGINS else "*"


def _build_prompt(payload: dict[str, Any]) -> str:
    transcript = (payload.get("transcript") or "").strip()
    target = (payload.get("target") or "").strip()
    pinyin = (payload.get("pinyin") or "").strip()
    l1 = (payload.get("l1") or "russian").strip()
    phoneme = (payload.get("phoneme") or "").strip()
    language = (payload.get("language") or "en").strip()

    l1_human = L1_LABELS.get(l1, l1)
    lang_human = LANGUAGE_LABELS.get(language, "English")

    return (
        "You are a Mandarin pronunciation tutor speaking to a learner whose "
        f"L1 is {l1_human}.\n\n"
        f"Target Mandarin sentence: {target}\n"
        f"Pinyin: {pinyin}\n"
        f"What the learner actually produced: {transcript or '(unclear)'}\n"
        f"Mispronounced IPA phoneme: /{phoneme}/\n\n"
        "Write a calm, clinical explanation in "
        f"{lang_human}. Cover:\n"
        f"  - One sentence on WHY this phoneme is hard for an {l1_human} (L1 transfer reason).\n"
        "  - One sentence describing the correct articulatory target (tongue, lips, voicing).\n"
        "  - Keep the total explanation to 2–3 short sentences. Never invent academic citations.\n\n"
        "Also produce a separate one-line `tip` — a single actionable cue the learner can try right now.\n"
        "Reply strictly as JSON: {\"explanation\": \"...\", \"tip\": \"...\"}"
    )


def _fallback(payload: dict[str, Any], reason: str) -> dict[str, Any]:
    language = (payload.get("language") or "en").strip()
    phoneme = (payload.get("phoneme") or "").strip()
    canned = {
        "uz": {
            "explanation": (
                f"Ona tilingizda /{phoneme}/ tovushiga to'g'ridan-to'g'ri "
                "mos keladigan fonema yo'q, shuning uchun talaffuz qachondir "
                "yaqin variantga siljiydi. Lablar va tilingiz holatini boshqacha qiling."
            ),
            "tip": "Lablarni dumaloq qiling, tilni oldinga chiqaring va tovushni cho'zib turing.",
        },
        "ru": {
            "explanation": (
                f"В вашем родном языке нет прямого соответствия фонеме /{phoneme}/, "
                "поэтому артикуляция съезжает в ближайший знакомый звук. "
                "Сосредоточьтесь на положении языка и губ."
            ),
            "tip": "Округлите губы, выдвиньте язык вперёд и удерживайте звук.",
        },
        "en": {
            "explanation": (
                f"Your L1 has no direct match for /{phoneme}/, so the articulation "
                "slides into the nearest familiar sound. Reset the tongue position "
                "and lip rounding before the next attempt."
            ),
            "tip": "Round the lips firmly, push the tongue forward, and hold the sound.",
        },
    }
    body = canned.get(language, canned["en"])
    return {**body, "source": "fallback", "reason": reason}


def _call_gemini(payload: dict[str, Any]) -> dict[str, Any]:
    if not GEMINI_API_KEY:
        return _fallback(payload, "no_gemini_key")

    body = {
        "contents": [
            {"role": "user", "parts": [{"text": _build_prompt(payload)}]}
        ],
        "generationConfig": {
            "temperature": 0.4,
            "maxOutputTokens": 400,
            "responseMimeType": "application/json",
            "responseSchema": {
                "type": "object",
                "properties": {
                    "explanation": {"type": "string"},
                    "tip": {"type": "string"},
                },
                "required": ["explanation", "tip"],
            },
        },
    }

    try:
        res = requests.post(
            GEMINI_ENDPOINT,
            params={"key": GEMINI_API_KEY},
            headers={"Content-Type": "application/json"},
            data=json.dumps(body),
            timeout=12,
        )
        if res.status_code != 200:
            return _fallback(payload, f"gemini_{res.status_code}")
        data = res.json()
        candidates = data.get("candidates") or []
        if not candidates:
            return _fallback(payload, "no_candidates")
        parts = candidates[0].get("content", {}).get("parts", [])
        text = ""
        for part in parts:
            text += part.get("text", "")
        text = text.strip()
        if not text:
            return _fallback(payload, "empty_text")
        parsed = json.loads(text)
        explanation = (parsed.get("explanation") or "").strip()
        tip = (parsed.get("tip") or "").strip()
        if not explanation or not tip:
            return _fallback(payload, "missing_fields")
        return {
            "explanation": explanation,
            "tip": tip,
            "source": "gemini",
            "reason": None,
        }
    except requests.exceptions.Timeout:
        return _fallback(payload, "timeout")
    except json.JSONDecodeError:
        return _fallback(payload, "bad_json")
    except Exception as exc:  # noqa: BLE001
        return _fallback(payload, f"exception:{exc.__class__.__name__}")


class handler(BaseHTTPRequestHandler):  # noqa: N801 — Vercel requires this name
    def _cors(self) -> None:
        self.send_header("Access-Control-Allow-Origin", _pick_origin(self.headers.get("Origin")))
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Max-Age", "600")

    def do_OPTIONS(self) -> None:  # noqa: N802
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_POST(self) -> None:  # noqa: N802
        length = int(self.headers.get("Content-Length", "0") or "0")
        raw = self.rfile.read(length) if length > 0 else b""
        try:
            payload = json.loads(raw.decode("utf-8") or "{}")
        except json.JSONDecodeError:
            self._respond(400, {"error": "invalid JSON body"})
            return
        if not isinstance(payload, dict):
            self._respond(400, {"error": "body must be a JSON object"})
            return
        result = _call_gemini(payload)
        self._respond(200, result)

    def _respond(self, status: int, body: dict[str, Any]) -> None:
        self.send_response(status)
        self._cors()
        self.send_header("Content-Type", "application/json")
        encoded = json.dumps(body, ensure_ascii=False).encode("utf-8")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    def log_message(self, *_args) -> None:  # pragma: no cover
        return
