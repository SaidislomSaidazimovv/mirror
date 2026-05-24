import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface Props {
  /** RMS history, newest values appended last. */
  samples: number[];
  tone?: "signal" | "gold" | "fg";
  variant?: "live" | "static";
  height?: number;
  /** Gain multiplier — clamped to [0, 1] after multiply. */
  gain?: number;
  /** Bar width in px. v02 §6.3 uses 4 (recording), §6.6 uses 6 (golden). */
  barWidth?: number;
  /** Gap between bars in px. */
  gap?: number;
  /** Total number of bars. v02 §6.3 uses 30. */
  bars?: number;
  /** v02 §5.5 — gentle 1.2s pulse on the whole waveform (scale 1↔1.04). */
  pulse?: boolean;
}

// v02 §5.2 — signal-red #E5484D (used in DIAGNOSIS / RECORDING),
// gold #C8932E (used in GOLDEN VOICE), fg-primary #0A0A0A (default
// bars on the light canvas).
const COLORS: Record<"signal" | "gold" | "fg", string> = {
  signal: "#E5484D",
  gold: "#C8932E",
  fg: "#0A0A0A",
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
  tone = "fg",
  variant = "live",
  height = 80,
  gain = 18,
  barWidth = 2,
  gap = 2,
  bars,
  pulse = false,
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

    const stride = barWidth + gap;
    // If `bars` is specified, cap the bar count to that exact number
    // (v02 §6.3 = 30, §6.6 ~80). Otherwise fill all available width.
    const maxBars = bars ?? Math.floor(clientWidth / stride);
    const barCount = Math.min(smoothed.length, maxBars);
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
  }, [samples, tone, gain, barWidth, gap, bars]);

  return (
    <canvas
      ref={canvasRef}
      className={cn(
        "w-full block",
        variant === "live" && "transition-opacity",
        // v02 §5.5 — gentle 1.2s pulse on the whole waveform.
        pulse && "animate-[waveformPulse_1200ms_ease-in-out_infinite]"
      )}
      style={{ height }}
    />
  );
}
