import { useState, useMemo, useCallback } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useJobStore } from "@/stores/job-store";
import { useGoalStore } from "@/stores/goal-store";
import * as api from "@/lib/api";
import {
  JobCreationForm,
  type JobFormState,
  type JobFormErrors,
} from "./job-creation-form";
import type { ScheduleConfig, ClarifyingQuestion } from "@openorchestra/shared";
import { JobSheetFooter } from "./job-sheet-footer";

interface JobCreationSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectDirectory: string;
  onComplete: () => void;
}

const INITIAL_FORM: JobFormState = {
  name: "",
  prompt: "",
  goalId: "none",
  scheduleType: "once",
  intervalMinutes: 60,
  cronExpression: "0 9 * * 1",
  workingDirectory: "",
};

export function JobCreationSheet({
  open,
  onOpenChange,
  projectId,
  projectDirectory,
  onComplete,
}: JobCreationSheetProps) {
  const { createJob } = useJobStore();
  const { goals } = useGoalStore();

  const [form, setForm] = useState<JobFormState>(INITIAL_FORM);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [assessing, setAssessing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clarifyQuestions, setClarifyQuestions] = useState<
    ClarifyingQuestion[] | null
  >(null);
  const [clarifyAnswers, setClarifyAnswers] = useState<
    Record<string, string>
  >({});

  const activeGoals = useMemo(
    () => goals.filter((g) => g.status === "active"),
    [goals],
  );

  const errors: JobFormErrors = {
    name: touched.name && !form.name.trim() ? "Name is required" : null,
    prompt:
      touched.prompt && !form.prompt.trim() ? "Prompt is required" : null,
    interval:
      form.scheduleType === "interval" && form.intervalMinutes < 1
        ? "Interval must be at least 1 minute"
        : null,
  };
  const isValid = form.name.trim() && form.prompt.trim() && !errors.interval;

  const handleReset = useCallback(() => {
    setForm(INITIAL_FORM);
    setTouched({});
    setAssessing(false);
    setCreating(false);
    setError(null);
    setClarifyQuestions(null);
    setClarifyAnswers({});
  }, []);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) handleReset();
    onOpenChange(nextOpen);
  };

  const onFieldChange = (field: keyof JobFormState, value: string | number) =>
    setForm((f) => ({ ...f, [field]: value }));

  const getScheduleConfig = (): ScheduleConfig => {
    if (form.scheduleType === "interval") return { minutes: form.intervalMinutes };
    if (form.scheduleType === "cron") return { expression: form.cronExpression };
    return { fireAt: new Date().toISOString() };
  };

  const doCreate = async () => {
    setCreating(true);
    setError(null);
    try {
      let finalPrompt = form.prompt.trim();
      const answered = Object.entries(clarifyAnswers).filter(
        ([, v]) => v.trim(),
      );
      if (answered.length > 0) {
        const context = answered.map(([q, a]) => `${q}: ${a}`).join("\n");
        finalPrompt += `\n\nAdditional context:\n${context}`;
      }
      await createJob({
        projectId,
        goalId: form.goalId !== "none" ? form.goalId : undefined,
        name: form.name.trim(),
        prompt: finalPrompt,
        scheduleType: form.scheduleType,
        scheduleConfig: getScheduleConfig(),
        workingDirectory: form.workingDirectory.trim() || undefined,
      });
      handleOpenChange(false);
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create job");
    } finally {
      setCreating(false);
    }
  };

  const handleSubmit = async () => {
    setTouched({ name: true, prompt: true });
    if (!isValid) return;
    if (clarifyQuestions !== null) {
      await doCreate();
      return;
    }
    setAssessing(true);
    setError(null);
    try {
      const result = await api.assessPrompt({
        projectId,
        prompt: form.prompt.trim(),
      });
      if (result.needsClarification && result.questions.length > 0) {
        setClarifyQuestions(result.questions);
        setAssessing(false);
        return;
      }
      setClarifyQuestions([]);
      setAssessing(false);
      await doCreate();
    } catch {
      setClarifyQuestions([]);
      setAssessing(false);
      await doCreate();
    }
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-lg">
        <SheetHeader className="border-b border-border pb-4">
          <SheetTitle>Create a Job</SheetTitle>
          <p className="text-sm text-muted-foreground">
            Define a task for Claude Code to run.
          </p>
        </SheetHeader>

        <JobCreationForm
          form={form}
          errors={errors}
          goals={activeGoals}
          projectDirectory={projectDirectory}
          clarifyQuestions={clarifyQuestions}
          clarifyAnswers={clarifyAnswers}
          onFieldChange={onFieldChange}
          onFieldBlur={(f) => setTouched((t) => ({ ...t, [f]: true }))}
          onClarifyAnswersChange={setClarifyAnswers}
          onClarifyReset={() => {
            setClarifyQuestions(null);
            setClarifyAnswers({});
          }}
          error={error}
        />

        <JobSheetFooter
          hasClarification={!!clarifyQuestions?.length}
          assessing={assessing}
          creating={creating}
          isValid={!!isValid}
          onSubmit={handleSubmit}
          onCreateAnyway={doCreate}
        />
      </SheetContent>
    </Sheet>
  );
}
