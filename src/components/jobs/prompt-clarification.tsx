import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { ClarifyingQuestion } from "@openorchestra/shared";

interface PromptClarificationProps {
  questions: ClarifyingQuestion[];
  answers: Record<string, string>;
  onAnswersChange: (answers: Record<string, string>) => void;
}

export function PromptClarification({
  questions,
  answers,
  onAnswersChange,
}: PromptClarificationProps) {
  const selectAnswer = (question: string, answer: string) => {
    if (answer === "__custom__") {
      onAnswersChange({ ...answers, [question]: "" });
    } else {
      onAnswersChange({ ...answers, [question]: answer });
    }
  };

  const isCustom = (question: string) => {
    const answer = answers[question];
    if (!answer) return false;
    const q = questions.find((qq) => qq.question === question);
    return q ? !q.options.includes(answer) : false;
  };

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-3">
      <p className="text-xs font-medium text-primary">
        A few suggestions to improve this prompt:
      </p>
      {questions.map((q) => (
        <div key={q.question} className="space-y-1.5">
          <p className="text-sm">{q.question}</p>
          <div className="flex flex-wrap gap-1.5">
            {q.options.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => selectAnswer(q.question, opt)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs transition-colors",
                  answers[q.question] === opt && !isCustom(q.question)
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:border-primary/50",
                )}
              >
                {opt}
              </button>
            ))}
            <button
              type="button"
              onClick={() => selectAnswer(q.question, "__custom__")}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs transition-colors",
                isCustom(q.question)
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/50",
              )}
            >
              Other
            </button>
          </div>
          {isCustom(q.question) && (
            <Input
              value={answers[q.question] ?? ""}
              onChange={(e) =>
                onAnswersChange({ ...answers, [q.question]: e.target.value })
              }
              placeholder="Type your answer..."
              className="h-8 text-sm"
              autoFocus
            />
          )}
        </div>
      ))}
    </div>
  );
}
