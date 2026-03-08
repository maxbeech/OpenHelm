import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { setupTestDb } from "./helpers.js";
import {
  compareSemver,
  getVersion,
  verifyClaudeCode,
  detectClaudeCode,
  MIN_CLI_VERSION,
} from "../src/claude-code/detector.js";
import { getSetting } from "../src/db/queries/settings.js";

let cleanup: () => void;

beforeAll(() => {
  cleanup = setupTestDb();
});

afterAll(() => cleanup());

describe("compareSemver", () => {
  it("returns 0 for equal versions", () => {
    expect(compareSemver("2.0.0", "2.0.0")).toBe(0);
    expect(compareSemver("1.2.3", "1.2.3")).toBe(0);
  });

  it("returns -1 when a < b", () => {
    expect(compareSemver("1.0.0", "2.0.0")).toBe(-1);
    expect(compareSemver("2.0.0", "2.1.0")).toBe(-1);
    expect(compareSemver("2.1.0", "2.1.1")).toBe(-1);
  });

  it("returns 1 when a > b", () => {
    expect(compareSemver("3.0.0", "2.0.0")).toBe(1);
    expect(compareSemver("2.2.0", "2.1.0")).toBe(1);
    expect(compareSemver("2.1.2", "2.1.1")).toBe(1);
  });

  it("handles version components of different lengths", () => {
    expect(compareSemver("10.0.0", "9.0.0")).toBe(1);
    expect(compareSemver("2.10.0", "2.9.0")).toBe(1);
  });
});

describe("MIN_CLI_VERSION", () => {
  it("is a valid semver string", () => {
    expect(MIN_CLI_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

describe("getVersion", () => {
  it("returns null for a non-existent binary", async () => {
    const version = await getVersion("/nonexistent/path/claude");
    expect(version).toBeNull();
  });

  it("returns a version string for a real binary", async () => {
    // This test uses the real claude binary if available
    const version = await getVersion("claude");
    if (version) {
      expect(version).toMatch(/^\d+\.\d+\.\d+$/);
    }
    // If claude is not installed, this test passes silently
  });
});

describe("verifyClaudeCode", () => {
  it("returns found=false for a non-existent path", async () => {
    const result = await verifyClaudeCode("/nonexistent/path/claude");
    expect(result.found).toBe(false);
    expect(result.path).toBe("/nonexistent/path/claude");
    expect(result.error).toContain("Binary not found");
  });

  it("returns found=true for an existing non-claude binary", async () => {
    // /bin/echo exists but is not claude
    const result = await verifyClaudeCode("/bin/echo");
    expect(result.found).toBe(true);
    expect(result.version).toBeNull();
    expect(result.meetsMinVersion).toBe(false);
    expect(result.error).toContain("Could not determine version");
  });
});

describe("detectClaudeCode", () => {
  it("returns a detection result", async () => {
    const result = await detectClaudeCode();
    expect(result).toHaveProperty("found");
    expect(result).toHaveProperty("path");
    expect(result).toHaveProperty("version");
    expect(result).toHaveProperty("meetsMinVersion");
  });

  it("rejects an invalid manual path", async () => {
    const result = await detectClaudeCode("/nonexistent/claude");
    expect(result.found).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("persists detection results to settings when successful", async () => {
    const result = await detectClaudeCode();
    if (result.found && result.meetsMinVersion) {
      const storedPath = getSetting("claude_code_path");
      expect(storedPath).not.toBeNull();
      expect(storedPath!.value).toBe(result.path);

      const storedVersion = getSetting("claude_code_version");
      expect(storedVersion).not.toBeNull();
      expect(storedVersion!.value).toBe(result.version);
    }
  });
});
