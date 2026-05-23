import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface Props {
  /** RMS history, newest values appended last. */
  samples: number[];
  tone?: "signal" | "gold" | "white";
  variant?: "live" | "static";
  height?: number;
  /** Gain multiplier — clamped to [0, 1] after multiply. */
  gain?: number;
}

const COLORS: Record<"signal" | "gold" | "white", string> = {
  signal: "#FF3838",
  gold: "#D4A437",
  white: "#FFFFFF",
};

/**
 * Smooth waveform renderer with EMA smoothing + amplification.
 *
 * Why this design:
 *   - Raw RMS jitters frame to frame, which reads as "frozen" or "twitchy"
 *     bars; an EMA pass over the samples buffer calms it without losing
 *     dynamics.
 *   - Soft speech produces tiny RMS (≈0.01) that vanish at full scale;
 *     default gain 18× makes them visible without clipping normal speech.
 *   - Bars are drawn from the right edge so the newest RMS is adjacent to
 *     the cursor — feels alive instead of left-anchored.
 */
export function Waveform({
  samples,
  tone = "white",
  variant = "live",
  height = 80,
  gain = 18,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const { clientWidth, clientHeight } = canvas;
    canvas.width = clientWidth * dpr;
    canvas.height = clientHeight * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, clientWidth, clientHeight);

    const color = COLORS[tone];

    // Idle baseline — a faint center hairline when there's no data yet.
    if (samples.length === 0) {
      ctx.strokeStyle = color + "33";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, clientHeight / 2);
      ctx.lineTo(clientWidth, clientHeight / 2);
      ctx.stroke();
      return;
    }

    // EMA smoothing recomputed each frame — cheap (≤96 ops).
    const alpha = 0.4; // higher = more responsive, lower = smoother
    const smoothed: number[] = new Array(samples.length);
    let prev = samples[0];
    for (let i = 0; i < samples.length; i++) {
      prev = prev + alpha * (samples[i] - prev);
      smoothed[i] = prev;
    }

    const barWidth = 2;
    const gap = 2;
    const stride = barWidth + gap;
    const barCount = Math.min(smoothed.length, Math.floor(clientWidth / stride));
    const mid = clientHeight / 2;
    const usable = clientHeight - 6;

    ctx.fillStyle = color;
    for (let i = 0; i < barCount; i++) {
      const idx = smoothed.length - 1 - i;
      if (idx < 0) break;
      const v = Math.min(1, Math.max(0, smoothed[idx] * gain));
      const h = Math.max(2, v * usable);
      const x = clientWidth - (i + 1) * stride;
      ctx.fillRect(x, mid - h / 2, barWidth, h);
    }

    // Subtle leading edge highlight on the freshest bar.
    if (samples.length > 0) {
      const latest = Math.min(1, Math.max(0, smoothed[smoothed.length - 1] * gain));
      const h = Math.max(2, latest * usable);
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.4;
      ctx.fillRect(clientWidth - 6, mid - (h + 6) / 2, 4, h + 6);
      ctx.globalAlpha = 1;
    }
  }, [samples, tone, gain]);

  return (
    <canvas
      ref={canvasRef}
      className={cn("w-full block", variant === "live" && "transition-opacity")}
      style={{ height }}
    />
  );
}
