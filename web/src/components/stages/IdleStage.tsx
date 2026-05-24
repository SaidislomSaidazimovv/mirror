import { motion } from "motion/react";
import { Mic, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LanguageToggle } from "@/components/LanguageToggle";
import { SentencePrompt } from "@/components/SentencePrompt";
import { useSession } from "@/store/session";
import { DEMO_USER } from "@/data/demoUser";
import { ease } from "@/motion/presets";

interface Props {
  onStartRecording: () => void;
  onStartReference: () => void;
}

/**
 * The opening screen — mic button, target sentence, language toggle.
 *
 * If we haven't captured a reference clip yet, we surface a one-line
 * notice that the reference is missing. The reference is the input to
 * ElevenLabs cloning per §3 ("Reference Audio Trap"); without it the
 * golden voice will leak the user's accent.
 */
export function IdleStage({ onStartRecording, onStartReference }: Props) {
  const reference = useSession((s) => s.reference);
  const clone = useSession((s) => s.clone);

  return (
    <div className="container py-14 grid place-items-center">
      <div className="w-full max-w-3xl">
        <SentencePrompt />

        <div className="mt-16 flex flex-col items-center gap-6">
          <div className="relative">
            {/* v02 §5.6 mesh motif — corner accents framing the mic. */}
            <div
              className="absolute -top-6 -left-6 w-10 h-10 mesh-corner pointer-events-none"
              aria-hidden
            />
            <div
              className="absolute -top-6 -right-6 w-10 h-10 mesh-corner pointer-events-none"
              aria-hidden
            />
            <div
              className="absolute -bottom-6 -left-6 w-10 h-10 mesh-corner pointer-events-none"
              aria-hidden
            />
            <div
              className="absolute -bottom-6 -right-6 w-10 h-10 mesh-corner pointer-events-none"
              aria-hidden
            />
            {/* v02 §6.2 mic spec:
                 - 120px diameter circle
                 - bg --fg-primary (near black)
                 - subtle inset radial gradient
                 - icon lucide Mic 36px white
                 - idle breathing scale 1↔1.015 over 3s ease-in-out
                 - hover scale 1.04 + shadow-3 (200ms)
                 - press scale 0.96 (100ms) */}
            <motion.button
              onClick={onStartRecording}
              className="relative grid place-items-center w-30 h-30 rounded-full bg-fg text-bg shadow-2 transition-shadow duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-4 focus-visible:ring-offset-bg"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 50% 35%, rgba(255,255,255,0.08) 0%, transparent 60%)",
              }}
              animate={{ scale: [1, 1.015, 1] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              whileHover={{
                scale: 1.04,
                transition: { duration: 0.2, ease: ease.out },
              }}
              whileTap={{
                scale: 0.96,
                transition: { duration: 0.1, ease: ease.out },
              }}
              aria-label="Start recording"
            >
              {/* v02 §5.6 — subtle mesh dots inside the mic button. */}
              <span
                className="absolute inset-2 rounded-full bg-mesh-dots opacity-30 pointer-events-none"
                aria-hidden
              />
              <Mic className="h-9 w-9 relative" strokeWidth={1.5} />
            </motion.button>
          </div>

          <div className="text-center">
            <div className="font-data text-[11px] uppercase tracking-[0.22em] text-fg/40">
              Press <kbd className="px-1.5 py-0.5 border border-line text-fg/60 font-data text-[10px]">SPACE</kbd> to speak · hold to record · auto-stops at 8s
            </div>
          </div>

          <div className="mt-2 flex items-center gap-4">
            <LanguageToggle />
          </div>
        </div>

        <div className="mt-14">
          <div className="hairline mb-6" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ReferenceCard
              ok={!!reference}
              cloned={!!clone}
              presetVoiceId={DEMO_USER.voiceId}
              presetVoiceName={DEMO_USER.voiceName}
              onStart={onStartReference}
            />
            <BeliefCard />
          </div>
        </div>
      </div>
    </div>
  );
}

interface ReferenceCardProps {
  ok: boolean;
  cloned: boolean;
  presetVoiceId: string | null;
  presetVoiceName: string | null;
  onStart: () => void;
}

function ReferenceCard({ ok, cloned, presetVoiceId, presetVoiceName, onStart }: ReferenceCardProps) {
  // Hardcoded preset voice (Mirror DevHandover v02 §3) takes effect only
  // when this session has no fresh capture yet — a live ReferenceStage
  // capture always wins. Surface the preset state so the user knows the
  // Golden Voice step will work even without re-capturing.
  const hasPreset = !!presetVoiceId && !ok;

  // v02 §5.2 color discipline: gold appears only when Golden Voice plays,
  // never in IDLE state badges. Use default/signal variants here instead.
  const badgeVariant: "default" | "signal" = ok ? "default" : hasPreset ? "default" : "signal";
  const badgeLabel = ok
    ? cloned
      ? "VOICE CLONED"
      : "REFERENCE OK"
    : hasPreset
      ? "PRESET VOICE READY"
      : "MISSING";

  return (
    <div className="clinical-card clinical-card-interactive p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="font-data text-[10px] uppercase tracking-[0.2em] text-fg/40">Step 0 · Reference</span>
        <Badge variant={badgeVariant}>{badgeLabel}</Badge>
      </div>
      <div className="font-stamp text-2xl leading-tight mb-2">Capture native timbre first.</div>
      <p className="text-fg/50 text-sm font-data leading-relaxed mb-4">
        {hasPreset
          ? `Pre-cloned voice "${presetVoiceName ?? "demo"}" is wired in — Golden Voice plays this until you record a fresh reference.`
          : "Read a short paragraph in your own language so the golden voice clones your timbre without your Mandarin accent leaking through."}
      </p>
      <Button variant="outline" size="sm" onClick={onStart}>
        {ok ? "Re-capture reference" : hasPreset ? "Re-capture reference" : "Capture reference"}
      </Button>
    </div>
  );
}

function BeliefCard() {
  return (
    <div className="clinical-card clinical-card-interactive p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="font-data text-[10px] uppercase tracking-[0.2em] text-fg/40">How it works</span>
        <span className="text-fg/30 inline-flex items-center gap-1">
          <AlertCircle className="h-3 w-3" /> <span className="font-data text-[10px] uppercase tracking-[0.18em]">10-sec loop</span>
        </span>
      </div>
      <ol className="space-y-2 text-sm font-data text-fg/60 leading-relaxed">
        <li className="flex gap-3"><span className="text-fg/30 w-5">01</span><span><span className="text-fg">Speak.</span> Read the Mandarin sentence into the mic.</span></li>
        <li className="flex gap-3"><span className="text-fg/30 w-5">02</span><span><span className="text-fg">Diagnose.</span> L1-specific phoneme error card.</span></li>
        <li className="flex gap-3"><span className="text-fg/30 w-5">03</span><span><span className="text-fg">Golden voice.</span> Your own voice — corrected.</span></li>
        <li className="flex gap-3"><span className="text-fg/30 w-5">04</span><span><span className="text-fg">Mirror.</span> Match the target lip shape.</span></li>
      </ol>
    </div>
  );
}
