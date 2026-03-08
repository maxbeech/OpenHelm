import { useEffect, useRef, useState, useCallback } from "react";
import type { RunLog } from "@openorchestra/shared";
import * as api from "@/lib/api";
import { useAgentEvent } from "./use-agent-event";

interface RunLogEvent {
  runId: string;
  logs: Array<{ stream: "stdout" | "stderr"; text: string; sequence: number }>;
}

/**
 * Manages run logs with a write-through buffer pattern.
 * Incoming log events are buffered in a ref and flushed to state
 * every 100ms, preventing excessive re-renders during fast output.
 */
export function useRunLogs(runId: string | null) {
  const [logs, setLogs] = useState<RunLog[]>([]);
  const [loading, setLoading] = useState(false);
  const bufferRef = useRef<RunLog[]>([]);
  const flushTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load existing logs
  useEffect(() => {
    if (!runId) {
      setLogs([]);
      return;
    }
    setLoading(true);
    api
      .listRunLogs({ runId })
      .then((result) => {
        setLogs(result);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [runId]);

  // Flush buffer every 100ms
  useEffect(() => {
    flushTimerRef.current = setInterval(() => {
      if (bufferRef.current.length > 0) {
        const batch = bufferRef.current;
        bufferRef.current = [];
        setLogs((prev) => [...prev, ...batch]);
      }
    }, 100);
    return () => {
      if (flushTimerRef.current) clearInterval(flushTimerRef.current);
    };
  }, []);

  // Listen for live log events
  const handleLogEvent = useCallback(
    (data: RunLogEvent) => {
      if (data.runId !== runId) return;
      const newLogs: RunLog[] = data.logs.map((l) => ({
        id: `live-${l.sequence}`,
        runId: data.runId,
        sequence: l.sequence,
        stream: l.stream,
        text: l.text,
        timestamp: new Date().toISOString(),
      }));
      bufferRef.current.push(...newLogs);
    },
    [runId],
  );

  useAgentEvent("run.log", handleLogEvent);

  return { logs, loading };
}
