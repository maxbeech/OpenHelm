import { describe, it, expect, beforeEach, vi, type Mock } from "vitest";

// Mock child_process before importing the module under test
vi.mock("child_process", () => ({
  spawn: vi.fn(),
}));

import { spawn } from "child_process";
import {
  onRunStarted,
  onRunFinished,
  stopSleepGuard,
  isSleepGuardActive,
} from "../src/power/sleep-guard.js";

type EventMap = Record<string, ((...args: unknown[]) => void)[]>;

function makeMockProcess() {
  const listeners: EventMap = {};
  return {
    kill: vi.fn(),
    on: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
      listeners[event] = listeners[event] ?? [];
      listeners[event].push(cb);
    }),
    emit(event: string, ...args: unknown[]) {
      (listeners[event] ?? []).forEach((cb) => cb(...args));
    },
  };
}

beforeEach(() => {
  // Reset state between tests by stopping any active guard
  stopSleepGuard();
  vi.clearAllMocks();
});

describe("sleep-guard", () => {
  it("starts caffeinate on first run started", () => {
    const mockProc = makeMockProcess();
    (spawn as Mock).mockReturnValue(mockProc);

    expect(isSleepGuardActive()).toBe(false);
    onRunStarted();
    expect(spawn).toHaveBeenCalledOnce();
    expect(spawn).toHaveBeenCalledWith(
      "caffeinate",
      ["-i", "-w", String(process.pid)],
      expect.objectContaining({ stdio: "ignore" }),
    );
    expect(isSleepGuardActive()).toBe(true);
  });

  it("does not start a second caffeinate for concurrent runs", () => {
    const mockProc = makeMockProcess();
    (spawn as Mock).mockReturnValue(mockProc);

    onRunStarted();
    onRunStarted();
    onRunStarted();

    expect(spawn).toHaveBeenCalledOnce();
    expect(isSleepGuardActive()).toBe(true);
  });

  it("keeps caffeinate alive while runs are active", () => {
    const mockProc = makeMockProcess();
    (spawn as Mock).mockReturnValue(mockProc);

    onRunStarted();
    onRunStarted();
    onRunFinished(); // 1 still running

    expect(mockProc.kill).not.toHaveBeenCalled();
    expect(isSleepGuardActive()).toBe(true);
  });

  it("stops caffeinate when all runs finish", () => {
    const mockProc = makeMockProcess();
    (spawn as Mock).mockReturnValue(mockProc);

    onRunStarted();
    onRunStarted();
    onRunFinished();
    onRunFinished(); // 0 running

    expect(mockProc.kill).toHaveBeenCalledWith("SIGTERM");
    expect(isSleepGuardActive()).toBe(false);
  });

  it("stopSleepGuard force-stops caffeinate", () => {
    const mockProc = makeMockProcess();
    (spawn as Mock).mockReturnValue(mockProc);

    onRunStarted();
    onRunStarted();
    stopSleepGuard();

    expect(mockProc.kill).toHaveBeenCalledWith("SIGTERM");
    expect(isSleepGuardActive()).toBe(false);
  });

  it("clears active run count after stopSleepGuard", () => {
    const mockProc = makeMockProcess();
    (spawn as Mock).mockReturnValue(mockProc);

    onRunStarted();
    onRunStarted();
    stopSleepGuard();

    // Further calls should be safe — no negative counter
    onRunFinished();
    expect(mockProc.kill).toHaveBeenCalledOnce(); // no double-kill
  });

  it("handles caffeinate exiting unexpectedly", () => {
    const mockProc = makeMockProcess();
    (spawn as Mock).mockReturnValue(mockProc);

    onRunStarted();
    expect(isSleepGuardActive()).toBe(true);

    // Simulate caffeinate exiting (e.g., user runs `killall caffeinate`)
    mockProc.emit("exit", 1);
    expect(isSleepGuardActive()).toBe(false);
  });

  it("onRunFinished below zero is safe", () => {
    // No active runs — calling onRunFinished should not throw
    expect(() => onRunFinished()).not.toThrow();
  });
});
