import type { Viseme } from "./visemeMap";

/**
 * Map our 12 Mandarin visemes to ARKit blendshape weights.
 *
 * ARKit defines 52 blendshapes (jawOpen, mouthFunnel, mouthSmile_L,
 * etc.) — Apple's spec is the de facto standard for face capture
 * models. The facecap.glb shipped with Three.js examples uses this
 * exact naming. Future swap to a Ready Player Me avatar will work
 * with the same map (RPM exports `?morphTargets=ARKit` with the same
 * names).
 *
 * Each viseme contributes a sparse set of blendshape weights. The
 * 3D component lerps between consecutive viseme weight maps to
 * produce smooth speech motion.
 */
export type ArkitWeights = Record<string, number>;

const sil: ArkitWeights = {};

export const ARKIT_VISEME_WEIGHTS: Record<Viseme, ArkitWeights> = {
  sil,

  // Bilabial close — lips together, slight pucker (p, b, m).
  PP: {
    mouthClose: 1.0,
    mouthPucker: 0.3,
    mouthRollLower: 0.2,
    mouthRollUpper: 0.2,
  },

  // Labiodental — lower lip tucks under upper teeth (f).
  FF: {
    mouthLowerDown_L: 0.5,
    mouthLowerDown_R: 0.5,
    mouthRollLower: 0.4,
    jawOpen: 0.08,
  },

  // Alveolar — small open, slight tongue-tip cue (d, t, n, l).
  DD: {
    jawOpen: 0.22,
    mouthStretch_L: 0.2,
    mouthStretch_R: 0.2,
    tongueOut: 0.1,
  },

  // Velar — back of mouth, slightly more open (g, k, h).
  kk: {
    jawOpen: 0.35,
    mouthFunnel: 0.1,
  },

  // Palatal / retroflex — narrow rounded (j, q, x, zh, ch, sh, r).
  CH: {
    mouthPucker: 0.5,
    mouthFunnel: 0.3,
    jawOpen: 0.18,
    mouthRollUpper: 0.15,
  },

  // Sibilant — teeth visible, lips spread (z, c, s).
  SS: {
    mouthSmile_L: 0.4,
    mouthSmile_R: 0.4,
    mouthStretch_L: 0.35,
    mouthStretch_R: 0.35,
    jawOpen: 0.08,
  },

  // Open central vowel (a, ai, ao, an, ang).
  aa: {
    jawOpen: 0.75,
    mouthLowerDown_L: 0.45,
    mouthLowerDown_R: 0.45,
    mouthUpperUp_L: 0.15,
    mouthUpperUp_R: 0.15,
  },

  // Mid-front vowel (e, ei, en, eng, er).
  E: {
    jawOpen: 0.38,
    mouthSmile_L: 0.3,
    mouthSmile_R: 0.3,
    mouthStretch_L: 0.2,
    mouthStretch_R: 0.2,
  },

  // Closed-front vowel — wide smile (i, ie, in, ing, y).
  I: {
    jawOpen: 0.1,
    mouthSmile_L: 0.7,
    mouthSmile_R: 0.7,
    mouthStretch_L: 0.45,
    mouthStretch_R: 0.45,
    mouthDimple_L: 0.2,
    mouthDimple_R: 0.2,
  },

  // Rounded-mid vowel — oh-shape (o, ou, ong).
  O: {
    jawOpen: 0.42,
    mouthFunnel: 0.75,
    mouthPucker: 0.4,
  },

  // Rounded-close vowel — u/ü/w shape.
  U: {
    jawOpen: 0.1,
    mouthPucker: 0.85,
    mouthFunnel: 0.5,
    mouthRollUpper: 0.2,
    mouthRollLower: 0.2,
  },
};

/**
 * Blend two ARKit weight maps (sparse) into a dense weight array
 * sized to the mesh's morphTargetInfluences. Out-of-vocab blendshape
 * names are ignored silently — the same map works whether the
 * loaded GLB exposes 14, 52, or 80 morphs.
 */
export function applyMixedWeights(
  out: Float32Array,
  morphIndex: Map<string, number>,
  a: ArkitWeights,
  b: ArkitWeights,
  alpha: number,
) {
  out.fill(0);
  for (const [name, weight] of Object.entries(a)) {
    const idx = morphIndex.get(name);
    if (idx !== undefined) out[idx] += weight * (1 - alpha);
  }
  for (const [name, weight] of Object.entries(b)) {
    const idx = morphIndex.get(name);
    if (idx !== undefined) out[idx] += weight * alpha;
  }
}
