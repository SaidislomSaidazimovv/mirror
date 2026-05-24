import { ChevronLeft, ChevronRight } from "lucide-react";
import { DEMO_SENTENCES } from "@/lib/demoData";
import { useSession } from "@/store/session";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Sentence the user is about to read. Three demo sentences are hardcoded
 * per the dev handover §6 — caller picks which by ID. The picker doubles
 * as the visual centerpiece of the IDLE state.
 */
export function SentencePrompt({ allowSwitch = true }: { allowSwitch?: boolean }) {
  const sentenceId = useSession((s) => s.sentenceId);
  const setSentenceId = useSession((s) => s.setSentenceId);
  const sentence = DEMO_SENTENCES.find((s) => s.id === sentenceId) ?? DEMO_SENTENCES[0];

  const idx = DEMO_SENTENCES.findIndex((s) => s.id === sentence.id);
  const prev = () => setSentenceId(DEMO_SENTENCES[(idx - 1 + DEMO_SENTENCES.length) % DEMO_SENTENCES.length].id);
  const next = () => setSentenceId(DEMO_SENTENCES[(idx + 1) % DEMO_SENTENCES.length].id);

  return (
    <div className="text-center">
      <div className="flex items-center justify-center gap-2 mb-6">
        <Badge variant="default">Target sentence · {(idx + 1).toString().padStart(2, "0")} / 0{DEMO_SENTENCES.length}</Badge>
      </div>

      <div className="flex items-center justify-center gap-6">
        {allowSwitch && (
          <button
            onClick={prev}
            className="text-fg/30 hover:text-fg/80 transition-colors p-1"
            aria-label="Previous sentence"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        )}

        <div>
          {/* Mandarin sentence. v02 §6.2 nominally targets text-mega
              (128px) on desktop, but inside the SentencePrompt's
              max-w-3xl container with the prev/next chevrons flanking,
              128px causes the 6-character row to wrap to two lines.
              Capping at text-7xl (72px) keeps the sentence on a
              single line at every breakpoint while still feeling
              hero-scale. `whitespace-nowrap` is the belt-and-braces. */}
          <div
            className={cn(
              "font-cjk tracking-tighter whitespace-nowrap",
              allowSwitch
                ? "text-5xl md:text-6xl lg:text-7xl"
                : "text-4xl md:text-5xl"
            )}
          >
            {sentence.hanzi}
          </div>
          {/* v02 §5.3 text-body-lg (20px) — the pinyin subtitle. */}
          <div className="font-data text-fg/60 mt-5 text-body-lg tracking-wide">
            {sentence.pinyin}
          </div>
          <div className="font-data text-fg/30 text-micro mt-2 uppercase tracking-[0.2em]">
            {sentence.translation}
          </div>
        </div>

        {allowSwitch && (
          <button
            onClick={next}
            className="text-fg/30 hover:text-fg/80 transition-colors p-1"
            aria-label="Next sentence"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        )}
      </div>
    </div>
  );
}
