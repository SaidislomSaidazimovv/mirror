import { useState } from "react";
import { motion, type Variants } from "motion/react";
import { Mic, ArrowLeft, ArrowRight, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Waveform } from "@/components/Waveform";
import { REFERENCE_SCRIPTS } from "@/lib/demoData";
import { useSession } from "@/store/session";
import { formatSeconds } from "@/lib/utils";
import { ease } from "@/motion/presets";
import { cn } from "@/lib/utils";

interface Props {
  recording: boolean;
  liveSamples: number[];
  elapsed: number;
  maxSeconds: number;
  onStart: () => void;
  onStop: () => void;
  onBack: () => void;
}

// v02 §6.1 — entry stagger 100ms between heading / card / button.
const containerVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};
const itemVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: ease.out } },
};

/**
 * Mirror DevHandover v02 §6.1 ONBOARDING_REFERENCE.
 *
 *     One thing first.
 *     Read this in your own language.
 *
 *     [ Русский ] [ O'zbek ]            ← pill toggle, 32px height
 *
 *     ┌──────────────────────────────┐
 *     │  Меня зовут Акмаль...        │   ← passage card, radius-lg
 *     │  text-body-lg (20px / 1.5)    │     shadow-2, 48px padding
 *     └──────────────────────────────┘
 *
 *           [ 🎙 mic 96px ]              ← fg-primary, hover scale 1.02
 *
 *           Hold space to record
 */
export function ReferenceStage({
  recording,
  liveSamples,
  elapsed,
  maxSeconds,
  onStart,
  onStop,
  onBack,
}: Props) {
  const l1 = useSession((s) => s.l1);
  const script = REFERENCE_SCRIPTS[l1];
  const clone = useSession((s) => s.clone);
  // Show a thin top progress bar while cloning is in flight per v02 §6.1.
  const cloning = !recording && !!clone && clone.source === "live" && false;
  // We can't reliably know cloning state from here without a store flag,
  // but expose the bar UI scaffold for when one is added.
  const [showCloningBar] = useState(cloning);

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className="container py-14"
    >
      {/* v02 §6.1 thin progress bar at top of screen while IVC is running. */}
      {showCloningBar && (
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 4, ease: ease.out }}
          className="fixed top-0 left-0 right-0 h-0.5 bg-fg origin-left"
        />
      )}

      <div className="max-w-3xl mx-auto">
        <motion.div
          variants={itemVariants}
          className="flex items-center justify-between mb-10"
        >
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <Badge variant={recording ? "live" : "default"}>
            STEP 0 · REFERENCE CAPTURE · {l1.toUpperCase()}
          </Badge>
          <div className="font-data text-micro uppercase tracking-[0.22em] text-fg/40">
            ≤ {maxSeconds}s
          </div>
        </motion.div>

        {/* v02 §6.1 heading. */}
        <motion.div variants={itemVariants} className="text-center mb-10">
          <div className="font-stamp text-title leading-tight tracking-tighter mb-3">
            One thing first.
          </div>
          <div className="font-stamp text-2xl text-fg/60 tracking-tight">
            Read this in your own language.
          </div>
          <div className="font-data text-micro text-fg/40 uppercase tracking-[0.22em] mt-3">
            We extract your timbre — never your Mandarin attempt.
          </div>
        </motion.div>

        {/* v02 §6.1 passage card — bg-surface, radius-lg, shadow-2, padding 48px. */}
        <motion.div
          variants={itemVariants}
          className={cn(
            "bg-white rounded-lg shadow-2 mb-8",
            "p-8 md:p-12"
          )}
        >
          <div className="font-data text-micro uppercase tracking-[0.22em] text-fg/40 mb-4">
            Reference script · {l1}
          </div>
          {/* v02 §5.3 text-body-lg (20px / 1.5) — PP Neue Montreal /
              Switzer for the passage body. */}
          <p className="text-fg text-body-lg leading-relaxed">{script}</p>
        </motion.div>

        {recording && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: ease.out }}
            className="clinical-card p-6 mb-8"
          >
            <div className="flex items-center justify-between mb-3 font-data text-micro uppercase tracking-[0.22em] text-fg/40">
              <span>Live · 16 kHz mono</span>
              <span className="text-signal">REC · {formatSeconds(elapsed)}</span>
            </div>
            <Waveform
              samples={liveSamples}
              tone="signal"
              height={80}
              barWidth={4}
              gap={4}
              bars={30}
            />
          </motion.div>
        )}

        {/* v02 §6.1 — mic button: 96px, bg fg-primary, hover scale 1.02 + shadow-3. */}
        <motion.div
          variants={itemVariants}
          className="flex flex-col items-center justify-center gap-4"
        >
          {!recording ? (
            <motion.button
              onClick={onStart}
              className="relative grid place-items-center w-24 h-24 rounded-full bg-fg text-bg shadow-2 transition-shadow duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-4 focus-visible:ring-offset-bg"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 50% 35%, rgba(255,255,255,0.08) 0%, transparent 60%)",
              }}
              whileHover={{
                scale: 1.02,
                boxShadow:
                  "0 16px 40px rgba(10, 10, 10, 0.08), 0 4px 12px rgba(10, 10, 10, 0.04)",
                transition: { duration: 0.2, ease: ease.out },
              }}
              whileTap={{
                scale: 0.96,
                transition: { duration: 0.1, ease: ease.out },
              }}
              aria-label="Start reference capture"
            >
              <Mic className="h-7 w-7" strokeWidth={1.5} />
            </motion.button>
          ) : (
            <Button variant="signal" size="xl" onClick={onStop}>
              <Square className="h-5 w-5" fill="currentColor" /> Stop & clone voice <ArrowRight className="h-4 w-4" />
            </Button>
          )}
          {!recording && (
            <div className="font-data text-micro uppercase tracking-[0.22em] text-fg/40">
              Hold to record — auto-stops at {maxSeconds}s
            </div>
          )}
        </motion.div>
      </div>
    </motion.div>
  );
}
