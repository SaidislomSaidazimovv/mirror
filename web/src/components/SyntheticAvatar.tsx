import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Mirror DevHandover v02 §6.7 — left-panel "AVATAR" wireframe. Spec
 * calls for a pre-recorded MediaPipe landmark sequence from a native
 * Mandarin speaker mouthing the target sentence. We don't have that
 * asset on hand for the hackathon, so this component generates a
 * procedural 468-point face mesh that visually communicates the same
 * idea: a calm, idealized face that opens and closes its mouth in a
 * speech-like rhythm.
 *
 * Honest fallback — the right panel still shows the user's real
 * 468-landmark face mesh via MediaPipe, so the comparison story is
 * "synthetic perfect target vs your live tracking." Swap in real
 * recorded JSON later (sync with golden audio playback) to fully
 * satisfy §6.7 + §14.3.
 */
interface Props {
  /** When true, animate the mouth area; otherwise hold the resting face. */
  speaking?: boolean;
  className?: string;
}

interface Point {
  x: number; // 0..1 within the face frame
  y: number; // 0..1 within the face frame
  region: "face" | "forehead" | "cheek" | "eye" | "brow" | "nose" | "mouth-outer" | "mouth-inner";
}

// Generate a stable 468-point procedural face mesh.
function buildFacePoints(): Point[] {
  const points: Point[] = [];

  // 1) Face outline — ellipse around (0.5, 0.5), ~64 points.
  const outlineCount = 64;
  for (let i = 0; i < outlineCount; i++) {
    const theta = (i / outlineCount) * Math.PI * 2;
    const rx = 0.36 + Math.sin(theta * 2) * 0.02;
    const ry = 0.45 + Math.cos(theta) * 0.03;
    points.push({
      x: 0.5 + Math.cos(theta) * rx,
      y: 0.5 + Math.sin(theta) * ry,
      region: "face",
    });
  }

  // 2) Forehead scatter — top third of the face oval.
  for (let i = 0; i < 60; i++) {
    const u = (i % 12) / 11;
    const v = Math.floor(i / 12) / 5;
    const x = 0.22 + u * 0.56;
    const y = 0.10 + v * 0.18;
    if ((x - 0.5) ** 2 / 0.35 ** 2 + (y - 0.5) ** 2 / 0.45 ** 2 < 0.95) {
      points.push({ x, y, region: "forehead" });
    }
  }

  // 3) Cheek scatter — left + right.
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < 36; i++) {
      const u = (i % 6) / 5;
      const v = Math.floor(i / 6) / 5;
      const x = 0.5 + side * (0.18 + u * 0.15);
      const y = 0.4 + v * 0.25;
      if ((x - 0.5) ** 2 / 0.36 ** 2 + (y - 0.5) ** 2 / 0.45 ** 2 < 0.95) {
        points.push({ x, y, region: "cheek" });
      }
    }
  }

  // 4) Eyes — two small clusters.
  for (let side = -1; side <= 1; side += 2) {
    const cx = 0.5 + side * 0.16;
    const cy = 0.4;
    for (let i = 0; i < 24; i++) {
      const theta = (i / 24) * Math.PI * 2;
      points.push({
        x: cx + Math.cos(theta) * 0.06,
        y: cy + Math.sin(theta) * 0.025,
        region: "eye",
      });
    }
    // Pupil dot
    points.push({ x: cx, y: cy, region: "eye" });
  }

  // 5) Brows — arc above each eye.
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < 18; i++) {
      const t = i / 17;
      const cx = 0.5 + side * (0.08 + t * 0.18);
      const cy = 0.34 + Math.sin(t * Math.PI) * -0.015;
      points.push({ x: cx, y: cy, region: "brow" });
    }
  }

  // 6) Nose — vertical scatter down center.
  for (let i = 0; i < 32; i++) {
    const t = i / 31;
    points.push({
      x: 0.5 + Math.sin(t * Math.PI * 3) * 0.015,
      y: 0.42 + t * 0.18,
      region: "nose",
    });
  }
  // Nostril dots.
  points.push({ x: 0.47, y: 0.62, region: "nose" });
  points.push({ x: 0.53, y: 0.62, region: "nose" });

  // 7) Mouth outer — ellipse, animatable vertically.
  const mouthOuterCount = 60;
  for (let i = 0; i < mouthOuterCount; i++) {
    const theta = (i / mouthOuterCount) * Math.PI * 2;
    points.push({
      x: 0.5 + Math.cos(theta) * 0.12,
      y: 0.74 + Math.sin(theta) * 0.04,
      region: "mouth-outer",
    });
  }

  // 8) Mouth inner — smaller ellipse, animates more.
  const mouthInnerCount = 40;
  for (let i = 0; i < mouthInnerCount; i++) {
    const theta = (i / mouthInnerCount) * Math.PI * 2;
    points.push({
      x: 0.5 + Math.cos(theta) * 0.08,
      y: 0.74 + Math.sin(theta) * 0.02,
      region: "mouth-inner",
    });
  }

  // 9) Fill the remaining count up to ~468 with random face-bounded points.
  let safety = 0;
  while (points.length < 468 && safety < 800) {
    safety++;
    const x = 0.14 + Math.random() * 0.72;
    const y = 0.08 + Math.random() * 0.84;
    if ((x - 0.5) ** 2 / 0.36 ** 2 + (y - 0.5) ** 2 / 0.45 ** 2 < 0.9) {
      points.push({ x, y, region: "face" });
    }
  }

  return points;
}

