import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, existsSync, readdirSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";

// Mock the dashboard-items DB module
vi.mock("../src/db/queries/dashboard-items.js", () => ({
  createDashboardItem: vi.fn((params) => ({
    id: `dash-${randomUUID()}`,
    ...params,
    status: "open",
    createdAt: new Date().toISOString(),
    resolvedAt: null,
  })),
}));

// Mock the IPC emitter
vi.mock("../src/ipc/emitter.js", () => ({
  emit: vi.fn(),
}));

import { createDashboardItem } from "../src/db/queries/dashboard-items.js";
import { emit } from "../src/ipc/emitter.js";
import {
  InterventionWatcher,
  cleanupOrphanedInterventions,
} from "../src/executor/intervention-watcher.js";

const mockCreateDashboardItem = vi.mocked(createDashboardItem);
const mockEmit = vi.mocked(emit);

let testDir: string;
const RUN_ID = "test-run-123";
const JOB_ID = "test-job-456";
const PROJECT_ID = "test-proj-789";

function writeRequestFile(
  runId: string,
  reason = "Solve CAPTCHA",
  id?: string,
): string {
  const reqId = id ?? randomUUID();
  const filePath = join(testDir, "interventions", `req-${reqId}.json`);
  writeFileSync(
    filePath,
    JSON.stringify({
      id: reqId,
      runId,
      reason,
      screenshotPath: null,
      pageUrl: "https://example.com",
      timestamp: new Date().toISOString(),
    }),
  );
  return reqId;
}

beforeEach(() => {
  vi.useFakeTimers();
  mockCreateDashboardItem.mockClear();
  mockEmit.mockClear();

  // Create a unique temp dir for each test
  testDir = join(tmpdir(), `openhelm-test-${randomUUID()}`);
  mkdirSync(join(testDir, "interventions"), { recursive: true });
  process.env.OPENHELM_DATA_DIR = testDir;
});

afterEach(() => {
  vi.useRealTimers();
  delete process.env.OPENHELM_DATA_DIR;
});

describe("InterventionWatcher", () => {
  it("detects a request file and creates a dashboard item", () => {
    const watcher = new InterventionWatcher(RUN_ID, JOB_ID, PROJECT_ID);
    watcher.start();

    writeRequestFile(RUN_ID, "reCAPTCHA detected");

    vi.advanceTimersByTime(5_000);

    expect(mockCreateDashboardItem).toHaveBeenCalledOnce();
    expect(mockCreateDashboardItem).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: RUN_ID,
        jobId: JOB_ID,
        projectId: PROJECT_ID,
        type: "captcha_intervention",
        message: "reCAPTCHA detected",
      }),
    );
    expect(mockEmit).toHaveBeenCalledWith("dashboard.created", expect.any(Object));

    watcher.stop();
  });

  it("ignores request files for other run IDs", () => {
    const watcher = new InterventionWatcher(RUN_ID, JOB_ID, PROJECT_ID);
    watcher.start();

    writeRequestFile("other-run-999", "Some other CAPTCHA");

    vi.advanceTimersByTime(5_000);

    expect(mockCreateDashboardItem).not.toHaveBeenCalled();

    watcher.stop();
  });

  it("does not create duplicate dashboard items for the same file", () => {
    const watcher = new InterventionWatcher(RUN_ID, JOB_ID, PROJECT_ID);
    watcher.start();

    writeRequestFile(RUN_ID, "CAPTCHA blocking");

    // First tick — should create
    vi.advanceTimersByTime(5_000);
    expect(mockCreateDashboardItem).toHaveBeenCalledOnce();

    // Second tick — should not create again (file was consumed)
    vi.advanceTimersByTime(5_000);
    expect(mockCreateDashboardItem).toHaveBeenCalledOnce();

    watcher.stop();
  });

  it("handles multiple request files", () => {
    const watcher = new InterventionWatcher(RUN_ID, JOB_ID, PROJECT_ID);
    watcher.start();

    writeRequestFile(RUN_ID, "First CAPTCHA");
    writeRequestFile(RUN_ID, "Second CAPTCHA");

    vi.advanceTimersByTime(5_000);

    expect(mockCreateDashboardItem).toHaveBeenCalledTimes(2);

    watcher.stop();
  });

  it("removes consumed request files", () => {
    const watcher = new InterventionWatcher(RUN_ID, JOB_ID, PROJECT_ID);
    watcher.start();

    writeRequestFile(RUN_ID);

    vi.advanceTimersByTime(5_000);

    const files = readdirSync(join(testDir, "interventions")).filter(
      (f) => f.startsWith("req-"),
    );
    expect(files).toHaveLength(0);

    watcher.stop();
  });

  it("skips non-json files", () => {
    const watcher = new InterventionWatcher(RUN_ID, JOB_ID, PROJECT_ID);
    watcher.start();

    writeFileSync(
      join(testDir, "interventions", "req-bad.txt"),
      "not json",
    );

    vi.advanceTimersByTime(5_000);

    expect(mockCreateDashboardItem).not.toHaveBeenCalled();

    watcher.stop();
  });

  it("stop() clears the polling interval", () => {
    const watcher = new InterventionWatcher(RUN_ID, JOB_ID, PROJECT_ID);
    watcher.start();
    watcher.stop();

    writeRequestFile(RUN_ID);
    vi.advanceTimersByTime(10_000);

    expect(mockCreateDashboardItem).not.toHaveBeenCalled();
  });

  it("start() is idempotent", () => {
    const watcher = new InterventionWatcher(RUN_ID, JOB_ID, PROJECT_ID);
    watcher.start();
    watcher.start(); // Second call should be a no-op

    writeRequestFile(RUN_ID);
    vi.advanceTimersByTime(5_000);

    // Should only be called once (not doubled)
    expect(mockCreateDashboardItem).toHaveBeenCalledOnce();

    watcher.stop();
  });
});

describe("cleanupOrphanedInterventions", () => {
  it("removes leftover request and screenshot files", () => {
    writeFileSync(
      join(testDir, "interventions", "req-orphan.json"),
      "{}",
    );
    writeFileSync(
      join(testDir, "interventions", "screenshot-orphan.png"),
      "PNG",
    );

    cleanupOrphanedInterventions();

    const files = readdirSync(join(testDir, "interventions"));
    expect(files).toHaveLength(0);
  });

  it("does not fail if directory does not exist", () => {
    process.env.OPENHELM_DATA_DIR = join(tmpdir(), `nonexistent-${randomUUID()}`);
    expect(() => cleanupOrphanedInterventions()).not.toThrow();
  });
});
