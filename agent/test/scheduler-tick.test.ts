import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { setupTestDb } from "./helpers.js";
import { createProject } from "../src/db/queries/projects.js";
import {
  createJob,
  getJob,
  updateJob,
  updateJobNextFireAt,
} from "../src/db/queries/jobs.js";
import { createRun, listRuns } from "../src/db/queries/runs.js";
import { JobQueue } from "../src/scheduler/queue.js";
import { Scheduler } from "../src/scheduler/index.js";
import type { Job } from "@openorchestra/shared";

// Use a fresh queue for each test (not the singleton)
let queue: JobQueue;
let cleanup: () => void;
let projectId: string;

// Mock the jobQueue singleton used by the Scheduler
vi.mock("../src/scheduler/queue.js", async (importOriginal) => {
  const orig = await importOriginal<typeof import("../src/scheduler/queue.js")>();
  return {
    ...orig,
    get jobQueue() {
      return queue;
    },
  };
});

// Mock the emitter to prevent stdout writes during tests
vi.mock("../src/ipc/emitter.js", () => ({
  emit: vi.fn(),
  send: vi.fn(),
}));

beforeAll(() => {
  cleanup = setupTestDb();
  const project = createProject({
    name: "Scheduler Test",
    directoryPath: "/tmp/sched-test",
  });
  projectId = project.id;
});

afterAll(() => cleanup());

beforeEach(() => {
  queue = new JobQueue();
});

function createPastJob(name: string, minutesAgo: number): Job {
  const pastTime = new Date(Date.now() - minutesAgo * 60_000).toISOString();
  const job = createJob({
    projectId,
    name,
    prompt: `test ${name}`,
    scheduleType: "interval",
    scheduleConfig: { minutes: 10 },
  });
  updateJobNextFireAt(job.id, pastTime);
  return getJob(job.id)!;
}

function createFutureJob(name: string, minutesAhead: number): Job {
  const futureTime = new Date(Date.now() + minutesAhead * 60_000).toISOString();
  const job = createJob({
    projectId,
    name,
    prompt: `test ${name}`,
    scheduleType: "interval",
    scheduleConfig: { minutes: 10 },
  });
  updateJobNextFireAt(job.id, futureTime);
  return getJob(job.id)!;
}

describe("Scheduler tick", () => {
  it("enqueues runs for due jobs", () => {
    createPastJob("due-job-1", 5);
    createPastJob("due-job-2", 10);

    const scheduler = new Scheduler();
    scheduler.tick();

    expect(queue.size()).toBe(2);
  });

  it("does not enqueue future jobs", () => {
    // Pre-populate queue with orphaned queued runs from prior tests
    // so the safety net doesn't re-enqueue them as new work
    const existingQueued = listRuns({ status: "queued", limit: 100 });
    for (const r of existingQueued) {
      queue.enqueue({ runId: r.id, jobId: r.jobId, priority: 1, enqueuedAt: Date.now() });
    }
    const sizeBefore = queue.size();

    createFutureJob("future-job", 30);

    const scheduler = new Scheduler();
    scheduler.tick();

    // No NEW items should have been enqueued
    expect(queue.size()).toBe(sizeBefore);
  });

  it("does not enqueue disabled jobs", () => {
    const job = createPastJob("disabled-job", 5);
    updateJob({ id: job.id, isEnabled: false });

    const scheduler = new Scheduler();
    scheduler.tick();

    const queueItems = queue.getAll();
    const hasDisabledJob = queueItems.some((i) => i.jobId === job.id);
    expect(hasDisabledJob).toBe(false);
  });

  it("creates run records with triggerSource=scheduled", () => {
    const job = createPastJob("scheduled-trigger", 5);

    const scheduler = new Scheduler();
    scheduler.tick();

    const runs = listRuns({ jobId: job.id, status: "queued" });
    expect(runs.length).toBeGreaterThanOrEqual(1);
    const latestRun = runs[0];
    expect(latestRun.triggerSource).toBe("scheduled");
  });

  it("updates nextFireAt after enqueuing", () => {
    const job = createPastJob("next-fire-update", 5);
    const oldNextFire = job.nextFireAt;

    const scheduler = new Scheduler();
    scheduler.tick();

    const updated = getJob(job.id);
    expect(updated!.nextFireAt).not.toBe(oldNextFire);
    expect(new Date(updated!.nextFireAt!).getTime()).toBeGreaterThan(Date.now());
  });

  it("enqueues with priority 1 (scheduled)", () => {
    createPastJob("priority-check", 5);

    const scheduler = new Scheduler();
    scheduler.tick();

    const item = queue.peek();
    expect(item).not.toBeNull();
    expect(item!.priority).toBe(1);
  });

  it("calls onWorkEnqueued callback when runs are enqueued", () => {
    createPastJob("callback-test", 5);

    const onWorkEnqueued = vi.fn();
    const scheduler = new Scheduler();
    scheduler.setOnWorkEnqueued(onWorkEnqueued);
    scheduler.tick();

    expect(onWorkEnqueued).toHaveBeenCalledOnce();
  });

  it("does not call onWorkEnqueued when no jobs are due and no orphaned runs", () => {
    // Note: previous tests may leave orphaned queued runs in the DB.
    // Create a fresh scheduler with a fresh queue; if the queue re-enqueues
    // orphaned runs from prior tests, the callback WILL fire. Pre-enqueue
    // all existing queued runs so the safety net sees them as already queued.
    const existingQueued = listRuns({ status: "queued", limit: 100 });
    for (const r of existingQueued) {
      queue.enqueue({ runId: r.id, jobId: r.jobId, priority: 1, enqueuedAt: Date.now() });
    }

    createFutureJob("no-callback", 60);

    const sizeBefore = queue.size();
    const onWorkEnqueued = vi.fn();
    const scheduler = new Scheduler();
    scheduler.setOnWorkEnqueued(onWorkEnqueued);
    scheduler.tick();

    // No NEW work should have been enqueued (queue size unchanged)
    expect(queue.size()).toBe(sizeBefore);
    expect(onWorkEnqueued).not.toHaveBeenCalled();
  });
});