export function SyntheticAvatar({ speaking = true, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointsRef = useRef<Point[] | null>(null);

  useEffect(() => {
    if (!pointsRef.current) pointsRef.current = buildFacePoints();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const resize = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    let raf = 0;
    const start = performance.now();

    // Pre-compute nearest-neighbour pairs ONCE so the per-frame
    // FACEMESH_TESSELATION-style line drawing is cheap. For each point
    // we keep the indexes of its 3 closest neighbours (skipping itself).
    const allPoints = pointsRef.current!;
    const neighbours: number[][] = allPoints.map((p, i) => {
      const dists: { j: number; d: number }[] = [];
      for (let j = 0; j < allPoints.length; j++) {
        if (j === i) continue;
        const dx = allPoints[j].x - p.x;
        const dy = allPoints[j].y - p.y;
        dists.push({ j, d: dx * dx + dy * dy });
      }
      dists.sort((a, b) => a.d - b.d);
      return dists.slice(0, 3).map((e) => e.j);
    });

    const transformY = (p: Point, mouthOpen: number): number => {
      if (p.region === "mouth-outer") {
        const dy = (p.y - 0.74) * (1 + mouthOpen * 1.4);
        return 0.74 + dy;
      }
      if (p.region === "mouth-inner") {
        const dy = (p.y - 0.74) * (1 + mouthOpen * 3.0);
        return 0.74 + dy;
      }
      return p.y;
    };

    const draw = (now: number) => {
      const t = (now - start) / 1000;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      ctx.clearRect(0, 0, w, h);

      // Speech-like envelope: combination of two sines so the open/close
      // doesn't look perfectly periodic.
      const env = speaking
        ? 0.5 + 0.4 * Math.sin(t * 4.2) * 0.5 + 0.3 * Math.sin(t * 9 + 1) * 0.5
        : 0.05;
      const mouthOpen = Math.max(0.02, env);

      // v02 §6.7 — FACEMESH_TESSELATION lines at 0.5px width, fg-tertiary
      // 30%. Drawn first so dots sit on top.
      ctx.lineWidth = 0.5;
      ctx.strokeStyle = "rgba(163, 163, 163, 0.30)";
      ctx.beginPath();
      for (let i = 0; i < allPoints.length; i++) {
        const p = allPoints[i];
        const px = p.x * w;
        const py = transformY(p, mouthOpen) * h;
        for (const j of neighbours[i]) {
          if (j <= i) continue; // draw each pair once
          const q = allPoints[j];
          const qx = q.x * w;
          const qy = transformY(q, mouthOpen) * h;
          ctx.moveTo(px, py);
          ctx.lineTo(qx, qy);
        }
      }
      ctx.stroke();

      // v02 §6.7 — 1.5px dots at fg-primary 80% opacity.
      ctx.fillStyle = "rgba(10, 10, 10, 0.80)";
      for (const p of allPoints) {
        const px = p.x * w;
        const py = transformY(p, mouthOpen) * h;
        ctx.beginPath();
        ctx.arc(px, py, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    const onResize = () => resize();
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, [speaking]);

  return (
    <canvas
      ref={canvasRef}
      className={cn("w-full h-full block", className)}
      aria-label="Synthetic Mandarin avatar — pre-rendered face mesh target"
    />
  );
}
