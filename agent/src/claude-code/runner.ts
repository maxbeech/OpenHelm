/**
 * ClaudeCodeRunner — the ONLY place in the entire codebase that spawns
 * the `claude` process.
 *
 * This is a hard architectural rule. All Claude Code CLI invocations
 * must go through this single module. When Anthropic updates the CLI,
 * this is the only file that changes.
 *
 * The runner:
 * - Spawns Claude Code with -p (print/headless) mode
 * - Uses --output-format stream-json for structured streaming
 * - Streams output to a callback in real time
 * - Manages timeouts with SIGTERM then SIGKILL
 * - Supports cancellation via AbortSignal
 */

import { spawn, type ChildProcess } from "child_process";
import { createInterface } from "readline";
import type { ClaudeCodeRunResult } from "@openorchestra/shared";
import { InteractiveDetector } from "./interactive-detector.js";
import { parseStreamLine } from "./stream-parser.js";

export interface RunnerConfig {
  /** Path to the Claude Code binary */
  binaryPath: string;
  /** Working directory for the Claude Code process */
  workingDirectory: string;
  /** The prompt to send to Claude Code */
  prompt: string;
  /** Timeout in milliseconds (default: 30 minutes) */
  timeoutMs?: number;
  /** Permission mode for Claude Code (default: "auto") */
  permissionMode?: string;
  /** Maximum USD budget for the run */
  maxBudgetUsd?: number;
  /** Called for each log chunk (stream, text) */
  onLogChunk: (stream: "stdout" | "stderr", text: string) => void;
  /** Called when interactive input is detected */
  onInteractiveDetected?: (reason: string) => void;
}

const DEFAULT_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const SIGKILL_DELAY_MS = 5000; // 5 seconds after SIGTERM

/**
 * Run a Claude Code job. This is the sole entry point for executing
 * Claude Code in the entire codebase.
 *
 * @param config - Run configuration
 * @param signal - Optional AbortSignal for cancellation
 * @returns Promise resolving to the run result
 */
export function runClaudeCode(
  config: RunnerConfig,
  signal?: AbortSignal,
): Promise<ClaudeCodeRunResult> {
  return new Promise((resolve) => {
    const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    // Build command arguments
    const args = buildArgs(config);

    console.error(
      `[runner] spawning: ${config.binaryPath} ${args.join(" ")}`,
    );
    console.error(`[runner] cwd: ${config.workingDirectory}`);

    // Spawn the process — inherit the parent's full environment
    const child = spawn(config.binaryPath, args, {
      cwd: config.workingDirectory,
      env: process.env,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let timedOut = false;
    let killed = false;
    let resolved = false;

    const cleanup = () => {
      clearTimeout(timeoutTimer);
      interactiveDetector.stop();
      if (abortHandler) signal?.removeEventListener("abort", abortHandler);
    };

    const finish = (exitCode: number | null) => {
      if (resolved) return;
      resolved = true;
      cleanup();
      resolve({ exitCode, timedOut, killed });
    };

    // -- Interactive Detector --
    const interactiveDetector = new InteractiveDetector({
      silenceTimeoutMs: 60_000,
      onDetected: (reason) => {
        console.error(`[runner] interactive detected: ${reason}`);
        config.onInteractiveDetected?.(reason);
      },
    });
    interactiveDetector.start();

    // -- stdout streaming (stream-json lines) --
    const stdoutRl = createInterface({ input: child.stdout! });
    stdoutRl.on("line", (line) => {
      interactiveDetector.processLine(line);
      const parsed = parseStreamLine(line);
      if (parsed) {
        config.onLogChunk("stdout", parsed.text);
      }
    });

    // -- stderr streaming (raw lines) --
    const stderrRl = createInterface({ input: child.stderr! });
    stderrRl.on("line", (line) => {
      interactiveDetector.processLine(line);
      config.onLogChunk("stderr", line);
    });

    // -- Close stdin immediately (no interactive input) --
    child.stdin?.end();

    // -- Timeout --
    const timeoutTimer = setTimeout(() => {
      timedOut = true;
      console.error(`[runner] timeout after ${timeoutMs}ms, sending SIGTERM`);
      killProcess(child);
    }, timeoutMs);

    // -- Cancellation via AbortSignal --
    let abortHandler: (() => void) | null = null;
    if (signal) {
      abortHandler = () => {
        killed = true;
        console.error("[runner] run cancelled via AbortSignal");
        killProcess(child);
      };
      signal.addEventListener("abort", abortHandler, { once: true });
    }

    // -- Process exit --
    child.on("close", (code) => {
      console.error(`[runner] process exited with code ${code}`);
      finish(code);
    });

    child.on("error", (err) => {
      console.error(`[runner] process error: ${err.message}`);
      config.onLogChunk("stderr", `Process error: ${err.message}`);
      finish(null);
    });
  });
}

/** Build the CLI arguments for a Claude Code invocation */
function buildArgs(config: RunnerConfig): string[] {
  const args: string[] = [
    "--print",
    "--output-format",
    "stream-json",
  ];

  // Permission mode (default: auto — allows Claude Code to run without prompts)
  const permissionMode = config.permissionMode ?? "auto";
  args.push("--permission-mode", permissionMode);

  // Budget limit
  if (config.maxBudgetUsd !== undefined) {
    args.push("--max-budget-usd", String(config.maxBudgetUsd));
  }

  // The prompt itself (positional argument)
  args.push(config.prompt);

  return args;
}

/**
 * Kill a child process gracefully: SIGTERM first, then SIGKILL after delay.
 */
function killProcess(child: ChildProcess): void {
  if (child.killed) return;

  child.kill("SIGTERM");

  setTimeout(() => {
    if (!child.killed) {
      console.error("[runner] process did not exit after SIGTERM, sending SIGKILL");
      child.kill("SIGKILL");
    }
  }, SIGKILL_DELAY_MS);
}
