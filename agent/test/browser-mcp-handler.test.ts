import { describe, it, expect, vi, beforeAll } from "vitest";
import { handleRequest } from "../src/ipc/handler.js";

// Mock browser-setup so we control readiness without real file system or Python
vi.mock("../src/mcp-servers/browser-setup.js", () => ({
  isVenvReady: vi.fn(),
  isSourceAvailable: vi.fn(),
  detectPython: vi.fn(),
  setupBrowserMcpVenv: vi.fn(),
}));

// Mock child_process for focusBrowser tests
vi.mock("child_process", () => ({
  execFileSync: vi.fn(),
}));

import { execFileSync } from "child_process";
const mockExecFileSync = vi.mocked(execFileSync);

import {
  isVenvReady,
  isSourceAvailable,
  detectPython,
  setupBrowserMcpVenv,
} from "../src/mcp-servers/browser-setup.js";

const mockIsVenvReady = vi.mocked(isVenvReady);
const mockIsSourceAvailable = vi.mocked(isSourceAvailable);
const mockDetectPython = vi.mocked(detectPython);
const mockSetupBrowserMcpVenv = vi.mocked(setupBrowserMcpVenv);

// Register the handlers once (they're idempotent — duplicate registration is fine for testing)
beforeAll(async () => {
  const { registerBrowserMcpHandlers } = await import(
    "../src/ipc/handlers/browser-mcp.js"
  );
  registerBrowserMcpHandlers();
});

describe("browserMcp.status", () => {
  it("returns all-true when venv ready, source available, python found", async () => {
    mockIsVenvReady.mockReturnValue(true);
    mockIsSourceAvailable.mockReturnValue(true);
    mockDetectPython.mockResolvedValue("python3.13");

    const res = await handleRequest({ id: "1", method: "browserMcp.status" });

    expect(res.error).toBeUndefined();
    expect(res.result).toEqual({
      venvReady: true,
      sourceAvailable: true,
      pythonAvailable: true,
    });
  });

  it("returns venvReady:false when venv not set up", async () => {
    mockIsVenvReady.mockReturnValue(false);
    mockIsSourceAvailable.mockReturnValue(true);
    mockDetectPython.mockResolvedValue("python3.13");

    const res = await handleRequest({ id: "2", method: "browserMcp.status" });

    expect(res.error).toBeUndefined();
    expect((res.result as any).venvReady).toBe(false);
    expect((res.result as any).pythonAvailable).toBe(true);
  });

  it("returns pythonAvailable:false when no Python 3.10-3.13 found", async () => {
    mockIsVenvReady.mockReturnValue(false);
    mockIsSourceAvailable.mockReturnValue(true);
    mockDetectPython.mockResolvedValue(null);

    const res = await handleRequest({ id: "3", method: "browserMcp.status" });

    expect(res.error).toBeUndefined();
    expect((res.result as any).pythonAvailable).toBe(false);
  });

  it("returns sourceAvailable:false when browser MCP source is missing", async () => {
    mockIsVenvReady.mockReturnValue(false);
    mockIsSourceAvailable.mockReturnValue(false);
    mockDetectPython.mockResolvedValue("python3.13");

    const res = await handleRequest({ id: "4", method: "browserMcp.status" });

    expect(res.error).toBeUndefined();
    expect((res.result as any).sourceAvailable).toBe(false);
  });
});

describe("browserMcp.setup", () => {
  it("returns success with paths when setup completes", async () => {
    mockSetupBrowserMcpVenv.mockResolvedValue({
      pythonPath: "/venv/bin/python",
      serverModule: "/browser/src/server.py",
      cwd: "/browser",
    });

    const res = await handleRequest({ id: "5", method: "browserMcp.setup" });

    expect(res.error).toBeUndefined();
    expect((res.result as any).success).toBe(true);
    expect((res.result as any).pythonPath).toBe("/venv/bin/python");
    expect((res.result as any).serverModule).toBe("/browser/src/server.py");
  });

  it("returns error when setup throws (e.g. Python not found)", async () => {
    mockSetupBrowserMcpVenv.mockRejectedValue(
      new Error("Python 3.10+ is required"),
    );

    const res = await handleRequest({ id: "6", method: "browserMcp.setup" });

    expect(res.error).toBeDefined();
    expect(res.error!.message).toContain("Python 3.10+");
  });
});

describe("browserMcp.focusBrowser", () => {
  it("returns success:true when osascript succeeds", async () => {
    mockExecFileSync.mockReturnValue(Buffer.from(""));

    const res = await handleRequest({
      id: "7",
      method: "browserMcp.focusBrowser",
    });

    expect(res.error).toBeUndefined();
    expect((res.result as any).success).toBe(true);
    expect(mockExecFileSync).toHaveBeenCalledWith(
      "osascript",
      ["-e", 'tell application "Google Chrome" to activate'],
      { timeout: 5_000 },
    );
  });

  it("returns success:false when osascript fails", async () => {
    mockExecFileSync.mockImplementation(() => {
      throw new Error("osascript failed");
    });

    const res = await handleRequest({
      id: "8",
      method: "browserMcp.focusBrowser",
    });

    expect(res.error).toBeUndefined();
    expect((res.result as any).success).toBe(false);
  });
});
