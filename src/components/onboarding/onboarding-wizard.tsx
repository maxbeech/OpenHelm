import { useState } from "react";
import { WelcomeStep } from "./steps/welcome-step";
import { ClaudeCodeStep } from "./steps/claude-code-step";
import { ProjectStep } from "./steps/project-step";
import { CompleteStep } from "./steps/complete-step";
import { Progress } from "@/components/ui/progress";

const STEPS = [
  { id: "welcome", label: "Welcome" },
  { id: "claude-code", label: "Claude Code" },
  { id: "project", label: "Project" },
  { id: "complete", label: "Complete" },
] as const;

interface OnboardingWizardProps {
  onComplete: (projectId: string) => void;
}

export function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const [step, setStep] = useState(0);
  const [projectId, setProjectId] = useState<string | null>(null);

  const progress = ((step + 1) / STEPS.length) * 100;

  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));

  return (
    <div className="no-select flex min-h-screen flex-col items-center justify-center bg-background p-8">
      {/* Progress */}
      {step > 0 && step < STEPS.length - 1 && (
        <div className="fixed top-0 right-0 left-0 p-4">
          <div className="mx-auto max-w-md">
            <div className="mb-1 flex justify-between text-xs text-muted-foreground">
              <span>{STEPS[step].label}</span>
              <span>
                {step + 1} of {STEPS.length}
              </span>
            </div>
            <Progress value={progress} className="h-1" />
          </div>
        </div>
      )}

      {/* Steps */}
      <div className="w-full max-w-md">
        {step === 0 && <WelcomeStep onNext={next} />}
        {step === 1 && <ClaudeCodeStep onNext={next} />}
        {step === 2 && (
          <ProjectStep
            onNext={(id) => {
              setProjectId(id);
              next();
            }}
          />
        )}
        {step === 3 && (
          <CompleteStep onComplete={() => onComplete(projectId!)} />
        )}
      </div>
    </div>
  );
}
