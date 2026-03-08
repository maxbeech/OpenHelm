import { create } from "zustand";

export type Page = "goals" | "jobs" | "runs" | "settings";

export interface NavigationFilter {
  goalId?: string;
  jobId?: string;
  runId?: string;
}

interface AppState {
  page: Page;
  filter: NavigationFilter;
  activeProjectId: string | null;
  onboardingComplete: boolean;
  agentReady: boolean;

  setPage: (page: Page, filter?: NavigationFilter) => void;
  setActiveProjectId: (id: string | null) => void;
  setOnboardingComplete: (complete: boolean) => void;
  setAgentReady: (ready: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  page: "goals",
  filter: {},
  activeProjectId: null,
  onboardingComplete: false,
  agentReady: false,

  setPage: (page, filter = {}) => set({ page, filter }),
  setActiveProjectId: (id) => set({ activeProjectId: id }),
  setOnboardingComplete: (complete) => set({ onboardingComplete: complete }),
  setAgentReady: (ready) => set({ agentReady: ready }),
}));
