import { cn } from "@/lib/utils";
import { useSession, type Stage } from "@/store/session";

/**
 * Mirror DevHandover v02 §6.2 step indicator:
 *
 *     01 ──── 02 ──── 03 ──── 04
 *     SPEAK DIAGNOSE  GOLDEN  MIRROR
 *
 * Mono, fg-tertiary for inactive steps, fg-primary for the current
 * one. Persists across stages so the user always sees how far into
 * the 4-step loop they are. The reference sub-flow is treated as a
 * pre-step (step 0) and dims everything.
 */
const STEPS = [
  { key: "speak", num: "01", label: "SPEAK" },
  { key: "diagnose", num: "02", label: "DIAGNOSE" },
  { key: "golden", num: "03", label: "GOLDEN" },
  { key: "mirror", num: "04", label: "MIRROR" },
] as const;

type StepKey = (typeof STEPS)[number]["key"];

function stageToStep(stage: Stage): StepKey | null {
  switch (stage) {
    case "idle":
    case "recording":
      return "speak";
    case "analyzing":
    case "diagnosis":
    case "no_speech":
      return "diagnose";
    case "golden":
      return "golden";
    case "mirror":
      return "mirror";
    case "resolved":
      // After RESOLVED, all four steps are complete — fall back to mirror
      // (the last "achieved" one).
      return "mirror";
    case "error":
    default:
      return null;
  }
}

interface Props {
  /** When true, dim everything (used during reference capture sub-flow). */
  dimmed?: boolean;
}

export function StepIndicator({ dimmed = false }: Props) {
  const stage = useSession((s) => s.stage);
  const current = stageToStep(stage);
  const currentIdx = STEPS.findIndex((s) => s.key === current);

  return (
    <div
      className={cn(
        "flex items-center gap-3 font-mono text-micro tracking-[0.18em]",
        dimmed && "opacity-40"
      )}
      aria-label="Demo progress"
    >
      {STEPS.map((step, i) => {
        const isCurrent = i === currentIdx;
        const isPast = currentIdx > i;
        const isFuture = currentIdx < i;
        return (
          <div key={step.key} className="flex items-center gap-3">
            <div
              className={cn(
                "flex items-center gap-1.5 transition-colors duration-200 ease-out",
                isCurrent && "text-fg",
                isPast && "text-fg/60",
                isFuture && "text-fg/30"
              )}
            >
              <span className="tabular-nums">{step.num}</span>
              <span>{step.label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <span
                aria-hidden
                className={cn(
                  "w-6 h-px transition-colors duration-200 ease-out",
                  isPast ? "bg-fg/40" : "bg-fg/15"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
