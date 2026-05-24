import { cn } from "@/lib/utils";
import { useSession, type TutorLanguage } from "@/store/session";
import { Sparkles, Loader2 } from "lucide-react";

/**
 * AI Tutor panel — Gemini 2.0 Flash native-language explanation under the
 * clinical DiagnosisCard.
 *
 * The DiagnosisCard stays deterministic (hardcoded headline + citation)
 * so the demo screenshot moment is preserved. This panel is the second
 * voice: a 2-3 sentence native-language explanation generated per
 * attempt + one short articulatory tip. Lets the user toggle Uzbek /
 * Russian / English.
 *
 * Hackathon "Build with AI" stack slide marks Gemini 2.0 Flash as
 * Majburiy — this is where it earns its keep.
 */
interface Props {
  onLanguageChange?: (lang: TutorLanguage) => void;
}

const LANGUAGE_OPTIONS: { code: TutorLanguage; label: string; native: string }[] = [
  { code: "uz", label: "UZ", native: "O'zbek" },
  { code: "ru", label: "RU", native: "Русский" },
  { code: "en", label: "EN", native: "English" },
];

export function AITutorPanel({ onLanguageChange }: Props) {
  const tutor = useSession((s) => s.tutor);
  const loading = useSession((s) => s.tutorLoading);
  const language = useSession((s) => s.tutorLanguage);
  const setTutorLanguage = useSession((s) => s.setTutorLanguage);

  const handleSwitch = (code: TutorLanguage) => {
    if (code === language) return;
    setTutorLanguage(code);
    onLanguageChange?.(code);
  };

  return (
    <div className="w-full max-w-2xl mx-auto mt-10">
      <div className="hairline-gold mb-5" />

      <div className="clinical-card p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-gold" strokeWidth={1.5} />
            <span className="font-data text-[10px] uppercase tracking-[0.22em] text-fg/40">
              AI Tutor · Gemini 2.0 Flash
            </span>
          </div>

          <div className="flex items-center gap-1" role="tablist" aria-label="Tutor language">
            {LANGUAGE_OPTIONS.map((opt) => (
              <button
                key={opt.code}
                role="tab"
                aria-selected={language === opt.code}
                onClick={() => handleSwitch(opt.code)}
                className={cn(
                  "font-data text-[10px] uppercase tracking-[0.2em] h-7 px-2.5 border transition-colors duration-150 ease-out",
                  language === opt.code
                    ? "border-gold text-gold"
                    : "border-line text-fg/40 hover:text-fg/70 hover:border-fg/30"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-3 text-fg/40 font-data text-sm py-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.5} />
            <span className="uppercase tracking-[0.18em] text-[11px]">Generating…</span>
          </div>
        ) : tutor ? (
          <>
            <p className="font-sans text-base text-fg/85 leading-relaxed mb-5">
              {tutor.explanation}
            </p>

            <div className="border-l-2 border-gold/60 pl-4 py-1">
              <div className="font-data text-[10px] uppercase tracking-[0.22em] text-gold/80 mb-1">
                Try this
              </div>
              <p className="font-sans text-sm text-fg/70 leading-relaxed">{tutor.tip}</p>
            </div>

            <div className="mt-5 flex items-center justify-between font-data text-[10px] uppercase tracking-[0.2em] text-fg/30">
              <span>
                {tutor.source === "gemini" ? "Gemini · Live" : "Offline fallback"}
              </span>
              <span>Lang · {tutor.language.toUpperCase()}</span>
            </div>
          </>
        ) : (
          <div className="font-data text-sm text-fg/40 py-2">
            No explanation available yet.
          </div>
        )}
      </div>
    </div>
  );
}
