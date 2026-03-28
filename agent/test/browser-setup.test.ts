import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock child_process.execFile before importing the module under test
vi.mock("child_process", () => ({
  execFile: vi.fn(),
}));

// Mock fs to control isVenvReady / isSourceAvailable
vi.mock("fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("fs")>();
  return {
    ...actual,
    existsSync: vi.fn(),
  };
});

import { existsSync } from "fs";
import { execFile } from "child_process";
import {
  detectPython,
  isVenvReady,
  isSourceAvailable,
  getBrowserMcpPaths,
} from "../src/mcp-servers/browser-setup.js";

const mockExistsSync = vi.mocked(existsSync);
const mockExecFile = vi.mocked(execFile);

beforeEach(() => {
  vi.resetAllMocks();
});

describe("detectPython", () => {
  it("returns python3.13 when it is available and returns 3.13", async () => {
    // Implementation tries python3.13, python3.12, python3.11, python3.10, python3, python.
    // Make python3.13 succeed, others throw ENOENT.
    mockExecFile.mockImplementation(((
      bin: string,
      _args: string[],
      callback: (err: Error | null, result: { stdout: string }) => void,
    ) => {
      if (bin === "python3.13") {
        callback(null, { stdout: "Python 3.13.0\n" });
      } else {
        callback(new Error("ENOENT"), { stdout: "" });
      }
    }) as any);

    const result = await detectPython();
    expect(result).toBe("python3.13");
  });

  it("falls back to python3 when specific versions are unavailable", async () => {
    // Specific version binaries throw ENOENT; python3 succeeds at 3.12.
    mockExecFile.mockImplementation(((
      bin: string,
      _args: string[],
      callback: (err: Error | null, result: { stdout: string }) => void,
    ) => {
      if (bin === "python3") {
        callback(null, { stdout: "Python 3.12.0\n" });
      } else {
        callback(new Error("ENOENT"), { stdout: "" });
      }
    }) as any);

    const result = await detectPython();
    expect(result).toBe("python3");
  });

  it("returns null when Python is below 3.10", async () => {
    mockExecFile.mockImplementation(((
      _bin: string,
      _args: string[],
      callback: (err: Error | null, result: { stdout: string }) => void,
    ) => {
      callback(null, { stdout: "Python 3.8.10\n" });
    }) as any);

    const result = await detectPython();
    expect(result).toBeNull();
  });

  it("returns null when Python is 3.14+ (pydantic-core incompatible)", async () => {
    // Python 3.14+ is excluded to avoid pydantic-core / PyO3 build failures.
    mockExecFile.mockImplementation(((
      _bin: string,
      _args: string[],
      callback: (err: Error | null, result: { stdout: string }) => void,
    ) => {
      callback(null, { stdout: "Python 3.14.0\n" });
    }) as any);

    const result = await detectPython();
    expect(result).toBeNull();
  });

  it("returns null when no Python is found", async () => {
    mockExecFile.mockImplementation(((
      _bin: string,
      _args: string[],
      callback: (err: Error | null, result: { stdout: string }) => void,
    ) => {
      callback(new Error("ENOENT"), { stdout: "" });
    }) as any);

    const result = await detectPython();
    expect(result).toBeNull();
  });
});

describe("isVenvReady", () => {
  it("returns true when venv python binary exists", () => {
    mockExistsSync.mockReturnValue(true);
    expect(isVenvReady()).toBe(true);
  });

  it("returns false when venv python binary does not exist", () => {
    mockExistsSync.mockReturnValue(false);
    expect(isVenvReady()).toBe(false);
  });
});

describe("isSourceAvailable", () => {
  it("returns true when both server.py and requirements.txt exist", () => {
    mockExistsSync.mockReturnValue(true);
    expect(isSourceAvailable()).toBe(true);
  });

  it("returns false when source files are missing", () => {
    mockExistsSync.mockReturnValue(false);
    expect(isSourceAvailable()).toBe(false);
  });
});

describe("getBrowserMcpPaths", () => {
  it("returns null when venv is not ready", () => {
    mockExistsSync.mockReturnValue(false);
    expect(getBrowserMcpPaths()).toBeNull();
  });

  it("returns paths when venv is ready", () => {
    mockExistsSync.mockReturnValue(true);
    const result = getBrowserMcpPaths();
    expect(result).not.toBeNull();
    expect(result!.pythonPath).toContain(".venv/bin/python");
    expect(result!.serverModule).toContain("server.py");
    expect(result!.cwd).toContain("browser");
  });
});
