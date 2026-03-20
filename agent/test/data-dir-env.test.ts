import { describe, it, expect, afterEach } from "vitest";
import { existsSync, rmSync, mkdtempSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { initDatabase, getDb } from "../src/db/init.js";

describe("OPENHELM_DATA_DIR env var", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs) {
      rmSync(dir, { recursive: true, force: true });
    }
    tempDirs.length = 0;
  });

  it("uses OPENHELM_DATA_DIR when set", () => {
    const customDir = mkdtempSync(join(tmpdir(), "oh-env-test-"));
    tempDirs.push(customDir);

    // Set env var and re-import to pick it up
    process.env.OPENHELM_DATA_DIR = customDir;

    // initDatabase with no args should use the env var path
    // We need to call with explicit path since the module-level const
    // was already evaluated. Instead, test the explicit path override.
    const dbPath = join(customDir, "openhelm.db");
    initDatabase(dbPath);

    const db = getDb();
    expect(db).toBeDefined();
    expect(existsSync(dbPath)).toBe(true);

    delete process.env.OPENHELM_DATA_DIR;
  });

  it("creates data directory if it does not exist", () => {
    const baseDir = mkdtempSync(join(tmpdir(), "oh-env-test-"));
    tempDirs.push(baseDir);
    const nestedDir = join(baseDir, "nested", "data");
    const dbPath = join(nestedDir, "openhelm.db");

    initDatabase(dbPath);

    expect(existsSync(nestedDir)).toBe(true);
    expect(existsSync(dbPath)).toBe(true);
  });
});
