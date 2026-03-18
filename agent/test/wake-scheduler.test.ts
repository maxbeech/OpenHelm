import { describe, it, expect, beforeEach, vi, type Mock } from "vitest";
import { execFile } from "child_process";
import { existsSync } from "fs";

// Mock child_process and fs before importing the module under test
vi.mock("child_process", () => ({
  execFile: vi.fn(),
}));

vi.mock("fs", () => ({
  existsSync: vi.fn().mockReturnValue(true),
}));

// Mock db/queries/jobs to control what listJobs returns
vi.mock("../src/db/queries/jobs.js", () => ({
  listJobs: vi.fn().mockReturnValue([]),
}));

import {
  formatPmsetDate,
  scheduleWake,
  cancelWake,
  cancelAllWakes,
  syncWakeEvents,
  checkWakeAuthorization,
  installSudoersEntry,
  getScheduledWakeCount,
} from "../src/power/wake-scheduler.js";
import { listJobs } from "../src/db/queries/jobs.js";

/** Make execFile succeed with empty output. */
function mockExecFileSuccess() {
  (execFile as Mock).mockImplementation(
    (_cmd: string, _args: string[], _opts: unknown, cb: (err: null, out: { stdout: string; stderr: string }) => void) => {
      const callback = typeof _opts === "function" ? _opts : cb;
      (callback as Function)(null, { stdout: "", stderr: "" });
      return {} as unknown;
    },
  );
}

/** Make execFile fail with an error. */
function mockExecFileError(message: string) {
  (execFile as Mock).mockImplementation(
    (_cmd: string, _args: string[], _opts: unknown, cb: (err: Error) => void) => {
      const callback = typeof _opts === "function" ? _opts : cb;
      (callback as Function)(new Error(message));
      return {} as unknown;
    },
  );
}

beforeEach(async () => {
  await cancelAllWakes();
  vi.clearAllMocks();
});

describe("formatPmsetDate", () => {
  it("formats date in MM/dd/yyyy HH:mm:ss format", () => {
    const d = new Date(2026, 2, 17, 14, 5, 9);
    expect(formatPmsetDate(d)).toBe("03/17/2026 14:05:09");
  });

  it("zero-pads month and day", () => {
    const d = new Date(2026, 0, 5, 9, 3, 7);
    expect(formatPmsetDate(d)).toBe("01/05/2026 09:03:07");
  });
});

describe("scheduleWake", () => {
  it("calls sudo pmset with correct args (no osascript)", async () => {
    mockExecFileSuccess();

    const fireAt = new Date(Date.now() + 10 * 60_000);
    await scheduleWake("job-1", fireAt);

    expect(execFile).toHaveBeenCalledOnce();
    const [cmd, args] = (execFile as Mock).mock.calls[0] as [string, string[]];
    // Must use sudo, NOT osascript
    expect(cmd).toBe("sudo");
    expect(args[0]).toBe("-n");
    expect(args[1]).toBe("/usr/bin/pmset");
    expect(args).toContain("schedule");
    expect(args).toContain("wakeorpoweron");
  });

  it("tracks the scheduled wake count", async () => {
    mockExecFileSuccess();

    const fireAt = new Date(Date.now() + 10 * 60_000);
    await scheduleWake("job-a", fireAt);
    await scheduleWake("job-b", fireAt);

    expect(getScheduledWakeCount()).toBe(2);
  });

  it("skips scheduling when wake time would be in the past", async () => {
    mockExecFileSuccess();

    const fireAt = new Date(Date.now() + 60_000);
    await scheduleWake("job-past", fireAt);

    expect(execFile).not.toHaveBeenCalled();
    expect(getScheduledWakeCount()).toBe(0);
  });

  it("replaces existing wake when called again for same job", async () => {
    mockExecFileSuccess();

    const fireAt1 = new Date(Date.now() + 10 * 60_000);
    await scheduleWake("job-replace", fireAt1);
    expect(execFile).toHaveBeenCalledOnce();

    const fireAt2 = new Date(Date.now() + 20 * 60_000);
    await scheduleWake("job-replace", fireAt2);

    // 3 total: 1 schedule + 1 cancel + 1 new schedule
    expect(execFile).toHaveBeenCalledTimes(3);
    expect(getScheduledWakeCount()).toBe(1);
  });
});

