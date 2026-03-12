import { registerHandler } from "../handler.js";
import { createRun } from "../../db/queries/runs.js";
import { getJob } from "../../db/queries/jobs.js";
import { jobQueue } from "../../scheduler/queue.js";
import { scheduler } from "../../scheduler/index.js";
import { executor } from "../../executor/index.js";
import { emit } from "../emitter.js";
import type {
  TriggerRunParams,
  CancelRunParams,
  SchedulerStatus,
} from "@openorchestra/shared";

export function registerSchedulerHandlers() {
  /**
   * Manually trigger a job run.
   * If fireAt is provided and in the future, creates a deferred run that the
   * scheduler will promote to "queued" when the time arrives.
   * Otherwise, creates a run with triggerSource="manual" and enqueues immediately
   * with priority 0 (highest priority — starts before scheduled runs).
   */
  registerHandler("runs.trigger", (params) => {
    const p = params as TriggerRunParams;
    if (!p?.jobId) throw new Error("jobId is required");

    const job = getJob(p.jobId);
    if (!job) throw new Error(`Job not found: ${p.jobId}`);

    // Deferred path: fireAt is set and is in the future
    if (p.fireAt && new Date(p.fireAt) > new Date()) {
      const run = createRun({
        jobId: p.jobId,
        triggerSource: "manual",
        status: "deferred",
        scheduledFor: p.fireAt,
      });

      emit("run.created", { runId: run.id, jobId: p.jobId });
      emit("run.statusChanged", {
        runId: run.id,
        status: "deferred",
        jobId: p.jobId,
      });

      return run;
    }

    // Immediate path: fire now
    const run = createRun({ jobId: p.jobId, triggerSource: "manual" });

    jobQueue.enqueue({
      runId: run.id,
      jobId: p.jobId,
      priority: 0, // Manual = highest priority
      enqueuedAt: Date.now(),
    });

    emit("run.created", { runId: run.id, jobId: p.jobId });
    emit("run.statusChanged", {
      runId: run.id,
      status: "queued",
      jobId: p.jobId,
    });

    // Signal executor to check for work
    executor.processNext();

    return run;
  });

  /**
   * Cancel a run.
   * If queued or deferred: removes from queue and marks cancelled.
   * If running: aborts the Claude Code process and marks cancelled.
   */
  registerHandler("runs.cancel", (params) => {
    const p = params as CancelRunParams;
    if (!p?.runId) throw new Error("runId is required");

    const cancelled = executor.cancelRun(p.runId);
    return { cancelled };
  });

  /**
   * Get current scheduler and executor status.
   */
  registerHandler("scheduler.status", () => {
    const status: SchedulerStatus = {
      schedulerRunning: scheduler.running,
      tickIntervalMs: scheduler.tickIntervalMs,
      activeRuns: executor.activeRunCount,
      queuedRuns: jobQueue.size(),
      maxConcurrency: executor.maxConcurrency,
    };
    return status;
  });
}
