import { execFile } from "child_process";
import { existsSync } from "fs";
import { promisify } from "util";
import type { ClaudeCodeDetectionResult } from "@openorchestra/shared";
import { getSetting, setSetting } from "../db/queries/settings.js";

const execFileAsync = promisify(execFile);

/** Minimum supported Claude Code CLI version */
export const MIN_CLI_VERSION = "2.0.0";

/** Locations to check for the Claude Code binary, in priority order */
const SEARCH_LOCATIONS = [
  // Homebrew (Apple Silicon)
  "/opt/homebrew/bin/claude",
  // Homebrew (Intel)
  "/usr/local/bin/claude",
  // Common npm global install (nvm)
  `${process.env.HOME}/.nvm/versions/node/*/bin/claude`,
  // Common npm global install (system)
  "/usr/local/lib/node_modules/.bin/claude",
  // npm global bin
  `${process.env.HOME}/.npm-global/bin/claude`,
];

/**
 * Compare two semver version strings.
 * Returns: -1 if a < b, 0 if a === b, 1 if a > b
 */
export function compareSemver(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    const va = pa[i] ?? 0;
    const vb = pb[i] ?? 0;
    if (va < vb) return -1;
    if (va > vb) return 1;
  }
  return 0;
}

/**
 * Try to find the Claude Code binary using `which`.
 * Returns the path if found, null otherwise.
 */
async function findViaWhich(): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync("which", ["claude"], {
      timeout: 5000,
    });
    const path = stdout.trim();
    return path || null;
  } catch {
    return null;
  }
}

/**
 * Try to find the Claude Code binary in common install locations.
 * Returns the first existing path, or null.
 */
function findInLocations(): string | null {
  for (const loc of SEARCH_LOCATIONS) {
    // Handle glob patterns (e.g. nvm paths)
    if (loc.includes("*")) continue;
    if (existsSync(loc)) return loc;
  }
  return null;
}

/**
 * Get the version string from a Claude Code binary.
 * Returns the semver string (e.g. "2.1.71") or null on failure.
 */
export async function getVersion(binaryPath: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync(binaryPath, ["--version"], {
      timeout: 10000,
    });
    // Output format: "2.1.71 (Claude Code)" or just "2.1.71"
    const match = stdout.trim().match(/^(\d+\.\d+\.\d+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

/**
 * Verify a specific Claude Code binary path.
 * Checks existence, executability, and version.
 */
export async function verifyClaudeCode(
  path: string,
): Promise<ClaudeCodeDetectionResult> {
  if (!existsSync(path)) {
    return {
      found: false,
      path,
      version: null,
      meetsMinVersion: false,
      error: `Binary not found at: ${path}`,
    };
  }

  const version = await getVersion(path);
  if (!version) {
    return {
      found: true,
      path,
      version: null,
      meetsMinVersion: false,
      error: "Could not determine version. Is this the Claude Code CLI?",
    };
  }

  const meetsMinVersion = compareSemver(version, MIN_CLI_VERSION) >= 0;

  return {
    found: true,
    path,
    version,
    meetsMinVersion,
    error: meetsMinVersion
      ? undefined
      : `Version ${version} is below minimum ${MIN_CLI_VERSION}. Please upgrade.`,
  };
}

/**
 * Auto-detect the Claude Code CLI binary.
 * Checks stored path first, then PATH, then common locations.
 * If manualPath is provided, verifies that path instead.
 */
export async function detectClaudeCode(
  manualPath?: string,
): Promise<ClaudeCodeDetectionResult> {
  // If a manual path is provided, verify it directly
  if (manualPath) {
    const result = await verifyClaudeCode(manualPath);
    if (result.found && result.meetsMinVersion) {
      persistDetection(result);
    }
    return result;
  }

  // Check stored path first
  const storedPath = getSetting("claude_code_path");
  if (storedPath) {
    const result = await verifyClaudeCode(storedPath.value);
    if (result.found && result.meetsMinVersion) {
      persistDetection(result);
      return result;
    }
    // Stored path is stale — fall through to auto-detection
    console.error(
      `[detector] stored path ${storedPath.value} is no longer valid`,
    );
  }

  // Try `which claude` first (respects user's PATH)
  const whichPath = await findViaWhich();
  if (whichPath) {
    const result = await verifyClaudeCode(whichPath);
    if (result.found && result.meetsMinVersion) {
      persistDetection(result);
      return result;
    }
  }

  // Try common install locations
  const locPath = findInLocations();
  if (locPath) {
    const result = await verifyClaudeCode(locPath);
    if (result.found && result.meetsMinVersion) {
      persistDetection(result);
      return result;
    }
  }

  return {
    found: false,
    path: null,
    version: null,
    meetsMinVersion: false,
    error:
      "Claude Code CLI not found. Install it with: npm install -g @anthropic-ai/claude-code",
  };
}

/** Persist detection results to the settings table */
function persistDetection(result: ClaudeCodeDetectionResult): void {
  if (result.path) {
    setSetting("claude_code_path", result.path);
  }
  if (result.version) {
    setSetting("claude_code_version", result.version);
  }
}
