import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { setupTestDb } from "./helpers.js";
import {
  exportAll,
  getExportStats,
  clearAllData,
  importAllData,
} from "../src/db/queries/export.js";
import { createProject } from "../src/db/queries/projects.js";
import { createGoal } from "../src/db/queries/goals.js";
import { createJob } from "../src/db/queries/jobs.js";
import { createRun } from "../src/db/queries/runs.js";
import { createRunLog } from "../src/db/queries/run-logs.js";
import { setSetting } from "../src/db/queries/settings.js";
import { createMemory } from "../src/db/queries/memories.js";

let cleanup: () => void;

beforeAll(() => {
  cleanup = setupTestDb();
});

afterAll(() => {
  cleanup();
});

function seedData() {
  const project = createProject({
    name: "Test Project",
    directoryPath: "/tmp/test-project",
  });
  const goal = createGoal({
    projectId: project.id,
    name: "Test Goal",
    description: "A test goal",
  });
  const job = createJob({
    projectId: project.id,
    goalId: goal.id,
    name: "Test Job",
    prompt: "Do something",
    scheduleType: "manual",
    scheduleConfig: {},
  });
  const run = createRun({
    jobId: job.id,
    triggerSource: "manual",
  });
  createRunLog({ runId: run.id, stream: "stdout", text: "Hello" });
  setSetting("theme", "dark");
  createMemory({
    projectId: project.id,
    type: "semantic",
    content: "Test memory",
    sourceType: "user",
    tags: ["test"],
  });
  return { project, goal, job, run };
}

describe("export queries", () => {
  it("exportAll returns all tables with correct structure", () => {
    seedData();
    const data = exportAll(true);

    expect(data.projects.length).toBeGreaterThanOrEqual(1);
    expect(data.goals.length).toBeGreaterThanOrEqual(1);
    expect(data.jobs.length).toBeGreaterThanOrEqual(1);
    expect(data.runs.length).toBeGreaterThanOrEqual(1);
    expect(data.runLogs.length).toBeGreaterThanOrEqual(1);
    expect(data.settings.length).toBeGreaterThanOrEqual(1);
    expect(data.memories.length).toBeGreaterThanOrEqual(1);

    // Job should have parsed scheduleConfig
    const job = data.jobs[0];
    expect(typeof job.scheduleConfig).toBe("object");

    // Memory should have parsed tags array
    const mem = data.memories[0];
    expect(Array.isArray(mem.tags)).toBe(true);
  });

  it("exportAll without run logs returns empty runLogs", () => {
    const data = exportAll(false);
    expect(data.runLogs).toEqual([]);
    expect(data.projects.length).toBeGreaterThanOrEqual(1);
  });

  it("getExportStats returns counts and estimates", () => {
    const stats = getExportStats();
    expect(stats.totalRecords).toBeGreaterThan(0);
    expect(stats.runLogCount).toBeGreaterThanOrEqual(1);
    expect(stats.estimatedSizeWithLogs).toBeGreaterThan(stats.estimatedSizeWithoutLogs);
  });

  it("clearAllData empties all tables", () => {
    clearAllData();
    const data = exportAll(true);
    expect(data.projects).toEqual([]);
    expect(data.goals).toEqual([]);
    expect(data.jobs).toEqual([]);
    expect(data.runs).toEqual([]);
    expect(data.runLogs).toEqual([]);
    expect(data.memories).toEqual([]);
    expect(data.settings).toEqual([]);
  });

  it("importAllData inserts data respecting FK order", () => {
    const { project, goal, job, run } = seedData();
    const data = exportAll(true);
    clearAllData();

    const counts = importAllData(data);
    expect(counts.projects).toBeGreaterThanOrEqual(1);
    expect(counts.goals).toBeGreaterThanOrEqual(1);
    expect(counts.jobs).toBeGreaterThanOrEqual(1);
    expect(counts.runs).toBeGreaterThanOrEqual(1);

    // Verify data is actually there
    const exported = exportAll(true);
    expect(exported.projects.length).toBe(data.projects.length);
    expect(exported.goals.length).toBe(data.goals.length);
  });

  it("round-trip: export → clear → import → export matches", () => {
    clearAllData();
    seedData();

    const original = exportAll(true);
    clearAllData();
    importAllData(original);
    const restored = exportAll(true);

    expect(restored.projects.length).toBe(original.projects.length);
    expect(restored.goals.length).toBe(original.goals.length);
    expect(restored.jobs.length).toBe(original.jobs.length);
    expect(restored.runs.length).toBe(original.runs.length);
    expect(restored.runLogs.length).toBe(original.runLogs.length);
    expect(restored.memories.length).toBe(original.memories.length);
    expect(restored.settings.length).toBe(original.settings.length);

    // Verify content matches
    expect(restored.projects[0].name).toBe(original.projects[0].name);
    expect(restored.jobs[0].scheduleConfig).toEqual(original.jobs[0].scheduleConfig);
    expect(restored.memories[0].tags).toEqual(original.memories[0].tags);
  });

  it("handles self-referencing runs (parentRunId)", () => {
    clearAllData();
    const { job, run } = seedData();

    // Create a corrective run with parentRunId
    const corrective = createRun({
      jobId: job.id,
      triggerSource: "corrective",
      parentRunId: run.id,
    });

    const data = exportAll(false);
    expect(data.runs.some((r) => r.parentRunId === run.id)).toBe(true);

    clearAllData();
    const counts = importAllData(data);
    expect(counts.runs).toBeGreaterThanOrEqual(2);

    // Verify self-reference is preserved
    const restored = exportAll(false);
    const restoredCorrective = restored.runs.find((r) => r.id === corrective.id);
    expect(restoredCorrective?.parentRunId).toBe(run.id);
  });

  it("handles empty data import", () => {
    clearAllData();
    const emptyData = exportAll(true);
    const counts = importAllData(emptyData);
    expect(counts.projects).toBe(0);
    expect(counts.settings).toBe(0);
  });
});
