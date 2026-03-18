/**
 * Sleep Guard — prevents macOS idle sleep while Claude Code jobs are running.
 *
 * Uses `caffeinate -i -w <pid>` which:
 *   -i  prevents idle sleep
 *   -w  ties caffeinate's lifetime to this process (auto-kills on agent exit)
 *
 * No sudo required. Reference-counts active runs so caffeinate is only alive
 * when at least one job is running.
 */

import { spawn, type ChildProcess } from "child_process";

let activeRunCount = 0;
let caffeinateProcess: ChildProcess | null = null;

/** Called when a run transitions to "running". Starts caffeinate if first active run. */
export function onRunStarted(): void {
  activeRunCount++;
  if (activeRunCount === 1) {
    startCaffeinate();
  }
}

/** Called when a run reaches a terminal state. Stops caffeinate when all runs finish. */
export function onRunFinished(): void {
  if (activeRunCount > 0) {
    activeRunCount--;
  }
  if (activeRunCount === 0) {
    stopCaffeinate();
  }
}

/** Force-stop caffeinate immediately (called on agent shutdown). */
export function stopSleepGuard(): void {
  activeRunCount = 0;
  stopCaffeinate();
}

/** Whether caffeinate is currently running. */
export function isSleepGuardActive(): boolean {
  return caffeinateProcess !== null;
}

function startCaffeinate(): void {
  if (caffeinateProcess) return;

  try {
    // -w <pid>: caffeinate exits automatically when this process exits
    // -i: prevent idle sleep (not display sleep)
    caffeinateProcess = spawn("caffeinate", ["-i", "-w", String(process.pid)], {
      stdio: "ignore",
      detached: false,
    });

    caffeinateProcess.on("exit", (code) => {
      console.error(`[sleep-guard] caffeinate exited (code=${code})`);
      caffeinateProcess = null;
    });

    caffeinateProcess.on("error", (err) => {
      console.error("[sleep-guard] caffeinate error:", err);
      caffeinateProcess = null;
    });

    console.error("[sleep-guard] started caffeinate (preventing idle sleep)");
  } catch (err) {
    console.error("[sleep-guard] failed to start caffeinate:", err);
  }
}

function stopCaffeinate(): void {
  if (!caffeinateProcess) return;

  try {
    caffeinateProcess.kill("SIGTERM");
  } catch {
    // Process may have already exited
  }
  caffeinateProcess = null;
  console.error("[sleep-guard] stopped caffeinate (idle sleep allowed)");
}
