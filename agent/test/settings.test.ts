import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { setupTestDb } from "./helpers.js";
import {
  getSetting,
  getAllSettings,
  setSetting,
  deleteSetting,
} from "../src/db/queries/settings.js";
import type { SettingKey } from "@openhelm/shared";

let cleanup: () => void;

beforeAll(() => {
  cleanup = setupTestDb();
});

afterAll(() => {
  cleanup();
});

describe("settings queries", () => {
  it("should return null for a non-existent setting", () => {
    const result = getSetting("claude_code_path" as SettingKey);
    expect(result).toBeNull();
  });

  it("should set and get a setting", () => {
    const key: SettingKey = "claude_code_path";
    const result = setSetting(key, "/usr/bin/claude");
    expect(result.key).toBe(key);
    expect(result.value).toBe("/usr/bin/claude");
    expect(result.updatedAt).toBeDefined();

    const fetched = getSetting(key);
    expect(fetched).not.toBeNull();
    expect(fetched!.value).toBe("/usr/bin/claude");
  });

  it("should update an existing setting (upsert)", () => {
    const key: SettingKey = "claude_code_path";
    setSetting(key, "/old/path");
    const updated = setSetting(key, "/new/path");
    expect(updated.value).toBe("/new/path");

    const fetched = getSetting(key);
    expect(fetched!.value).toBe("/new/path");
  });

  it("should list all settings", () => {
    setSetting("theme" as SettingKey, "dark");
    const all = getAllSettings();
    expect(all.length).toBeGreaterThanOrEqual(2);
    const keys = all.map((s) => s.key);
    expect(keys).toContain("claude_code_path");
    expect(keys).toContain("theme");
  });

  it("should delete a setting", () => {
    setSetting("max_concurrent_runs" as SettingKey, "3");
    expect(deleteSetting("max_concurrent_runs" as SettingKey)).toBe(true);
    expect(getSetting("max_concurrent_runs" as SettingKey)).toBeNull();
  });

  it("should return false when deleting non-existent setting", () => {
    expect(deleteSetting("default_timeout_minutes" as SettingKey)).toBe(false);
  });

  it("should store and retrieve newsletter_email", () => {
    const key: SettingKey = "newsletter_email";
    const email = "user@example.com";
    const result = setSetting(key, email);
    expect(result.key).toBe(key);
    expect(result.value).toBe(email);

    const fetched = getSetting(key);
    expect(fetched).not.toBeNull();
    expect(fetched!.value).toBe(email);
  });

  it("should update newsletter_email via upsert", () => {
    const key: SettingKey = "newsletter_email";
    setSetting(key, "old@example.com");
    setSetting(key, "new@example.com");
    expect(getSetting(key)!.value).toBe("new@example.com");
  });

  it("should delete newsletter_email", () => {
    const key: SettingKey = "newsletter_email";
    setSetting(key, "todelete@example.com");
    expect(deleteSetting(key)).toBe(true);
    expect(getSetting(key)).toBeNull();
  });
});
