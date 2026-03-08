import { describe, it, expect, beforeEach } from "vitest";
import { useAppStore } from "./app-store";

describe("AppStore", () => {
  beforeEach(() => {
    useAppStore.setState({
      page: "goals",
      filter: {},
      activeProjectId: null,
      onboardingComplete: false,
      agentReady: false,
    });
  });

  it("sets page and filter", () => {
    useAppStore.getState().setPage("jobs", { goalId: "g1" });
    const state = useAppStore.getState();
    expect(state.page).toBe("jobs");
    expect(state.filter.goalId).toBe("g1");
  });

  it("clears filter when setting page without filter", () => {
    useAppStore.getState().setPage("jobs", { goalId: "g1" });
    useAppStore.getState().setPage("runs");
    expect(useAppStore.getState().filter).toEqual({});
  });

  it("sets active project ID", () => {
    useAppStore.getState().setActiveProjectId("p1");
    expect(useAppStore.getState().activeProjectId).toBe("p1");
  });

  it("sets onboarding complete", () => {
    useAppStore.getState().setOnboardingComplete(true);
    expect(useAppStore.getState().onboardingComplete).toBe(true);
  });

  it("sets agent ready", () => {
    useAppStore.getState().setAgentReady(true);
    expect(useAppStore.getState().agentReady).toBe(true);
  });

  it("defaults to goals page", () => {
    expect(useAppStore.getState().page).toBe("goals");
  });
});
