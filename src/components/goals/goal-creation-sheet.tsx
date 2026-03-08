import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Progress } from "@/components/ui/progress";
import { GoalInputStep } from "./sheet-steps/goal-input-step";
import { ClarificationStep } from "./sheet-steps/clarification-step";
import { PlanReviewStep } from "./sheet-steps/plan-review-step";
import { ConfirmationStep } from "./sheet-steps/confirmation-step";
import type {
  AssessmentResult,
  GeneratedPlan,
  PlannedJob,
} from "@openorchestra/shared";

const STEP_LABELS = ["Goal", "Clarify", "Review Plan", "Done"];

interface GoalCreationSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialGoalText: string;
  projectId: string;
  onComplete: () => void;
}

export function GoalCreationSheet({
  open,
  onOpenChange,
  initialGoalText,
  projectId,
  onComplete,
}: GoalCreationSheetProps) {
  const [step, setStep] = useState(0);
  const [goalText, setGoalText] = useState(initialGoalText);
  const [assessment, setAssessment] = useState<AssessmentResult | null>(null);
  const [clarificationAnswers, setClarificationAnswers] = useState<
    Record<string, string>
  >({});
  const [plan, setPlan] = useState<GeneratedPlan | null>(null);
  const [commitResult, setCommitResult] = useState<{
    goalId: string;
    jobIds: string[];
  } | null>(null);

  const progress = ((step + 1) / STEP_LABELS.length) * 100;

  const handleReset = () => {
    setStep(0);
    setGoalText(initialGoalText);
    setAssessment(null);
    setClarificationAnswers({});
    setPlan(null);
    setCommitResult(null);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) handleReset();
    onOpenChange(nextOpen);
  };

  const handleAssessmentComplete = (result: AssessmentResult) => {
    setAssessment(result);
    if (result.needsClarification) {
      setStep(1);
    } else {
      // Skip clarification, go straight to plan generation
      setStep(2);
    }
  };

  const handlePlanGenerated = (generatedPlan: GeneratedPlan) => {
    setPlan(generatedPlan);
    setStep(2);
  };

  const handlePlanCommitted = (result: {
    goalId: string;
    jobIds: string[];
  }) => {
    setCommitResult(result);
    setStep(3);
  };

  const handleJobUpdate = (index: number, updatedJob: PlannedJob) => {
    if (!plan) return;
    const newJobs = [...plan.jobs];
    newJobs[index] = updatedJob;
    setPlan({ jobs: newJobs });
  };

  const handleJobDelete = (index: number) => {
    if (!plan) return;
    setPlan({ jobs: plan.jobs.filter((_, i) => i !== index) });
  };

  const handleJobAdd = (job: PlannedJob) => {
    if (!plan) return;
    setPlan({ jobs: [...plan.jobs, job] });
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col sm:max-w-lg"
        showCloseButton={step < 3}
      >
        <SheetHeader className="border-b border-border pb-4">
          <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>{STEP_LABELS[step]}</span>
            <span>
              {step + 1} / {STEP_LABELS.length}
            </span>
          </div>
          <Progress value={progress} className="h-1" />
          <SheetTitle className="mt-2">Create a Goal</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-auto p-4">
          {step === 0 && (
            <GoalInputStep
              goalText={goalText}
              onGoalTextChange={setGoalText}
              projectId={projectId}
              onAssessmentComplete={handleAssessmentComplete}
            />
          )}
          {step === 1 && assessment && (
            <ClarificationStep
              questions={assessment.questions}
              answers={clarificationAnswers}
              onAnswersChange={setClarificationAnswers}
              projectId={projectId}
              goalText={goalText}
              onPlanGenerated={handlePlanGenerated}
            />
          )}
          {step === 2 && plan && (
            <PlanReviewStep
              plan={plan}
              projectId={projectId}
              goalText={goalText}
              onJobUpdate={handleJobUpdate}
              onJobDelete={handleJobDelete}
              onJobAdd={handleJobAdd}
              onCommit={handlePlanCommitted}
            />
          )}
          {step === 3 && commitResult && (
            <ConfirmationStep
              jobCount={commitResult.jobIds.length}
              onClose={() => {
                handleOpenChange(false);
                onComplete();
              }}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
