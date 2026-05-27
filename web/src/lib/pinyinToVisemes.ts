import { pinyin } from "pinyin-pro";
import { finalToViseme, initialToViseme, type Viseme } from "./visemeMap";

/**
 * Time-stamped viseme — one mouth shape and how long it should hold.
 * `t` is seconds since the start of the utterance.
 */
export interface VisemeFrame {
  t: number;
  viseme: Viseme;
}

/**
 * Convert a Mandarin sentence to a timed viseme track that drives the
 * 3D head's mouth animation.
 *
 * Timing model — we don't have phoneme-level audio alignment from
 * ElevenLabs, so we approximate: each syllable gets `syllableMs`
 * total, split 35/65 between the initial consonant and the final
 * vowel (consonants are quicker, vowels carry the duration).
 * `audioDurationMs` (when known) is used to scale syllableMs so the
 * full track matches the audio length.
 */
export function buildVisemeTrack(
  hanzi: string,
  audioDurationMs?: number
): VisemeFrame[] {
  // pinyin-pro can split initials/finals when called with these patterns.
  const initials = pinyin(hanzi, {
    pattern: "initial",
    type: "array",
    toneType: "none",
    nonZh: "removed",
  }) as string[];
  const finals = pinyin(hanzi, {
    pattern: "final",
    type: "array",
    toneType: "none",
    nonZh: "removed",
  }) as string[];

  const syllableCount = Math.max(initials.length, finals.length);
  if (syllableCount === 0) return [{ t: 0, viseme: "sil" }];

  // Default ~280 ms per syllable (slow-clear Mandarin pacing); scale
  // to fit the real audio when we know the duration.
  let syllableMs = 280;
  if (audioDurationMs && audioDurationMs > 100) {
    syllableMs = audioDurationMs / syllableCount;
  }

  const frames: VisemeFrame[] = [{ t: 0, viseme: "sil" }];
  let cursor = 0;

  for (let i = 0; i < syllableCount; i++) {
    const initial = initials[i] ?? "";
    const final = finals[i] ?? "";
    const initialViseme = initialToViseme(initial);
    const finalViseme = finalToViseme(final);

    const consonantMs = initialViseme ? syllableMs * 0.35 : 0;
    const vowelMs = syllableMs - consonantMs;

    if (initialViseme) {
      frames.push({ t: cursor / 1000, viseme: initialViseme });
      cursor += consonantMs;
    }
    frames.push({ t: cursor / 1000, viseme: finalViseme });
    cursor += vowelMs;
  }

  // Trailing silence so the mouth closes after the last syllable.
  frames.push({ t: cursor / 1000, viseme: "sil" });
  return frames;
}

/**
 * Sample the viseme track at time `t` (seconds) and return the
 * current + next viseme plus an interpolation alpha (0..1). The 3D
 * head mixes between the two so transitions look smooth instead of
 * snapping shape-to-shape.
 */
export interface SampledViseme {
  current: Viseme;
  next: Viseme;
  alpha: number;
}

export function sampleVisemeTrack(
  track: VisemeFrame[],
  t: number
): SampledViseme {
  if (track.length === 0) return { current: "sil", next: "sil", alpha: 0 };
  if (t <= track[0].t) {
    return { current: track[0].viseme, next: track[0].viseme, alpha: 0 };
  }
  for (let i = 0; i < track.length - 1; i++) {
    const a = track[i];
    const b = track[i + 1];
    if (t >= a.t && t < b.t) {
      const span = b.t - a.t;
      const local = span > 0 ? (t - a.t) / span : 0;
      // Ease-in-out for visual smoothness — linear blends look robotic.
      const alpha = local < 0.5
        ? 2 * local * local
        : 1 - Math.pow(-2 * local + 2, 2) / 2;
      return { current: a.viseme, next: b.viseme, alpha };
    }
  }
  const last = track[track.length - 1].viseme;
  return { current: last, next: last, alpha: 0 };
}
