import { useState, useEffect, useCallback } from "react";
import { useAgentEvent } from "./use-agent-event";
import {
  getSchedulerStatus,
  pauseScheduler,
  resumeScheduler,
  stopAllRuns,
} from "@/lib/api";
import type { SchedulerStatus } from "@openhelm/shared";

const POLL_INTERVAL_MS = 5_000;

export function useSchedulerStatus() {
  const [status, setStatus] = useState<SchedulerStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const s = await getSchedulerStatus();
      setStatus(s);
    } catch (err) {
      console.error("[useSchedulerStatus] fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch + polling
  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  // Instant update on scheduler status change events
  useAgentEvent("scheduler.statusChanged", () => {
    void refresh();
  });

  // Also refresh on run status changes (active/queued counts may change)
  useAgentEvent("run.statusChanged", () => {
    void refresh();
  });

  const pause = useCallback(async () => {
    await pauseScheduler();
    await refresh();
  }, [refresh]);

  const resume = useCallback(async () => {
    await resumeScheduler();
    await refresh();
  }, [refresh]);

  const stopAll = useCallback(async () => {
    await stopAllRuns();
    await refresh();
  }, [refresh]);

  return { status, pause, resume, stopAll, loading };
}
