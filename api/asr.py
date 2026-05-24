"""POST /api/asr — HuggingFace Whisper Large V3 proxy for Mandarin ASR.

The frontend prefers the browser's Web Speech API (Chrome/Edge/Safari)
because it returns in ~500ms with no cold start. This endpoint is the
fallback for Firefox or when the browser engine errors out — it
forwards the user's recorded audio to `openai/whisper-large-v3` and
returns the Mandarin transcript.

Response shape (matches what the browser ASR returns so the client can
swap providers transparently):

    { "transcript": "...", "source": "huggingface" | "fallback", "reason"?: "..." }

Self-contained on purpose — Vercel's serverless-function detection
keys off the top-level ``class handler(BaseHTTPRequestHandler):``
declaration; a file that builds its handler indirectly (via a
factory) or pulls one in from a sibling module is silently rejected.
"""
from __future__ import annotations

import json
import os
from http.server import BaseHTTPRequestHandler
from typing import Any

import requests


HF_TOKEN = os.environ.get("HF_TOKEN", "").strip()
# As of 2024-12, the legacy api-inference.huggingface.co host returns a
# permanent redirect to the new Inference Providers router. Pin the
# router URL so the call works whether or not the env override is set.
HF_ASR_ENDPOINT = os.environ.get(
    "HF_ASR_ENDPOINT",
    "https://router.huggingface.co/hf-inference/models/openai/whisper-large-v3",
)
ALLOWED_ORIGINS = [
    o.strip()
    for o in os.environ.get("ALLOWED_ORIGINS", "*").split(",")
    if o.strip()
]


def _pick_origin(origin: str | None) -> str:
    if not origin:
        return "*"
    if "*" in ALLOWED_ORIGINS:
        return "*"
    if origin in ALLOWED_ORIGINS:
        return origin
    return ALLOWED_ORIGINS[0] if ALLOWED_ORIGINS else "*"


def _extract(disposition: str, key: str) -> str | None:
    idx = disposition.find(key)
    if idx < 0:
        return None
    rest = disposition[idx + len(key):]
    if rest.startswith('"'):
        end = rest.find('"', 1)
        return rest[1:end] if end > 0 else None
    end = rest.find(";")
    return rest[:end] if end > 0 else rest


def _parse_multipart(body: bytes, content_type: str) -> dict[str, Any]:
    """Minimal multipart/form-data parser. Returns a dict where file parts
    are ``{"filename", "data", "content_type"}`` and text fields are strings."""
    if not content_type.startswith("multipart/form-data"):
        return {}
    marker = "boundary="
    idx = content_type.find(marker)
    if idx < 0:
        return {}
    boundary = content_type[idx + len(marker):].strip().strip('"')
    delimiter = b"--" + boundary.encode()
    parts = body.split(delimiter)
    result: dict[str, Any] = {}
    for part in parts:
        if not part or part.strip() in (b"", b"--", b"--\r\n"):
            continue
        if part.startswith(b"\r\n"):
            part = part[2:]
        if part.endswith(b"\r\n"):
            part = part[:-2]
        try:
            header_end = part.index(b"\r\n\r\n")
        except ValueError:
            continue
        raw_headers = part[:header_end].decode("utf-8", errors="ignore")
        data = part[header_end + 4:]
        headers: dict[str, str] = {}
        for line in raw_headers.split("\r\n"):
            if ":" in line:
                k, v = line.split(":", 1)
                headers[k.strip().lower()] = v.strip()
        disposition = headers.get("content-disposition", "")
        name = _extract(disposition, "name=")
        filename = _extract(disposition, "filename=")
        if not name:
            continue
        if filename:
            result[name] = {
                "filename": filename,
                "data": data,
                "content_type": headers.get("content-type", "application/octet-stream"),
            }
        else:
            result[name] = data.decode("utf-8", errors="replace")
    return result


def _call_whisper(audio_bytes: bytes, content_type: str) -> dict[str, Any]:
    """Forward audio to HuggingFace Whisper Large V3. Returns the same
    shape as the public endpoint regardless of success/failure."""
    if not HF_TOKEN:
        return {"transcript": "", "source": "fallback", "reason": "no_hf_token"}

    try:
        res = requests.post(
            HF_ASR_ENDPOINT,
            headers={
                "Authorization": f"Bearer {HF_TOKEN}",
                "Content-Type": content_type or "audio/webm",
                "x-wait-for-model": "true",  # tolerate cold start
            },
            data=audio_bytes,
            timeout=55,
        )
        if res.status_code == 503:
            return {"transcript": "", "source": "fallback", "reason": "model_cold_start"}
        if res.status_code != 200:
            return {
                "transcript": "",
                "source": "fallback",
                "reason": f"hf_{res.status_code}",
                "detail": res.text[:200],
            }
        data = res.json()
        transcript = ""
        if isinstance(data, dict):
            transcript = (data.get("text") or "").strip()
        elif isinstance(data, str):
            transcript = data.strip()
        elif isinstance(data, list) and data:
            first = data[0]
            if isinstance(first, dict):
                transcript = (first.get("text") or first.get("generated_text") or "").strip()
        return {
            "transcript": transcript,
            "source": "huggingface" if transcript else "fallback",
            "reason": None if transcript else "empty_transcript",
        }
    except requests.exceptions.Timeout:
        return {"transcript": "", "source": "fallback", "reason": "timeout"}
    except Exception as exc:  # noqa: BLE001
        return {
            "transcript": "",
            "source": "fallback",
            "reason": f"exception:{exc.__class__.__name__}",
        }


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
        ctype = self.headers.get("Content-Type", "")

        fields = _parse_multipart(raw, ctype)
        audio = fields.get("audio")
        if not isinstance(audio, dict):
            self._respond(400, {"error": "audio file is required"})
            return

        payload = _call_whisper(
            audio["data"],
            audio.get("content_type") or "audio/webm",
        )
        self._respond(200, payload)

    def _respond(self, status: int, body: dict[str, Any]) -> None:
        self.send_response(status)
        self._cors()
        self.send_header("Content-Type", "application/json")
        encoded = json.dumps(body).encode("utf-8")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    def log_message(self, *_args) -> None:  # pragma: no cover
        return
