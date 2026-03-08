import { create } from "zustand";
import type { Run, RunStatus } from "@openorchestra/shared";
import * as api from "@/lib/api";

interface RunState {
  runs: Run[];
  loading: boolean;
  error: string | null;

  fetchRuns: (projectId: string) => Promise<void>;
  fetchRunsByJob: (jobId: string) => Promise<Run[]>;
  triggerRun: (jobId: string) => Promise<Run>;
  cancelRun: (runId: string) => Promise<void>;
  updateRunStatus: (runId: string, status: RunStatus) => void;
  updateRunInStore: (run: Partial<Run> & { id: string }) => void;
}

export const useRunStore = create<RunState>((set) => ({
  runs: [],
  loading: false,
  error: null,

  fetchRuns: async (projectId) => {
    set({ loading: true, error: null });
    try {
      const runs = await api.listRuns({ projectId, limit: 100 });
      set({ runs, loading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : String(err),
        loading: false,
      });
    }
  },

  fetchRunsByJob: async (jobId) => {
    return api.listRuns({ jobId, limit: 20 });
  },

  triggerRun: async (jobId) => {
    const run = await api.triggerRun({ jobId });
    set((s) => ({ runs: [run, ...s.runs] }));
    return run;
  },

  cancelRun: async (runId) => {
    await api.cancelRun({ runId });
    set((s) => ({
      runs: s.runs.map((r) =>
        r.id === runId ? { ...r, status: "cancelled" as RunStatus } : r,
      ),
    }));
  },

  updateRunStatus: (runId, status) => {
    set((s) => ({
      runs: s.runs.map((r) => (r.id === runId ? { ...r, status } : r)),
    }));
  },

  updateRunInStore: (partial) => {
    set((s) => ({
      runs: s.runs.map((r) =>
        r.id === partial.id ? { ...r, ...partial } : r,
      ),
    }));
  },
}));
