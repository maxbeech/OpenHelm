import { describe, it, expect, beforeEach, vi } from "vitest";
import { useRunStore } from "./run-store";
import type { Run } from "@openorchestra/shared";

const mockRun: Run = {
  id: "r1",
  jobId: "j1",
  status: "running",
  triggerSource: "manual",
  startedAt: "2026-01-01T00:00:00Z",
  finishedAt: null,
  exitCode: null,
  summary: null,
  createdAt: "2026-01-01T00:00:00Z",
};

describe("RunStore", () => {
  beforeEach(() => {
    useRunStore.setState({
      runs: [mockRun],
      loading: false,
      error: null,
    });
  });

  it("updates run status by ID", () => {
    useRunStore.getState().updateRunStatus("r1", "succeeded");
    const run = useRunStore.getState().runs.find((r) => r.id === "r1");
    expect(run?.status).toBe("succeeded");
  });

  it("does not affect other runs when updating status", () => {
    const otherRun: Run = { ...mockRun, id: "r2", status: "queued" };
    useRunStore.setState({ runs: [mockRun, otherRun] });
    useRunStore.getState().updateRunStatus("r1", "failed");
    const other = useRunStore.getState().runs.find((r) => r.id === "r2");
    expect(other?.status).toBe("queued");
  });

  it("updates partial run data in store", () => {
    useRunStore.getState().updateRunInStore({
      id: "r1",
      status: "succeeded",
      finishedAt: "2026-01-01T00:05:00Z",
      summary: "Done",
    });
    const run = useRunStore.getState().runs.find((r) => r.id === "r1");
    expect(run?.status).toBe("succeeded");
    expect(run?.summary).toBe("Done");
    expect(run?.finishedAt).toBe("2026-01-01T00:05:00Z");
  });

  it("ignores updates for non-existent run IDs", () => {
    useRunStore.getState().updateRunStatus("nonexistent", "failed");
    expect(useRunStore.getState().runs).toHaveLength(1);
    expect(useRunStore.getState().runs[0].status).toBe("running");
  });
});
