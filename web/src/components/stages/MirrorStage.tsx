import { useEffect, useRef, useState } from "react";
import { Camera, CheckCircle2, ArrowRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MatchScore } from "@/components/MatchScore";
import { SyntheticAvatar } from "@/components/SyntheticAvatar";
import { useSession } from "@/store/session";
import { getDemoSentence } from "@/lib/demoData";
import { useLipTracker } from "@/hooks/useLipTracker";
import { cn } from "@/lib/utils";

interface Props {
  onDone: () => void;
  onSkip: () => void;
}

/**
 * Webcam + real MediaPipe Face Landmarker lip overlay.
 *
 * Flow:
 *   1. Acquire webcam stream.
 *   2. Lazily load the MediaPipe Tasks-Vision face landmarker (WebGL).
 *   3. Per frame: detect 468 face landmarks, extract the lip outline,
 *      and draw it on a canvas overlaid on the video element.
 *   4. Compute a real alignment score from mouth openness relative to
 *      a per-sentence target — no more fake 3-second timer.
 *
 * If the model fails to load (offline, no WebGL), the stage degrades
 * to a static SVG target and a "model unavailable" badge — the loop
 * still completes via the Skip button.
 */
export function MirrorStage({ onDone, onSkip }: Props) {
  const sentence = getDemoSentence(useSession((s) => s.sentenceId));
  const setPeakMirrorAlignmentPct = useSession((s) => s.setPeakMirrorAlignmentPct);
  const peakSoFar = useSession((s) => s.peakMirrorAlignmentPct);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [status, setStatus] = useState<"loading" | "ready" | "denied" | "matched">("loading");
  // v02 §6.7 lock beat — single 180ms flash when match crosses 95%.
  const [lockBeat, setLockBeat] = useState(false);

  const tracker = useLipTracker({ targetOpenness: 0.04, tolerance: 0.035 });

  // v02 §6.7 demo-cheat: scale the raw alignment so a within-bounds
  // user reaches 95%+ within ~6-8s of the stage entering. This is
  // explicit in the spec ("This is a demo, not a contest. The
  // audience needs to see victory.").
  const enterAtRef = useRef<number>(performance.now());
  const elapsedRamp = (() => {
    const elapsed = (performance.now() - enterAtRef.current) / 1000;
    // Linear ramp from 1.0 → 1.18 over 6 seconds.
    return Math.min(1.18, 1 + elapsed * 0.03);
  })();
  const boostedAlignment = Math.min(100, tracker.alignment * elapsedRamp);

  // onDone is wired straight to the user's button click — no auto-
  // advance, so no need to keep a ref to it.

  // 1. Acquire webcam.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 720, height: 540, facingMode: "user" },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          tracker.attach(videoRef.current);
        }
        setStatus("ready");
      } catch {
        setStatus("denied");
      }
    })();
    return () => {
      cancelled = true;
      tracker.detach();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2. Draw lip overlay each time the tracker emits a frame.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const frame = tracker.frame;
    if (!frame) return;

    // The <video> is mirrored (scale-x-[-1]) so the user feels natural;
    // we mirror the X axis here too so the overlay aligns with the video.
    const tx = (n: { x: number; y: number }) => ({ x: (1 - n.x) * w, y: n.y * h });

    const drawPoly = (pts: { x: number; y: number }[], stroke: string, fill?: string) => {
      if (pts.length === 0) return;
      ctx.beginPath();
      const first = tx(pts[0]);
      ctx.moveTo(first.x, first.y);
      for (let i = 1; i < pts.length; i++) {
        const p = tx(pts[i]);
        ctx.lineTo(p.x, p.y);
      }
      ctx.closePath();
      if (fill) {
        ctx.fillStyle = fill;
        ctx.fill();
      }
      ctx.lineWidth = 2;
      ctx.strokeStyle = stroke;
      ctx.stroke();
    };

    // v02 §5.2 — gold #C8932E (outer lip) + signal red #E5484D (inner).
    drawPoly(frame.outer, "#C8932E", "rgba(200, 147, 46, 0.18)");
    drawPoly(frame.inner, "#E5484D", "rgba(229, 72, 77, 0.06)");
  }, [tracker.frame]);

  // 3. When alignment crosses the threshold, mark matched.
  useEffect(() => {
    if (status !== "ready") return;
    if (boostedAlignment >= 80) setStatus("matched");
  }, [boostedAlignment, status]);

  // 3b. Record the peak alignment so the RESOLVED report can show the
  // best the user reached during the mirror step.
  useEffect(() => {
    const current = Math.round(boostedAlignment);
    if (peakSoFar === null || current > peakSoFar) {
      setPeakMirrorAlignmentPct(current);
    }
    // peakSoFar is updated by this same effect; intentionally read-only
    // dependency so we only refire when alignment moves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boostedAlignment]);

  // MIRROR stage: no auto-advance. User watches the synthetic avatar
  // mouth the sentence, mimics it on the right, and clicks "Lock in
  // match" (or presses Enter) when satisfied. Earlier builds auto-
  // advanced after ≥95% match held 1s per v02 §6.7 — removed by
  // user request for full manual control. Match-boost ramp and lock
  // beat stay (they only affect the visible score, not the transition).

  // Lock beat — fire a single 180ms flash the first time we cross 95%.
  const crossed95Ref = useRef(false);
  useEffect(() => {
    if (crossed95Ref.current) return;
    if (boostedAlignment >= 95) {
      crossed95Ref.current = true;
      setLockBeat(true);
      const t = window.setTimeout(() => setLockBeat(false), 180);
      return () => window.clearTimeout(t);
    }
  }, [boostedAlignment]);

  return (
    <div className="container py-14">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <Badge variant="gold">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-gold animate-pulse" />
            LIP MIRROR · FACE LANDMARKER
          </Badge>
          <Button variant="ghost" size="sm" onClick={onSkip}>
            <X className="h-4 w-4" /> Skip mirror
          </Button>
        </div>

        {/* v02 §6.7 hero match score — large mono number, counts up
            smoothly, turns success green at ≥90 with a soft glow. The
            boost ramp guarantees we reach 95% within ~6-8s per spec. */}
        <div className="flex justify-center mb-10">
          <MatchScore value={boostedAlignment} />
        </div>

        {/* v02 §6.7 split layout — left = synthetic Mandarin avatar,
            right = live webcam tracking. Both square cards, 400×400
            target, gap 48px on desktop. Lock beat: when match crosses
            95%, both cards pulse a single 180ms gold ring. */}
        <div className="grid md:grid-cols-2 gap-12 mb-8">
          {/* LEFT — YOUR AVATAR */}
          <div className="flex flex-col items-center gap-3">
            <div
              className={cn(
                "relative w-full aspect-square clinical-card overflow-hidden transition-shadow duration-200 ease-out",
                lockBeat &&
                  "ring-2 ring-gold shadow-[0_0_32px_rgba(200,147,46,0.4)]"
              )}
            >
              <SyntheticAvatar speaking />
            </div>
            <div className="font-data text-micro uppercase tracking-[0.22em] text-fg/60">
              Your Avatar
            </div>
          </div>

          {/* RIGHT — YOUR FACE (live tracking) */}
          <div className="flex flex-col items-center gap-3">
            <div
              className={cn(
                "relative w-full aspect-square clinical-card overflow-hidden transition-shadow duration-200 ease-out",
                lockBeat &&
                  "ring-2 ring-gold shadow-[0_0_32px_rgba(200,147,46,0.4)]"
              )}
            >
              {status === "loading" && (
                <div className="absolute inset-0 grid place-items-center font-data text-micro uppercase tracking-[0.22em] text-fg/40 z-10">
                  <span className="flex items-center gap-2">
                    <Camera className="h-4 w-4" /> Requesting webcam…
                  </span>
                </div>
              )}
              {status === "denied" && (
                <div className="absolute inset-0 grid place-items-center p-6 text-center z-10">
                  <div>
                    <div className="font-stamp text-xl mb-2">Webcam denied</div>
                    <p className="font-data text-xs text-fg/50 mb-4 uppercase tracking-[0.18em]">
                      Mirror step needs camera access.
                    </p>
                    <Button variant="outline" size="sm" onClick={onSkip}>
                      Continue without mirror
                    </Button>
                  </div>
                </div>
              )}
              <video
                ref={videoRef}
                className={cn(
                  "w-full h-full object-cover transform scale-x-[-1]",
                  status === "loading" || status === "denied" ? "opacity-0" : "opacity-100"
                )}
                playsInline
                muted
              />
              <canvas
                ref={canvasRef}
                className="absolute inset-0 w-full h-full pointer-events-none"
              />
              {tracker.error && (
                <div className="absolute top-3 left-3 right-3 z-20">
                  <Badge variant="signal">
                    <X className="h-3 w-3" /> Tracker offline: {tracker.error}
                  </Badge>
                </div>
              )}
              <div className="absolute bottom-0 inset-x-0 h-1 bg-fg/10">
                <div
                  className="h-full bg-gold transition-[width] duration-200"
                  style={{ width: `${boostedAlignment}%` }}
                />
              </div>
            </div>
            <div className="font-data text-micro uppercase tracking-[0.22em] text-fg/60">
              Your Face
            </div>
          </div>
        </div>

        {/* Compact stats row + sentence reference + continue button. */}
        <div className="grid md:grid-cols-[1fr_auto] gap-6 items-center">
          <div className="clinical-card p-4 flex items-center gap-6">
            <div className="flex-1">
              <div className="font-data text-micro uppercase tracking-[0.22em] text-fg/40">
                Sentence
              </div>
              <div className="font-cjk text-xl mt-1">{sentence?.hanzi}</div>
              <div className="font-data text-xs text-fg/50 mt-0.5">{sentence?.pinyin}</div>
            </div>
            <div className="hidden md:block">
              <div className="font-data text-micro uppercase tracking-[0.22em] text-fg/40">
                Landmarks
              </div>
              <div className="font-stamp text-lg leading-tight mt-1">
                {tracker.ready ? "468 tracked" : tracker.error ? "Tracker offline" : "Initializing…"}
              </div>
            </div>
            <div className="hidden md:block">
              <div className="font-data text-micro uppercase tracking-[0.22em] text-fg/40">
                Openness
              </div>
              <div className="font-mono text-lg tabular-nums mt-1">
                {tracker.frame ? tracker.frame.openness.toFixed(3) : "—"}
              </div>
            </div>
          </div>

          <Button
            variant={status === "matched" ? "gold" : "outline"}
            size="lg"
            onClick={onDone}
          >
            {status === "matched" ? (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Matched · continue
              </>
            ) : (
              <>
                Lock in match <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
