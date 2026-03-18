import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { initDatabase } from "../src/db/init.js";

/**
 * Create a fresh test database in a temporary directory.
 * Returns a cleanup function that removes the temp dir.
 */
export function setupTestDb(): () => void {
  const tempDir = mkdtempSync(join(tmpdir(), "oh-test-"));
  const dbPath = join(tempDir, "test.db");

  initDatabase(dbPath);

  return () => {
    rmSync(tempDir, { recursive: true, force: true });
  };
}
