import { create } from "zustand";
import type { Job } from "@openorchestra/shared";
import * as api from "@/lib/api";

interface JobState {
  jobs: Job[];
  loading: boolean;
  error: string | null;

  fetchJobs: (projectId: string) => Promise<void>;
  toggleEnabled: (id: string, isEnabled: boolean) => Promise<void>;
  deleteJob: (id: string) => Promise<void>;
  updateJobInStore: (job: Job) => void;
}

export const useJobStore = create<JobState>((set) => ({
  jobs: [],
  loading: false,
  error: null,

  fetchJobs: async (projectId) => {
    set({ loading: true, error: null });
    try {
      const jobs = await api.listJobs({ projectId });
      set({ jobs, loading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : String(err),
        loading: false,
      });
    }
  },

  toggleEnabled: async (id, isEnabled) => {
    const updated = await api.updateJob({ id, isEnabled });
    set((s) => ({
      jobs: s.jobs.map((j) => (j.id === id ? updated : j)),
    }));
  },

  deleteJob: async (id) => {
    await api.deleteJob(id);
    set((s) => ({ jobs: s.jobs.filter((j) => j.id !== id) }));
  },

  updateJobInStore: (job) => {
    set((s) => ({
      jobs: s.jobs.map((j) => (j.id === job.id ? job : j)),
    }));
  },
}));
