import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { existsSync, readFileSync, mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

// Mock the browser-setup module to control venv readiness
vi.mock("../src/mcp-servers/browser-setup.js", () => ({
  getBrowserMcpPaths: vi.fn(),
}));

import { getBrowserMcpPaths } from "../src/mcp-servers/browser-setup.js";
import {
  buildMcpConfig,
  writeMcpConfigFile,
  removeMcpConfigFile,
  cleanupOrphanedConfigs,
} from "../src/mcp-servers/mcp-config-builder.js";

const mockGetBrowserMcpPaths = vi.mocked(getBrowserMcpPaths);

beforeEach(() => {
  vi.resetAllMocks();
});

describe("buildMcpConfig", () => {
  it("returns null when browser venv is not ready", () => {
    mockGetBrowserMcpPaths.mockReturnValue(null);
    expect(buildMcpConfig()).toBeNull();
  });

  it("returns valid config when browser venv is ready", () => {
    mockGetBrowserMcpPaths.mockReturnValue({
      pythonPath: "/path/to/.venv/bin/python",
      serverModule: "/path/to/src/server.py",
      cwd: "/path/to/browser",
    });

    const config = buildMcpConfig();
    expect(config).not.toBeNull();
    expect(config!.mcpServers).toHaveProperty("openhelm-browser");

    const entry = config!.mcpServers["openhelm-browser"];
    expect(entry.command).toBe("/path/to/.venv/bin/python");
    expect(entry.args).toContain("/path/to/src/server.py");
    expect(entry.args).toContain("--transport");
    expect(entry.args).toContain("stdio");
    expect(entry.cwd).toBe("/path/to/browser");
  });
});

describe("writeMcpConfigFile", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "mcp-test-"));
    // Override the config dir by setting env var
    process.env.OPENHELM_DATA_DIR = tempDir;
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
    delete process.env.OPENHELM_DATA_DIR;
  });

  it("returns null when no MCP servers are available", () => {
    mockGetBrowserMcpPaths.mockReturnValue(null);
    // Re-import to pick up the env var — but since the module was already imported,
    // the MCP_CONFIG_DIR is already set. This test just verifies the null path.
    expect(writeMcpConfigFile("test-run-1")).toBeNull();
  });
});

describe("removeMcpConfigFile", () => {
  it("does not throw when file does not exist", () => {
    expect(() => removeMcpConfigFile("/nonexistent/path.json")).not.toThrow();
  });

  it("removes an existing file", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "mcp-rm-test-"));
    const filePath = join(tempDir, "test.json");
    require("fs").writeFileSync(filePath, "{}");
    expect(existsSync(filePath)).toBe(true);

    removeMcpConfigFile(filePath);
    expect(existsSync(filePath)).toBe(false);

    rmSync(tempDir, { recursive: true, force: true });
  });
});

describe("cleanupOrphanedConfigs", () => {
  it("does not throw when config directory does not exist", () => {
    expect(() => cleanupOrphanedConfigs()).not.toThrow();
  });
});
