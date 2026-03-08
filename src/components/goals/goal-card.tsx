import type { Goal, Job, Run } from "@openorchestra/shared";
import { GoalStatusBadge, RunStatusBadge } from "@/components/shared/status-badge";
import { Briefcase, Clock } from "lucide-react";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

interface GoalCardProps {
  goal: Goal;
  jobs: Job[];
  runs: Run[];
  onClick: () => void;
}

export function GoalCard({ goal, jobs, runs, onClick }: GoalCardProps) {
  const jobIds = new Set(jobs.map((j) => j.id));
  const goalRuns = runs.filter((r) => jobIds.has(r.jobId));
  const latestRun = goalRuns[0];
  const hasRunning = goalRuns.some((r) => r.status === "running");

  const nextFireAt = jobs
    .filter((j) => j.isEnabled && j.nextFireAt)
    .map((j) => j.nextFireAt!)
    .sort()[0];

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full rounded-lg border border-border bg-card p-4 text-left transition-colors hover:border-primary/30",
        hasRunning && "animate-pulse-border border-primary/50",
      )}
    >
      <p className="line-clamp-2 font-medium">{goal.description}</p>

      <div className="mt-3 flex items-center gap-2">
        <GoalStatusBadge status={goal.status} />
      </div>

      <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Briefcase className="size-3" />
          {jobs.length} {jobs.length === 1 ? "job" : "jobs"}
        </span>

        {latestRun && (
          <span className="flex items-center gap-1">
            <RunStatusBadge status={latestRun.status} />
            <span>{formatRelativeTime(latestRun.createdAt)}</span>
          </span>
        )}

        {nextFireAt && (
          <span className="flex items-center gap-1">
            <Clock className="size-3" />
            {formatRelativeTime(nextFireAt)}
          </span>
        )}
      </div>
    </button>
  );
}
