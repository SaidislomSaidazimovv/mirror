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
 * Variants:
 *   - fade  : opacity 0→1, default
 *   - slide : opacity + tiny upward translate, good for IDLE/RESOLVED
 *   - slam  : matches DiagnosisCard — sharp scale + opacity
 *   - scan  : a hairline sweeps in from the left as the content fades in
 */
export function StageView({ stageKey, variant = "fade", children }: Props) {
  return (
    <section
      key={stageKey}
      className={cn(
        "relative",
        variant === "fade" && "animate-in fade-in duration-500",
        variant === "slide" && "animate-in fade-in slide-in-from-bottom-2 duration-500",
        variant === "slam" && "animate-slam-in",
        variant === "scan" && "animate-in fade-in duration-700"
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