describe("Scheduler tick — orphaned queued runs", () => {
  it("re-enqueues orphaned queued runs not in the in-memory queue", () => {
    const job = createJob({
      projectId,
      name: "orphan-job",
      prompt: "test",
      scheduleType: "manual",
      scheduleConfig: {},
    });
    // Create a queued run that is NOT in the in-memory queue (orphaned)
    const run = createRun({ jobId: job.id, triggerSource: "scheduled" });

    const scheduler = new Scheduler();
    scheduler.tick();

    // The orphaned run should now be in the queue
    expect(queue.has(run.id)).toBe(true);
    const items = queue.getAll();
    const found = items.find((i) => i.runId === run.id);
    expect(found).toBeDefined();
    expect(found!.priority).toBe(1); // scheduled
  });

  it("assigns priority 2 to orphaned corrective runs", () => {
    const job = createJob({
      projectId,
      name: "orphan-corrective-job",
      prompt: "test",
      scheduleType: "manual",
      scheduleConfig: {},
    });
    const parentRun = createRun({ jobId: job.id, triggerSource: "scheduled" });
    const correctiveRun = createRun({
      jobId: job.id,
      triggerSource: "corrective",
      parentRunId: parentRun.id,
    });

    const scheduler = new Scheduler();
    scheduler.tick();

    const items = queue.getAll();
    const found = items.find((i) => i.runId === correctiveRun.id);
    expect(found).toBeDefined();
    expect(found!.priority).toBe(2); // corrective
  });

  it("does not duplicate runs already in the queue", () => {
    const job = createJob({
      projectId,
      name: "no-dup-job",
      prompt: "test",
      scheduleType: "manual",
      scheduleConfig: {},
    });
    const run = createRun({ jobId: job.id, triggerSource: "manual" });

    // Pre-enqueue the run (it's NOT orphaned)
    queue.enqueue({
      runId: run.id,
      jobId: job.id,
      priority: 0,
      enqueuedAt: Date.now(),
    });

    const scheduler = new Scheduler();
    scheduler.tick();

    // Should still have exactly 1 entry for this run
    const items = queue.getAll();
    const matches = items.filter((i) => i.runId === run.id);
    expect(matches.length).toBe(1);
  });

  it("calls onWorkEnqueued when orphaned runs are re-enqueued", () => {
    const job = createJob({
      projectId,
      name: "orphan-callback-job",
      prompt: "test",
      scheduleType: "manual",
      scheduleConfig: {},
    });
    createRun({ jobId: job.id, triggerSource: "scheduled" });

    const onWorkEnqueued = vi.fn();
    const scheduler = new Scheduler();
    scheduler.setOnWorkEnqueued(onWorkEnqueued);
    scheduler.tick();

    expect(onWorkEnqueued).toHaveBeenCalled();
  });
});

describe("Scheduler start/stop", () => {
  it("reports running state", () => {
    const scheduler = new Scheduler();
    expect(scheduler.running).toBe(false);
    scheduler.start();
    expect(scheduler.running).toBe(true);
    scheduler.stop();
    expect(scheduler.running).toBe(false);
  });

  it("start is idempotent", () => {
    const scheduler = new Scheduler();
    scheduler.start();
    scheduler.start();
    expect(scheduler.running).toBe(true);
    scheduler.stop();
  });
});
