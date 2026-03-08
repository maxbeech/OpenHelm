import { registerHandler } from "../handler.js";
import {
  detectClaudeCode,
  verifyClaudeCode,
} from "../../claude-code/detector.js";
import { getSetting } from "../../db/queries/settings.js";
import type {
  DetectClaudeCodeParams,
  VerifyClaudeCodeParams,
  ClaudeCodeDetectionResult,
} from "@openorchestra/shared";

export function registerClaudeCodeHandlers() {
  /**
   * Auto-detect the Claude Code CLI.
   * Optionally accepts a manual path to verify instead.
   */
  registerHandler("claudeCode.detect", async (params) => {
    const p = params as DetectClaudeCodeParams | undefined;
    return detectClaudeCode(p?.manualPath);
  });

  /**
   * Verify a specific Claude Code binary path.
   */
  registerHandler("claudeCode.verify", async (params) => {
    const p = params as VerifyClaudeCodeParams;
    if (!p?.path) throw new Error("path is required");
    return verifyClaudeCode(p.path);
  });

  /**
   * Get the current Claude Code detection status from settings.
   * Does not re-run detection — just reads stored values.
   */
  registerHandler("claudeCode.getStatus", () => {
    const pathSetting = getSetting("claude_code_path");
    const versionSetting = getSetting("claude_code_version");

    const result: ClaudeCodeDetectionResult = {
      found: pathSetting !== null,
      path: pathSetting?.value ?? null,
      version: versionSetting?.value ?? null,
      meetsMinVersion: pathSetting !== null,
    };

    return result;
  });
}
