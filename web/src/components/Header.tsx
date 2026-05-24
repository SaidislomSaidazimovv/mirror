import { Badge } from "@/components/ui/badge";
import { StepIndicator } from "@/components/StepIndicator";
import { useSession, type Stage } from "@/store/session";

const STAGE_LABEL: Record<Stage, string> = {
  idle: "READY",
  recording: "RECORDING",
  analyzing: "ANALYZING",
  diagnosis: "DIAGNOSIS",
  no_speech: "NO SIGNAL",
  golden: "GOLDEN VOICE",
  mirror: "MIRROR",
  resolved: "RESOLVED",
  error: "FAULT",
};

export function Header() {
  const stage = useSession((s) => s.stage);
  const attempts = useSession((s) => s.attemptsThisSession);

  return (
    <header className="border-b border-line">
      <div className="container flex items-center justify-between h-14 gap-6">
        <div className="flex items-center gap-4 shrink-0">
          <Wordmark />
          <span className="font-data text-[10px] text-fg/40 tracking-[0.22em] uppercase hidden md:inline">
            v01 · Tashkent → World
          </span>
        </div>
        {/* v02 §6.2 step indicator — persists across stages so the
            viewer always knows where they are in the 4-step loop. */}
        <div className="hidden md:flex">
          <StepIndicator />
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Badge
            variant={
              stage === "recording"
                ? "live"
                : stage === "diagnosis"
                ? "signal"
                : stage === "golden"
                ? "gold"
                : "default"
            }
          >
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-current" />
            {STAGE_LABEL[stage]}
          </Badge>
          <span className="font-data text-[10px] text-fg/40 tracking-[0.18em] uppercase">
            Loops · {attempts.toString().padStart(2, "0")}
          </span>
        </div>
      </div>
    </header>
  );
}

function Wordmark() {
  // The Mirror AI brand logotype lives in /public as an SVG. We embed
  // it via <img> so colours / gradients render exactly as designed.
  return (
    <a href="/" className="flex items-center" aria-label="Mirror — home">
      <img
        src="/mirror-logo.svg"
        alt="Mirror"
        className="h-7 w-auto select-none"
        draggable={false}
      />
    </a>
  );
}
