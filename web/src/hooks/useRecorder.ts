/**
 * Live microphone recording hook.
 *
 * Returns:
 *   - state: idle / recording / processing
 *   - liveSamples: short RMS history for the waveform component
 *   - start() / stop() — async; start resolves with true on success;
 *                       stop resolves with a Recording or null.
 *
 * Auto-stop: when elapsed reaches maxSeconds the hook calls the caller's
 * onFinish callback with the recording. Without that, the auto-stopped
 * recording would be discarded and the UI would silently stall.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Recorder, type Recording } from "@/lib/audio";

const HISTORY = 96;

export type RecorderState = "idle" | "recording" | "processing" | "error";

export interface UseRecorderResult {
  state: RecorderState;
  error: string | null;
  liveSamples: number[];
  elapsed: number;
  start: () => Promise<boolean>;
  stop: () => Promise<Recording | null>;
}

export function useRecorder(
  maxSeconds = 8,
  onFinish?: (recording: Recording) => void
): UseRecorderResult {
  const recorderRef = useRef<Recorder | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const startedAtRef = useRef<number>(0);
  // Latest callback reference — avoid stale closures when the parent
  // re-renders with a new onFinish.
  const onFinishRef = useRef(onFinish);
  useEffect(() => {
    onFinishRef.current = onFinish;
  }, [onFinish]);

  const [state, setState] = useState<RecorderState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [liveSamples, setLiveSamples] = useState<number[]>([]);
  const [elapsed, setElapsed] = useState(0);

  const teardown = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    analyserRef.current?.disconnect();
    analyserRef.current = null;
    if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
      void audioCtxRef.current.close();
    }
    audioCtxRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => () => teardown(), [teardown]);

  const finalize = useCallback(async (): Promise<Recording | null> => {
    const rec = recorderRef.current;
    if (!rec) return null;
    setState("processing");
    try {
      const result = await rec.stop();
      recorderRef.current = null;
      teardown();
      setState("idle");
      return result;
    } catch (e) {
      console.error(e);
      setError("Could not finalize the recording.");
      setState("error");
      teardown();
      return null;
    }
  }, [teardown]);

  const tick = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;
    const buf = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
    const rms = Math.sqrt(sum / buf.length);
    setLiveSamples((prev) => {
      const next = [...prev, rms];
      return next.length > HISTORY ? next.slice(-HISTORY) : next;
    });

    const e = (performance.now() - startedAtRef.current) / 1000;
    setElapsed(e);

    if (e >= maxSeconds) {
      // Auto-stop: deliver the recording to the caller so the UI advances.
      void finalize().then((result) => {
        if (result && onFinishRef.current) onFinishRef.current(result);
      });
      return;
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [maxSeconds, finalize]);

  const start = useCallback(async (): Promise<boolean> => {
    setError(null);
    setLiveSamples([]);
    setElapsed(0);
    try {
      const rec = new Recorder();
      await rec.start();
      recorderRef.current = rec;

      // Parallel analyser — sniffs the mic stream for live RMS.
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      source.connect(analyser);
      analyserRef.current = analyser;

      startedAtRef.current = performance.now();
      setState("recording");
      rafRef.current = requestAnimationFrame(tick);
      return true;
    } catch (e) {
      console.error(e);
      setError("Microphone access was denied or no device is available.");
      setState("error");
      teardown();
      return false;
    }
  }, [tick, teardown]);

  const stop = useCallback(() => finalize(), [finalize]);

  return { state, error, liveSamples, elapsed, start, stop };
}
