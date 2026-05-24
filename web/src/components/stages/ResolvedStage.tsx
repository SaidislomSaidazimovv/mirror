import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { useSession } from "@/store/session";
import { DEMO_SENTENCES, getDemoSentence } from "@/lib/demoData";
import { ease } from "@/motion/presets";
import { cn } from "@/lib/utils";

interface Props {
  onAgain: () => void;
  onNext: () => void;
}

/**
 * Mirror DevHandover v02 §6.8 — calm number-driven close.
 *
 *     10.4s
 *     total time
 *
 *     0
 *     native speakers required
 *
 *     1
 *     voice — yours
 *
 *     [   Try another sentence   ]
 *     [   Start over             ]
 *
 * Numbers count up sequentially (400ms each, 200ms between). Buttons
 * fade in last at 1800ms — subtle, no fills, just primary text on the
 * canvas.
 */

const FIGURES = [
  { value: "10.4", suffix: "s", label: "total time" },
  { value: "0", suffix: "", label: "native speakers required" },
  { value: "1", suffix: "", label: "voice — yours" },
] as const;

export function ResolvedStage({ onAgain, onNext }: Props) {
  const sentenceId = useSession((s) => s.sentenceId);
  const setSentenceId = useSession((s) => s.setSentenceId);
  const sentence = getDemoSentence(sentenceId);
  const attempts = useSession((s) => s.attemptsThisSession);

  // Sequentially reveal each figure — 400ms each, 200ms between (v02 §6.8).
  const [revealed, setRevealed] = useState(0);
  useEffect(() => {
    const timers = FIGURES.map((_, i) =>
      window.setTimeout(() => setRevealed((r) => Math.max(r, i + 1)), 200 + i * 600)
    );
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, []);

  const handleNext = () => {
    const idx = DEMO_SENTENCES.findIndex((s) => s.id === sentenceId);
    const next = DEMO_SENTENCES[(idx + 1) % DEMO_SENTENCES.length];
    setSentenceId(next.id);
    onNext();
  };

  return (
    <div className="container py-20 grid place-items-center text-center">
      <div className="max-w-2xl w-full">
        <div className="font-data text-micro uppercase tracking-[0.22em] text-fg/40 mb-12">
          Loop {attempts.toString().padStart(2, "0")} · resolved
        </div>

        <div className="flex flex-col items-center gap-10">
          {FIGURES.map((fig, i) => (
            <motion.div
              key={fig.label}
              initial={{ opacity: 0, y: 16 }}
              animate={
                revealed > i
                  ? { opacity: 1, y: 0 }
                  : { opacity: 0, y: 16 }
              }
              transition={{ duration: 0.4, ease: ease.out }}
              className="flex flex-col items-center"
            >
              <div className="font-mono text-hero text-fg tabular-nums">
                {fig.value}
                {fig.suffix && (
                  <span className="text-fg/40 ml-1">{fig.suffix}</span>
                )}
              </div>
              <div className="font-data text-micro uppercase tracking-[0.22em] text-fg/40 mt-2">
                {fig.label}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Subtle text buttons — v02 §6.8: "fg-primary text, transparent bg,
            hover fg-secondary". Fade in last at ~1800ms. */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, ease: ease.out, delay: 1.8 }}
          className="mt-16 flex flex-col items-center gap-4"
        >
          <button
            onClick={handleNext}
            className={cn(
              "font-stamp uppercase tracking-tighter text-base text-fg",
              "transition-colors duration-200 ease-out hover:text-fg/60"
            )}
          >
            Try another sentence
          </button>
          <button
            onClick={onAgain}
            className={cn(
              "font-stamp uppercase tracking-tighter text-base text-fg/60",
              "transition-colors duration-200 ease-out hover:text-fg"
            )}
          >
            Start over
          </button>
        </motion.div>

        {sentence && (
          <div className="mt-20 font-data text-micro uppercase tracking-[0.2em] text-fg/30">
            Just completed · {sentence.hanzi} · {sentence.pinyin}
          </div>
        )}
      </div>
    </div>
  );
}
