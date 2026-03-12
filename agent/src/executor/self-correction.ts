/**
 * Self-Correction Engine — orchestrates the decision to create a corrective
 * run after a failed run. Guarantees at most 1 retry per failure event.
 *
 * Loop prevention: corrective runs that fail are NOT retried.
 */

import { getRun, createRun, hasCorrectiveRun } from "../db/queries/runs.js";
import { getJob, updateJobCorrectionContext } from "../db/queries/jobs.js";
import { getSetting } from "../db/queries/settings.js";
import { analyzeFailure } from "../planner/failure-analyzer.js";
import { emit } from "../ipc/emitter.js";
import type { QueueItem } from "../scheduler/queue.js";
import type { Job } from "@openorchestra/shared";

export interface SelfCorrectionResult {
  attempted: boolean;
  correctiveRunId?: string;
  reason: string;
}

export async function attemptSelfCorrection(
  failedRunId: string,
  job: Job,
  enqueueFn: (item: QueueItem) => void,
): Promise<SelfCorrectionResult> {
  // 1. Check setting (default enabled)
  const setting = getSetting("auto_correction_enabled");
  if (setting?.value === "false") {
    return { attempted: false, reason: "Auto-correction disabled in settings" };
  }

  // 2. Check trigger source — never auto-correct a corrective run
  const failedRun = getRun(failedRunId);
  if (!failedRun) {
    return { attempted: false, reason: "Failed run not found" };
  }
  if (failedRun.triggerSource === "corrective") {
    return { attempted: false, reason: "Corrective runs are not retried" };
  }

  // 3. Check duplicate guard
  if (hasCorrectiveRun(failedRunId)) {
    return { attempted: false, reason: "Corrective run already exists" };
  }

  // 4. Analyze the failure
  console.error(`[self-correction] analyzing failure for run ${failedRunId}`);
  const analysis = await analyzeFailure(failedRunId, job.prompt);

  if (!analysis) {
    return { attempted: false, reason: "Failure analysis failed" };
  }
  if (!analysis.fixable || !analysis.correction) {
    return { attempted: false, reason: `Not fixable: ${analysis.reason}` };
  }

  // 5. Update job correction context
  updateJobCorrectionContext(job.id, analysis.correction);
  emit("job.updated", { jobId: job.id });

  // 6. Create corrective run
  const correctiveRun = createRun({
    jobId: job.id,
    triggerSource: "corrective",
    parentRunId: failedRunId,
    correctionContext: analysis.correction,
  });

  console.error(`[self-correction] created corrective run ${correctiveRun.id} for failed run ${failedRunId}`);

  emit("run.created", { runId: correctiveRun.id, jobId: job.id });
  emit("run.statusChanged", {
    runId: correctiveRun.id,
    status: "queued",
    previousStatus: "queued",
  });

  // 7. Enqueue at priority 2 (corrective)
  enqueueFn({
    runId: correctiveRun.id,
    jobId: job.id,
    priority: 2,
    enqueuedAt: Date.now(),
  });

  return {
    attempted: true,
    correctiveRunId: correctiveRun.id,
    reason: analysis.reason,
  };
}
