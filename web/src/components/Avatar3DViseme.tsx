import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Bounds, Center } from "@react-three/drei";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import type { Group, Mesh, Object3D } from "three";
import { buildVisemeTrack, sampleVisemeTrack, type VisemeFrame } from "@/lib/pinyinToVisemes";
import { ARKIT_VISEME_WEIGHTS, applyMixedWeights } from "@/lib/arkitVisemeMap";

/**
 * Realistic 3D head with viseme-driven mouth animation.
 *
 * Loads the Three.js facecap.glb — a real human face scan with 52
 * ARKit blendshapes baked in (the same set Apple's Face ID and
 * ready-made avatar services use). The file is bundled locally under
 * /public/avatars/ because external avatar CDNs (Ready Player Me)
 * are unreachable from the dev's network.
 *
 * Bundled decoders: MeshoptDecoder (mesh compression) and
 * KTX2Loader+basis transcoder (textures). The basis WASM lives at
 * /basis/ — also bundled, so no runtime CDN dependency.
 */

interface Props {
  hanzi?: string;
  /** When false, the mouth holds the neutral "sil" shape. */
  speaking?: boolean;
  className?: string;
}

const GLB_URL = "/avatars/facecap.glb";
const BASIS_PATH = "/basis/";

export default function Avatar3DViseme({ hanzi, speaking = true, className }: Props) {
  const [webglFailed, setWebglFailed] = useState(false);

  const track = useMemo<VisemeFrame[]>(() => {
    if (!hanzi) return [{ t: 0, viseme: "sil" }];
    return buildVisemeTrack(hanzi);
  }, [hanzi]);

  const trackDuration = track.length > 0 ? track[track.length - 1].t + 0.5 : 1;

  if (webglFailed) {
    return (
      <div className={className ?? "w-full h-full grid place-items-center"}>
        <div className="text-center font-data text-micro uppercase tracking-[0.22em] text-fg/40">
          3D avatar unavailable
        </div>
      </div>
    );
  }

  return (
    <Canvas
      className={className}
      camera={{ position: [0, 0, 3], fov: 35, near: 0.01, far: 100 }}
      gl={{ antialias: true, alpha: true }}
      onCreated={({ gl }) => {
        gl.domElement.addEventListener("webglcontextlost", (e) => {
          e.preventDefault();
          setWebglFailed(true);
        });
      }}
      onError={() => setWebglFailed(true)}
    >
      <ambientLight intensity={0.9} />
      <directionalLight position={[1.5, 2.5, 3]} intensity={1.4} />
      <directionalLight position={[-3, 1, 2]} intensity={0.4} color="#bcd4ff" />
      <Suspense fallback={null}>
        {/* Bounds auto-fits the camera to the loaded model's bounding
            box. The facecap GLB has a non-obvious native scale (~0.15
            units tall) and would otherwise need hand-tuned camera
            distance. Center re-anchors the mesh so its centroid lands
            at world origin, which is what Bounds expects. */}
        <Bounds fit clip margin={1.15}>
          <Center>
            <FacecapRig track={track} duration={trackDuration} speaking={speaking} />
          </Center>
        </Bounds>
      </Suspense>
    </Canvas>
  );
}

interface RigProps {
  track: VisemeFrame[];
  duration: number;
  speaking: boolean;
}

