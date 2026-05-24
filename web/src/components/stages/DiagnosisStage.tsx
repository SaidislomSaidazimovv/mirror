import { Button } from "@/components/ui/button";
import { DiagnosisCard } from "@/components/DiagnosisCard";
import { AITutorPanel } from "@/components/AITutorPanel";
import { ArrowRight } from "lucide-react";
import { useSession, type TutorLanguage } from "@/store/session";
import { getDemoSentence } from "@/lib/demoData";

interface Props {
  /**
   * Called when the user re-requests the Gemini explanation in a new
   * language — App.tsx owns the actual fetch since it has all the
   * diagnosis context.
   */
  onTutorLanguageChange?: (lang: TutorLanguage) => void;
  onContinue: () => void;
}

/**
 * The diagnosis card stays the headline moment; the AI Tutor panel
 * beneath it carries the Gemini-powered native-language explanation.
 *
 * No auto-advance — the tutor panel is the point. The user reads it,
 * then clicks the gold button to proceed to Golden Voice.
 */
export function DiagnosisStage({ onTutorLanguageChange, onContinue }: Props) {
  const l1 = useSession((s) => s.l1);
  const sentenceId = useSession((s) => s.sentenceId);
  const sentence = getDemoSentence(sentenceId);

  if (!sentence) return null;
  const diagnosis = sentence.diagnoses[l1];

  return (
    <div className="container py-14 grid place-items-center">
      <DiagnosisCard diagnosis={diagnosis} hero />

      <AITutorPanel onLanguageChange={onTutorLanguageChange} />

      <div className="mt-12 flex justify-center">
        <Button variant="gold" size="lg" onClick={onContinue}>
          Hear yourself correct it <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
