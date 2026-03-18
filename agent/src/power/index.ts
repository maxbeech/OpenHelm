/**
 * Power management — wake scheduling and sleep prevention.
 *
 * Opt-in via `wake_schedule_enabled` setting. When enabled:
 *   - Schedules macOS wake events before upcoming jobs (via pmset)
 *   - Prevents idle sleep while jobs are running (via caffeinate)
 */

import { getSetting } from "../db/queries/settings.js";
import {
  syncWakeEvents,
  cancelAllWakes,
  scheduleWake,
  getScheduledWakeCount,
} from "./wake-scheduler.js";
import {
  stopSleepGuard,
  isSleepGuardActive,
  onRunStarted,
  onRunFinished,
} from "./sleep-guard.js";

// Re-export hooks so callers can import from a single location
export { onRunStarted, onRunFinished, scheduleWake };

/** Cache to avoid hitting the DB on every tick. Invalidated every 60s. */
let cachedEnabled: boolean | null = null;
let cacheExpiry = 0;

/** Whether the wake scheduling feature is currently enabled. */
export function isPowerManagementEnabled(): boolean {
  const now = Date.now();
  if (cachedEnabled !== null && now < cacheExpiry) {
    return cachedEnabled;
  }
  const setting = getSetting("wake_schedule_enabled");
  cachedEnabled = setting?.value === "true";
  cacheExpiry = now + 60_000;
  return cachedEnabled;
}

/** Invalidate the cached enabled state (call after setting changes). */
export function invalidatePowerCache(): void {
  cachedEnabled = null;
  cacheExpiry = 0;
}

/**
 * Initialize power management on agent startup.
 * Non-fatal — a failure here should never prevent jobs from running.
 */
export async function initPowerManagement(): Promise<void> {
  if (!isPowerManagementEnabled()) {
    console.error("[power] wake scheduling disabled, skipping init");
    return;
  }

  console.error("[power] wake scheduling enabled, syncing wake events...");
  try {
    await syncWakeEvents();
  } catch (err) {
    console.error("[power] wake sync failed (non-fatal):", err);
  }
}

/**
 * Tear down power management on agent shutdown.
 * Cancels all pending wake events and stops caffeinate.
 */
export async function shutdownPowerManagement(): Promise<void> {
  try {
    await cancelAllWakes();
  } catch (err) {
    console.error("[power] cancel all wakes on shutdown failed:", err);
  }
  stopSleepGuard();
}

/** Status snapshot for the power.status IPC handler. */
export function getPowerStatus(): {
  enabled: boolean;
  scheduledWakes: number;
  sleepGuardActive: boolean;
} {
  return {
    enabled: isPowerManagementEnabled(),
    scheduledWakes: getScheduledWakeCount(),
    sleepGuardActive: isSleepGuardActive(),
  };
}

/** Re-export sync/cancel for use in the settings handler. */
export { syncWakeEvents, cancelAllWakes };
