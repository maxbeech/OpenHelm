import { useEffect, useState, useCallback } from "react";
import { agentClient } from "./lib/agent-client";
import * as api from "./lib/api";
import { useAppStore } from "./stores/app-store";
import { useProjectStore } from "./stores/project-store";
import { OnboardingWizard } from "./components/onboarding/onboarding-wizard";
import { AppShell } from "./components/layout/app-shell";
import { GoalsScreen } from "./components/goals/goals-screen";
import { JobsScreen } from "./components/jobs/jobs-screen";
import { RunsScreen } from "./components/runs/runs-screen";
import { SettingsScreen } from "./components/settings/settings-screen";
import { TooltipProvider } from "./components/ui/tooltip";
import { NewProjectDialog } from "./components/shared/new-project-dialog";

export default function App() {
  const {
    page,
    activeProjectId,
    onboardingComplete,
    agentReady,
    setActiveProjectId,
    setOnboardingComplete,
    setAgentReady,
  } = useAppStore();
  const { projects, fetchProjects } = useProjectStore();
  const [showNewProject, setShowNewProject] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  // Start agent client and detect readiness
  useEffect(() => {
    const onReady = () => setAgentReady(true);
    window.addEventListener("agent:agent.ready", onReady);

    agentClient.start().catch((err) => {
      console.error("Failed to start agent client:", err);
    });

    return () => window.removeEventListener("agent:agent.ready", onReady);
  }, [setAgentReady]);

  // Once agent is ready, load initial state
  useEffect(() => {
    if (!agentReady) return;
    (async () => {
      await fetchProjects();
      // Check if onboarding is complete by looking at existing projects and settings
      const projectsList = useProjectStore.getState().projects;
      if (projectsList.length > 0) {
        setOnboardingComplete(true);
        // Restore last active project or use the first one
        const saved = await api.getSetting("theme"); // check if settings exist
        setActiveProjectId(projectsList[0].id);
      }
      setInitialLoading(false);
    })();
  }, [agentReady, fetchProjects, setOnboardingComplete, setActiveProjectId]);

  // Sync active project data when project changes
  useEffect(() => {
    if (activeProjectId) {
      // Persist active project for next session
      api.setSetting({ key: "theme", value: activeProjectId }).catch(() => {});
    }
  }, [activeProjectId]);

  const handleOnboardingComplete = useCallback(
    (projectId: string) => {
      fetchProjects().then(() => {
        setActiveProjectId(projectId);
        setOnboardingComplete(true);
      });
    },
    [fetchProjects, setActiveProjectId, setOnboardingComplete],
  );

  const handleNewProject = useCallback(
    (projectId: string) => {
      fetchProjects().then(() => {
        setActiveProjectId(projectId);
        setShowNewProject(false);
      });
    },
    [fetchProjects, setActiveProjectId],
  );

  // Loading state
  if (!agentReady || initialLoading) {
    return (
      <div className="no-select flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
        <h1 className="text-2xl font-bold tracking-tight">
          <span className="text-primary">Open</span>Orchestra
        </h1>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div className="size-2 animate-pulse rounded-full bg-primary" />
          Starting agent...
        </div>
      </div>
    );
  }

  // Onboarding
  if (!onboardingComplete) {
    return (
      <TooltipProvider>
        <OnboardingWizard onComplete={handleOnboardingComplete} />
      </TooltipProvider>
    );
  }

  // Main app
  return (
    <TooltipProvider>
      <AppShell onNewProject={() => setShowNewProject(true)}>
        {page === "goals" && <GoalsScreen />}
        {page === "jobs" && <JobsScreen />}
        {page === "runs" && <RunsScreen />}
        {page === "settings" && <SettingsScreen />}
      </AppShell>

      <NewProjectDialog
        open={showNewProject}
        onOpenChange={setShowNewProject}
        onCreated={handleNewProject}
      />
    </TooltipProvider>
  );
}