function FacecapRig({ track, duration, speaking }: RigProps) {
  const { gl } = useThree();
  const [root, setRoot] = useState<Group | null>(null);
  // The mesh whose morph targets drive the visemes — facecap.glb's
  // mesh 2 has 52 ARKit blendshapes. We resolve it once after load.
  const morphMeshRef = useRef<Mesh | null>(null);
  const morphIndexRef = useRef<Map<string, number>>(new Map());
  const liveWeightsRef = useRef<Float32Array | null>(null);
  const targetWeightsRef = useRef<Float32Array | null>(null);

  // Load + decode the GLB once. KTX2Loader needs the renderer to pick
  // an optimal transcoding target (ETC1S vs UASTC).
  useEffect(() => {
    const ktx2 = new KTX2Loader().setTranscoderPath(BASIS_PATH).detectSupport(gl);
    const loader = new GLTFLoader();
    loader.setKTX2Loader(ktx2);
    loader.setMeshoptDecoder(MeshoptDecoder);
    let cancelled = false;
    loader.load(
      GLB_URL,
      (gltf) => {
        if (cancelled) return;
        const scene = gltf.scene;
        // Find the first mesh with morph targets — that's our head.
        let morphMesh: Mesh | null = null;
        scene.traverse((obj: Object3D) => {
          if (morphMesh) return;
          const m = obj as Mesh;
          if (m.isMesh && m.morphTargetDictionary && m.morphTargetInfluences) {
            morphMesh = m;
          }
        });
        if (morphMesh) {
          const mesh = morphMesh as Mesh;
          morphMeshRef.current = mesh;
          const dict = mesh.morphTargetDictionary ?? {};
          const idx = new Map<string, number>();
          for (const [name, i] of Object.entries(dict)) {
            idx.set(name, i as number);
          }
          morphIndexRef.current = idx;
          const count = mesh.morphTargetInfluences?.length ?? 0;
          liveWeightsRef.current = new Float32Array(count);
          targetWeightsRef.current = new Float32Array(count);
        }
        setRoot(scene as Group);
      },
      undefined,
      (err) => {
        // Loader errors bubble up to onError on the Canvas via
        // exception — but we also log here for visibility.
        console.error("[Avatar3DViseme] GLB load failed:", err);
      },
    );
    return () => {
      cancelled = true;
      ktx2.dispose();
    };
  }, [gl]);

  useFrame((_, delta) => {
    const mesh = morphMeshRef.current;
    const live = liveWeightsRef.current;
    const target = targetWeightsRef.current;
    const idx = morphIndexRef.current;
    if (!mesh || !live || !target || idx.size === 0) return;

    // Sample current and next viseme; mix with eased alpha.
    const t = (performance.now() / 1000) % duration;
    const sample = sampleVisemeTrack(track, t);
    const a = ARKIT_VISEME_WEIGHTS[sample.current];
    const b = ARKIT_VISEME_WEIGHTS[sample.next];

    if (speaking) {
      applyMixedWeights(target, idx, a, b, sample.alpha);
    } else {
      target.fill(0);
    }

    // Critically-damped lerp toward target weights. Same k as before
    // — tuned so consonant snaps don't read as glitches.
    const k = Math.min(1, delta * 14);
    const influences = mesh.morphTargetInfluences!;
    for (let i = 0; i < live.length; i++) {
      live[i] += (target[i] - live[i]) * k;
      influences[i] = live[i];
    }

    // Subtle eye blink ~ every 4-5s, ARKit blendshapes eyeBlink_L/R.
    const blinkPhase = (performance.now() / 1000) % 5;
    const blink = blinkPhase < 0.15 ? Math.sin((blinkPhase / 0.15) * Math.PI) : 0;
    const blinkL = idx.get("eyeBlink_L");
    const blinkR = idx.get("eyeBlink_R");
    if (blinkL !== undefined) influences[blinkL] = blink;
    if (blinkR !== undefined) influences[blinkR] = blink;
  });

  // Subtle idle head sway — applied to the root group.
  const groupRef = useRef<Group>(null);
  useFrame(() => {
    if (!groupRef.current) return;
    const t = performance.now() / 1000;
    groupRef.current.rotation.y = Math.sin(t * 0.35) * 0.05;
    groupRef.current.rotation.x = Math.sin(t * 0.28) * 0.02;
  });

  if (!root) return null;
  return (
    <group ref={groupRef}>
      <primitive object={root} />
    </group>
  );
}