describe("cancelWake", () => {
  it("calls sudo pmset cancel for a previously scheduled wake", async () => {
    mockExecFileSuccess();

    const fireAt = new Date(Date.now() + 10 * 60_000);
    await scheduleWake("job-cancel", fireAt);
    vi.clearAllMocks();
    mockExecFileSuccess();

    await cancelWake("job-cancel");

    expect(execFile).toHaveBeenCalledOnce();
    const [cmd, args] = (execFile as Mock).mock.calls[0] as [string, string[]];
    expect(cmd).toBe("sudo");
    expect(args).toContain("cancel");
    expect(getScheduledWakeCount()).toBe(0);
  });

  it("is a no-op when job has no scheduled wake", async () => {
    await cancelWake("nonexistent-job");
    expect(execFile).not.toHaveBeenCalled();
  });

  it("handles pmset cancel error gracefully (non-fatal)", async () => {
    mockExecFileSuccess();

    const fireAt = new Date(Date.now() + 10 * 60_000);
    await scheduleWake("job-err", fireAt);
    vi.clearAllMocks();
    mockExecFileError("pmset: event not found");

    await expect(cancelWake("job-err")).resolves.toBeUndefined();
    expect(getScheduledWakeCount()).toBe(0);
  });
});

describe("cancelAllWakes", () => {
  it("cancels all tracked wakes", async () => {
    mockExecFileSuccess();

    const fireAt = new Date(Date.now() + 10 * 60_000);
    await scheduleWake("job-1", fireAt);
    await scheduleWake("job-2", fireAt);
    expect(getScheduledWakeCount()).toBe(2);

    vi.clearAllMocks();
    mockExecFileSuccess();

    await cancelAllWakes();
    expect(getScheduledWakeCount()).toBe(0);
    // One cancel call per wake (each is a separate sudo call, but no dialogs)
    expect(execFile).toHaveBeenCalledTimes(2);
  });

  it("is a no-op when no wakes are tracked", async () => {
    await cancelAllWakes();
    expect(execFile).not.toHaveBeenCalled();
  });
});

describe("syncWakeEvents", () => {
  it("schedules wakes for all enabled jobs with future nextFireAt", async () => {
    mockExecFileSuccess();

    const futureDate = new Date(Date.now() + 60 * 60_000).toISOString();
    (listJobs as Mock).mockReturnValue([
      { id: "j1", nextFireAt: futureDate },
      { id: "j2", nextFireAt: futureDate },
      { id: "j3", nextFireAt: null },
    ]);

    await syncWakeEvents();

    expect(getScheduledWakeCount()).toBe(2);
    // Each uses sudo pmset (no osascript dialog)
    expect(execFile).toHaveBeenCalledTimes(2);
    const [cmd] = (execFile as Mock).mock.calls[0] as [string];
    expect(cmd).toBe("sudo");
  });

  it("skips jobs whose nextFireAt is in the past or within wake lead time", async () => {
    mockExecFileSuccess();

    const pastDate = new Date(Date.now() - 60_000).toISOString();
    const soonDate = new Date(Date.now() + 60_000).toISOString();
    (listJobs as Mock).mockReturnValue([
      { id: "j-past", nextFireAt: pastDate },
      { id: "j-soon", nextFireAt: soonDate },
    ]);

    await syncWakeEvents();
    expect(getScheduledWakeCount()).toBe(0);
    expect(execFile).not.toHaveBeenCalled();
  });
});

describe("installSudoersEntry", () => {
  it("uses osascript with administrator privileges (one dialog)", async () => {
    mockExecFileSuccess();

    const result = await installSudoersEntry();
    expect(result.authorized).toBe(true);

    expect(execFile).toHaveBeenCalledOnce();
    const [cmd, args] = (execFile as Mock).mock.calls[0] as [string, string[]];
    expect(cmd).toBe("osascript");
    expect(args[1]).toContain("with administrator privileges");
    expect(args[1]).toContain("sudoers.d/openhelm-pmset");
  });

  it("returns authorized: false when user cancels dialog", async () => {
    mockExecFileError("User cancelled.");

    const result = await installSudoersEntry();
    expect(result.authorized).toBe(false);
    expect(result.error).toBeDefined();
  });
});

describe("checkWakeAuthorization", () => {
  it("returns authorized: true when sudoers file exists and sudo works", async () => {
    (existsSync as Mock).mockReturnValue(true);
    mockExecFileSuccess();

    const result = await checkWakeAuthorization();
    expect(result.authorized).toBe(true);
  });

  it("returns authorized: false when sudoers file does not exist", async () => {
    (existsSync as Mock).mockReturnValue(false);

    const result = await checkWakeAuthorization();
    expect(result.authorized).toBe(false);
  });

  it("returns authorized: false when sudo pmset still requires a password", async () => {
    (existsSync as Mock).mockReturnValue(true);
    mockExecFileError("sudo: a password is required");

    const result = await checkWakeAuthorization();
    expect(result.authorized).toBe(false);
  });
});
