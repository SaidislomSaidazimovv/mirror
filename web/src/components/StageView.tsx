import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface Props {
  /** Identity for keyed remount — pass the stage name. */
  stageKey: string;
  /** Override entrance animation per stage. */
  variant?: "fade" | "slide" | "slam" | "scan";
  children: ReactNode;
}

/**
 * Wraps every stage with a unified mount animation. We deliberately
 * remount the children when `stageKey` changes (via the parent's
 * React.key) so each stage gets its own clean entrance instead of
 * sharing a stale animation timeline.
 *
 * Durations are tightened to Mirror DevHandover v02 §7.1 macro-flow
 * cross-fade timings:
 *   - fade  (400 ms) : default state transition — matches §7.1
 *                      "cross-fade to ANALYZING / GOLDEN_VOICE" cues.
 *   - slide (500 ms) : IDLE / RESOLVED entrances — spec range 400–600 ms.
 *   - slam  (—)      : DiagnosisCard's spring entrance is owned inside
 *                      the card itself (Motion spring 800 ms with the
 *                      v02 §6.5 stiffness/damping/mass triple). The
 *                      wrapper just remounts; no extra CSS animation.
 *   - scan  (600 ms) : RECORDING — hairline sweep + content fade.
 */
export function StageView({ stageKey, variant = "fade", children }: Props) {
  return (
    <section
      key={stageKey}
      className={cn(
        "relative",
        variant === "fade" && "animate-in fade-in duration-400",
        variant === "slide" && "animate-in fade-in slide-in-from-bottom-2 duration-500",
        // slam: no wrapper animation — DiagnosisCard's own Motion spring
        // is the only entrance. Wrapping would double-animate the card.
        variant === "scan" && "animate-in fade-in duration-600"
      )}
    >
      {variant === "scan" && (
        <span
          aria-hidden
          className="absolute top-0 left-0 right-0 h-px bg-signal/70 origin-left animate-hairline"
        />
      )}
      {children}
    </section>
  );
}
