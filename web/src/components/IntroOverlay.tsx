import { useEffect, useState } from "react";

/**
 * Single-shot intro that plays the first time the app mounts.
 *
 * 0.00 s : black field
 * 0.10 s : hairline sweeps across center
 * 0.40 s : OVOZ wordmark crashes in (display-stamp)
 * 0.85 s : tagline reveals beneath
 * 1.50 s : whole overlay fades away, app appears
 *
 * Locked into a useState lifecycle so it only fires once. After dismiss
 * the component returns null and stops painting.
 */
export function IntroOverlay() {
  const [phase, setPhase] = useState<"hair" | "stamp" | "tag" | "out" | "done">("hair");

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("stamp"), 120);
    const t2 = setTimeout(() => setPhase("tag"), 450);
    const t3 = setTimeout(() => setPhase("out"), 1400);
    const t4 = setTimeout(() => setPhase("done"), 1850);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, []);

  if (phase === "done") return null;

  return (
    <div
      className={`fixed inset-0 z-50 bg-bg grid place-items-center transition-opacity duration-500 ${
        phase === "out" ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
      aria-hidden
    >
      {/* Hairline sweep across the center */}
      <div className="absolute top-1/2 inset-x-0 h-px overflow-hidden">
        <div className="h-full bg-signal animate-hairline" style={{ animationDuration: "320ms" }} />
      </div>

      <div className="flex flex-col items-center gap-4">
        <div
          className={`font-stamp text-7xl md:text-8xl tracking-tightest transition-all duration-500 ${
            phase === "hair"
              ? "opacity-0 scale-110"
              : "opacity-100 scale-100"
          }`}
          style={{ transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" }}
        >
          OVOZ
        </div>

        <div
          className={`font-data text-[11px] uppercase tracking-[0.32em] text-fg/40 transition-opacity duration-500 ${
            phase === "tag" || phase === "out" ? "opacity-100" : "opacity-0"
          }`}
        >
          Tashkent → World · v01
        </div>
      </div>

      {/* Corner registration marks */}
      <CornerMark className="top-6 left-6" />
      <CornerMark className="top-6 right-6" mirrored />
      <CornerMark className="bottom-6 left-6" inverted />
      <CornerMark className="bottom-6 right-6" mirrored inverted />
    </div>
  );
}

function CornerMark({
  className = "",
  mirrored = false,
  inverted = false,
}: {
  className?: string;
  mirrored?: boolean;
  inverted?: boolean;
}) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      className={`absolute text-fg/40 ${className} ${mirrored ? "scale-x-[-1]" : ""} ${
        inverted ? "scale-y-[-1]" : ""
      }`}
      aria-hidden
    >
      <path d="M0 0 L0 8 M0 0 L8 0" stroke="currentColor" strokeWidth="1.4" fill="none" />
    </svg>
  );
}
