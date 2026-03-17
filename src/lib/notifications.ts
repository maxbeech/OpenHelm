import type { InboxItem, NotificationLevel, RunStatus } from "@openhelm/shared";
import * as api from "./api";

async function getNotificationLevel(): Promise<NotificationLevel> {
  try {
    const s = await api.getSetting("notification_level");
    if (
      s?.value === "never" ||
      s?.value === "on_finish" ||
      s?.value === "alerts_only"
    ) {
      return s.value;
    }
  } catch {
    // fall through to default
  }
  return "alerts_only";
}

export async function notifyInboxItem(item: InboxItem): Promise<void> {
  const level = await getNotificationLevel();
  if (level === "never") return;
  // Both "on_finish" and "alerts_only" send inbox alert notifications
  try {
    const { sendNotification } = await import(
      "@tauri-apps/plugin-notification"
    );
    const title =
      item.type === "permanent_failure"
        ? "Run Failed Permanently"
        : "Input Required";
    sendNotification({ title, body: item.title });
  } catch {
    // Tauri-only API — silently ignore in browser dev mode
  }
}

export async function notifyRunCompleted(
  status: RunStatus,
  jobName: string,
  summary?: string | null,
): Promise<void> {
  const level = await getNotificationLevel();
  if (level !== "on_finish") return;
  try {
    const { sendNotification } = await import(
      "@tauri-apps/plugin-notification"
    );
    const title =
      status === "succeeded"
        ? `"${jobName}" succeeded`
        : `"${jobName}" finished (${status})`;
    sendNotification({ title, body: summary ?? "" });
  } catch {
    // Tauri-only API — silently ignore in browser dev mode
  }
}

/**
 * Request OS notification permission if not already granted.
 * Persists the fact that permission was requested to avoid repeated prompts.
 */
export async function ensureNotificationPermission(): Promise<void> {
  try {
    const notifRequested = await api.getSetting(
      "notification_permission_requested",
    );
    if (notifRequested?.value) return;
    const { isPermissionGranted, requestPermission } = await import(
      "@tauri-apps/plugin-notification"
    );
    const granted = await isPermissionGranted();
    if (!granted) await requestPermission();
    await api.setSetting({
      key: "notification_permission_requested",
      value: "true",
    });
  } catch {
    // Tauri-only API — silently ignore in browser dev mode
  }
}
