/**
 * Mandarin pinyin → viseme mapping.
 *
 * Visemes are visual phoneme classes — a small set of distinct mouth
 * shapes that cover the full phonetic inventory. We use a simplified
 * Oculus/ARKit-style set (15 entries) rather than the full IPA chart
 * because beyond ~15 shapes the human eye stops resolving differences
 * and the animation cost grows.
 *
 * Mapping strategy: each Mandarin initial maps to a single consonant
 * viseme; each final reduces to its nuclear vowel viseme. Glides (y, w)
 * become their vowel counterpart (I, U) since they share lip posture.
 *
 * The numeric weights drive the 3D head's mouth blendshape mixer —
 * see Avatar3DViseme.tsx. They're tuned for visual clarity, not
 * acoustic accuracy.
 */

export type Viseme =
  | "sil"  // silence / neutral
  | "PP"   // bilabial close — p, b, m
  | "FF"   // labiodental — f
  | "DD"   // alveolar — d, t, n, l (open jaw, tongue tip)
  | "kk"   // velar — g, k, h (back of mouth, slight open)
  | "CH"   // palatal/retroflex — j, q, x, zh, ch, sh, r (rounded narrow)
  | "SS"   // sibilant — z, c, s (teeth visible, narrow)
  | "aa"   // open vowel — a, ai, ao, an, ang
  | "E"    // mid-front — e, ei, en, eng
  | "I"    // closed-front — i, ie, in, ing, y
  | "O"    // rounded-mid — o, ou, ong
  | "U";   // rounded-close — u, ü, uo, ua, w, etc.

/** Mouth-shape weights for each viseme.
 *  jawOpen     : 0..1   how far the jaw drops
 *  mouthWide   : -1..1  -1 = pursed/rounded, +1 = spread/smiling
 *  lipClose    : 0..1   how tightly the lips seal (PP/FF/M)
 *  teethShow   : 0..1   amount of teeth visible (SS/FF)
 *  tongueShow  : 0..1   tongue tip visibility (DD/L/N)
 */
export interface VisemeShape {
  jawOpen: number;
  mouthWide: number;
  lipClose: number;
  teethShow: number;
  tongueShow: number;
}

export const VISEME_SHAPES: Record<Viseme, VisemeShape> = {
  sil: { jawOpen: 0.05, mouthWide: 0, lipClose: 0.1, teethShow: 0, tongueShow: 0 },
  PP:  { jawOpen: 0.0,  mouthWide: 0, lipClose: 1.0, teethShow: 0, tongueShow: 0 },
  FF:  { jawOpen: 0.1,  mouthWide: 0.2, lipClose: 0.4, teethShow: 0.6, tongueShow: 0 },
  DD:  { jawOpen: 0.25, mouthWide: 0.1, lipClose: 0, teethShow: 0.2, tongueShow: 0.5 },
  kk:  { jawOpen: 0.35, mouthWide: 0,   lipClose: 0, teethShow: 0.1, tongueShow: 0 },
  CH:  { jawOpen: 0.15, mouthWide: -0.3, lipClose: 0.2, teethShow: 0.3, tongueShow: 0.2 },
  SS:  { jawOpen: 0.08, mouthWide: 0.5, lipClose: 0, teethShow: 0.9, tongueShow: 0 },
  aa:  { jawOpen: 0.85, mouthWide: 0.1, lipClose: 0, teethShow: 0.1, tongueShow: 0 },
  E:   { jawOpen: 0.45, mouthWide: 0.6, lipClose: 0, teethShow: 0.4, tongueShow: 0 },
  I:   { jawOpen: 0.15, mouthWide: 0.9, lipClose: 0, teethShow: 0.6, tongueShow: 0 },
  O:   { jawOpen: 0.5,  mouthWide: -0.7, lipClose: 0.1, teethShow: 0, tongueShow: 0 },
  U:   { jawOpen: 0.25, mouthWide: -0.9, lipClose: 0.3, teethShow: 0, tongueShow: 0 },
};

/** Initial (声母) → consonant viseme. */
const INITIAL_TO_VISEME: Record<string, Viseme> = {
  b: "PP", p: "PP", m: "PP",
  f: "FF",
  d: "DD", t: "DD", n: "DD", l: "DD",
  g: "kk", k: "kk", h: "kk",
  j: "CH", q: "CH", x: "CH",
  zh: "CH", ch: "CH", sh: "CH", r: "CH",
  z: "SS", c: "SS", s: "SS",
  y: "I", w: "U",
};

/** Final (韵母) → nuclear-vowel viseme. We collapse compound finals
 *  to their dominant vowel — diphthongs would need a 2-viseme glide
 *  but the cost/benefit doesn't justify it at this fidelity. */
const FINAL_TO_VISEME: Record<string, Viseme> = {
  a: "aa", ai: "aa", ao: "aa", an: "aa", ang: "aa",
  o: "O", ou: "O", ong: "O",
  e: "E", ei: "E", en: "E", eng: "E", er: "E",
  i: "I", ie: "I", in: "I", ing: "I", iao: "I", iou: "I", iu: "I",
  ia: "I", ian: "I", iang: "I", iong: "I",
  u: "U", uo: "U", uai: "U", uei: "U", ui: "U", un: "U",
  ua: "U", uan: "U", uang: "U", ueng: "U",
  v: "U", ve: "U", van: "U", vn: "U",  // ü-finals (pinyin-pro returns 'v' for ü)
  "ü": "U", "üe": "U", "üan": "U", "ün": "U",
};

/** Lookup: pinyin initial (lowercase, may be empty string) → viseme. */
export function initialToViseme(initial: string): Viseme | null {
  if (!initial) return null;
  return INITIAL_TO_VISEME[initial.toLowerCase()] ?? null;
}

/** Lookup: pinyin final (lowercase, tone stripped) → viseme. */
export function finalToViseme(final: string): Viseme {
  if (!final) return "sil";
  // Strip any tone marks left behind by pinyin-pro's "num" pattern.
  const clean = final.toLowerCase().replace(/[1-5]/g, "");
  return FINAL_TO_VISEME[clean] ?? "aa";
}
