import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, readFileSync, statSync, mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "oh-browser-creds-test-"));
  process.env.OPENHELM_DATA_DIR = tempDir;
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
  delete process.env.OPENHELM_DATA_DIR;
});

// Dynamic import to pick up env var
async function loadModule() {
  // Reset module cache so BROWSER_CREDS_DIR picks up the new env var
  const mod = await import("../src/credentials/browser-credentials.js");
  return mod;
}

describe("writeBrowserCredentialsFile", () => {
  it("writes a JSON file with correct content", async () => {
    const { writeBrowserCredentialsFile } = await loadModule();

    const path = writeBrowserCredentialsFile("run-123", [
      { name: "GitHub", type: "username_password", username: "user", password: "pass" },
      { name: "API Key", type: "token", value: "tok_abc" },
    ]);

    expect(existsSync(path)).toBe(true);
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    expect(parsed.credentials).toHaveLength(2);
    expect(parsed.credentials[0].name).toBe("GitHub");
    expect(parsed.credentials[0].username).toBe("user");
    expect(parsed.credentials[1].name).toBe("API Key");
    expect(parsed.credentials[1].value).toBe("tok_abc");
  });

  it("creates the file with 0600 permissions", async () => {
    const { writeBrowserCredentialsFile } = await loadModule();

    const path = writeBrowserCredentialsFile("run-perms", [
      { name: "Test", type: "token", value: "val" },
    ]);

    const stats = statSync(path);
    // 0o600 = owner read+write only (octal 33188 on macOS/Linux)
    const mode = stats.mode & 0o777;
    expect(mode).toBe(0o600);
  });

  it("uses a random UUID in the filename", async () => {
    const { writeBrowserCredentialsFile } = await loadModule();

    const path1 = writeBrowserCredentialsFile("run-1", []);
    const path2 = writeBrowserCredentialsFile("run-1", []);

    // Same runId but different file paths due to UUID
    expect(path1).not.toBe(path2);
  });

  it("writes to the browser-credentials subdirectory", async () => {
    const { writeBrowserCredentialsFile } = await loadModule();
    const path = writeBrowserCredentialsFile("run-dir", []);

    // File should be within the browser-credentials subdirectory
    expect(path).toContain("browser-credentials");
    expect(existsSync(path)).toBe(true);
  });
});

describe("removeBrowserCredentialsFile", () => {
  it("removes an existing file", async () => {
    const { writeBrowserCredentialsFile, removeBrowserCredentialsFile } = await loadModule();
    const path = writeBrowserCredentialsFile("run-rm", []);

    expect(existsSync(path)).toBe(true);
    removeBrowserCredentialsFile(path);
    expect(existsSync(path)).toBe(false);
  });

  it("does not throw when file does not exist", async () => {
    const { removeBrowserCredentialsFile } = await loadModule();
    expect(() => removeBrowserCredentialsFile("/nonexistent/path.json")).not.toThrow();
  });
});
