import { useState, useMemo } from "react";
import { Plus } from "lucide-react";
import { useAppStore } from "@/stores/app-store";
import { useGoalStore } from "@/stores/goal-store";
import { useJobStore } from "@/stores/job-store";
import { useRunStore } from "@/stores/run-store";
import { SidebarJobNode } from "./sidebar-job-node";
import { SidebarGoalNode } from "./sidebar-goal-node";
import { SortDropdown, applySortGoals, applySortJobs } from "./sidebar-sort";
import { SidebarArchived } from "./sidebar-archived";

interface SidebarTreeProps {
  projectId: string | null;
  onNewJobForGoal: (goalId: string, initialName: string) => void;
}

export function SidebarTree({ projectId, onNewJobForGoal }: SidebarTreeProps) {
  const {
    contentView,
    selectedGoalId,
    selectedJobId,
    collapsedGoalIds,
    selectGoal,
    selectJob,
    toggleGoalCollapsed,
    goalSortMode,
    jobSortMode,
    setGoalSortMode,
    setJobSortMode,
  } = useAppStore();
  const { goals, createGoal } = useGoalStore();
  const { jobs } = useJobStore();
  const { runs } = useRunStore();

  const [addingGoal, setAddingGoal] = useState(false);
  const [newGoalInput, setNewGoalInput] = useState("");

  const activeGoals = useMemo(
    () => applySortGoals(goals.filter((g) => g.status !== "archived"), goalSortMode),
    [goals, goalSortMode],
  );

  const jobsByGoal = useMemo(() => {
    const map = new Map<string | null, typeof jobs>();
    for (const job of jobs) {
      if (job.isArchived) continue;
      const key = job.goalId;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(job);
    }
    for (const [key, groupJobs] of map) {
      map.set(key, applySortJobs(groupJobs, jobSortMode));
    }
    return map;
  }, [jobs, jobSortMode]);

  const standaloneJobs = useMemo(
    () => jobsByGoal.get(null) ?? [],
    [jobsByGoal],
  );

  const archivedGoals = useMemo(
    () => goals.filter((g) => g.status === "archived"),
    [goals],
  );

  const archivedStandaloneJobs = useMemo(
    () => jobs.filter((j) => j.isArchived && !j.goalId),
    [jobs],
  );

  const archivedJobsByGoal = useMemo(() => {
    const map = new Map<string, typeof jobs>();
    for (const job of jobs) {
      if (!job.isArchived || !job.goalId) continue;
      if (!map.has(job.goalId)) map.set(job.goalId, []);
      map.get(job.goalId)!.push(job);
    }
    return map;
  }, [jobs]);

  const hasArchived = archivedGoals.length > 0 || archivedStandaloneJobs.length > 0;
  const archivedCount = archivedGoals.length + archivedStandaloneJobs.length;

  const recentRunsByJob = useMemo(() => {
    const map = new Map<string, typeof runs>();
    for (const run of runs) {
      let arr = map.get(run.jobId);
      if (!arr) {
        arr = [];
        map.set(run.jobId, arr);
      }
      if (arr.length < 5) arr.push(run);
    }
    return map;
  }, [runs]);

  const handleCreateGoal = async () => {
    const name = newGoalInput.trim();
    setNewGoalInput("");
    setAddingGoal(false);
    if (!name || !projectId) return;
    try {
      const goal = await createGoal({ projectId, name });
      selectGoal(goal.id);
    } catch {
      // goal-store sets error state
    }
  };

  return (
    <div className="flex-1 overflow-auto">
      {/* GOALS section header */}
      <div className="sticky top-0 z-20 flex h-[30px] items-center gap-1 bg-sidebar px-3">
        <span className="flex-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Goals
        </span>
        <SortDropdown value={goalSortMode} onChange={setGoalSortMode} label="goals" />
        {projectId && (
          <button
            onClick={() => {
              setAddingGoal(true);
              setNewGoalInput("");
            }}
            className="rounded p-0.5 text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
            title="New goal"
          >
            <Plus className="size-3.5" />
          </button>
        )}
      </div>

      {/* Inline goal name input */}
      {addingGoal && (
        <div className="px-3 pb-1">
          <input
            autoFocus
            value={newGoalInput}
            onChange={(e) => setNewGoalInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreateGoal();
              if (e.key === "Escape") {
                setNewGoalInput("");
                setAddingGoal(false);
              }
            }}
            onBlur={handleCreateGoal}
            placeholder="Goal name..."
            className="w-full rounded-md bg-sidebar-accent px-2 py-1 text-sm text-sidebar-foreground outline-none ring-1 ring-primary/50"
          />
        </div>
      )}

      {/* Goal nodes */}
      <div className="pb-2">
        {activeGoals.map((goal) => (
          <SidebarGoalNode
            key={goal.id}
            goal={goal}
            goalJobs={jobsByGoal.get(goal.id) ?? []}
            recentRunsByJob={recentRunsByJob}
            isCollapsed={collapsedGoalIds.includes(goal.id)}
            isSelected={contentView === "goal-detail" && selectedGoalId === goal.id}
            contentView={contentView}
            selectedJobId={selectedJobId}
            onToggleCollapsed={() => toggleGoalCollapsed(goal.id)}
            onSelectGoal={() => selectGoal(goal.id)}
            onSelectJob={selectJob}
            onNewJobForGoal={onNewJobForGoal}
          />
        ))}

        {/* Standalone jobs (no goal) */}
        {standaloneJobs.length > 0 && (
          <div className="mt-3 border-t border-sidebar-border pt-3">
            <div className="mb-1 flex items-center gap-1 px-3">
              <p className="flex-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Jobs
              </p>
              <SortDropdown value={jobSortMode} onChange={setJobSortMode} label="jobs" />
            </div>
            {standaloneJobs.map((job) => (
              <SidebarJobNode
                key={job.id}
                job={job}
                recentRuns={recentRunsByJob.get(job.id) ?? []}
                isSelected={contentView === "job-detail" && selectedJobId === job.id}
                onSelect={() => selectJob(job.id)}
              />
            ))}
          </div>
        )}

        {/* Archived section */}
        {hasArchived && (
          <SidebarArchived
            archivedGoals={archivedGoals}
            archivedStandaloneJobs={archivedStandaloneJobs}
            archivedJobsByGoal={archivedJobsByGoal}
            recentRunsByJob={recentRunsByJob}
            contentView={contentView}
            selectedGoalId={selectedGoalId}
            selectedJobId={selectedJobId}
            selectGoal={selectGoal}
            selectJob={selectJob}
            archivedCount={archivedCount}
          />
        )}
      </div>
    </div>
  );
}
