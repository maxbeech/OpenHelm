import { useCallback } from "react";
import {
  Target,
  Briefcase,
  Play,
  Settings,
  ChevronDown,
  Plus,
} from "lucide-react";
import { useAppStore, type Page } from "@/stores/app-store";
import { useProjectStore } from "@/stores/project-store";
import { useGoalStore } from "@/stores/goal-store";
import { useJobStore } from "@/stores/job-store";
import { useRunStore } from "@/stores/run-store";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface NavItem {
  id: Page;
  label: string;
  icon: React.ElementType;
  count?: number;
  pulse?: boolean;
}

export function Sidebar({
  onNewProject,
}: {
  onNewProject?: () => void;
}) {
  const { page, setPage, activeProjectId, setActiveProjectId } = useAppStore();
  const { projects } = useProjectStore();
  const { goals } = useGoalStore();
  const { jobs } = useJobStore();
  const { runs } = useRunStore();

  const activeProject = projects.find((p) => p.id === activeProjectId);
  const activeGoalCount = goals.filter((g) => g.status === "active").length;
  const enabledJobCount = jobs.filter((j) => j.isEnabled).length;
  const runningCount = runs.filter((r) => r.status === "running").length;

  const navItems: NavItem[] = [
    { id: "goals", label: "Goals", icon: Target, count: activeGoalCount },
    { id: "jobs", label: "Jobs", icon: Briefcase, count: enabledJobCount },
    {
      id: "runs",
      label: "Runs",
      icon: Play,
      count: runningCount,
      pulse: runningCount > 0,
    },
  ];

  const handleProjectSwitch = useCallback(
    (id: string) => {
      setActiveProjectId(id);
    },
    [setActiveProjectId],
  );

  return (
    <aside className="no-select flex h-full w-56 flex-col border-r border-sidebar-border bg-sidebar">
      {/* Project Selector */}
      <div className="border-b border-sidebar-border p-3">
        <DropdownMenu>
          <DropdownMenuTrigger className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-sidebar-accent">
            <div className="flex size-6 items-center justify-center rounded bg-primary/20 text-xs font-bold text-primary">
              {activeProject?.name?.[0]?.toUpperCase() ?? "?"}
            </div>
            <span className="flex-1 truncate text-left text-sidebar-foreground">
              {activeProject?.name ?? "Select project"}
            </span>
            <ChevronDown className="size-3.5 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-52">
            {projects.map((p) => (
              <DropdownMenuItem
                key={p.id}
                onClick={() => handleProjectSwitch(p.id)}
                className={cn(
                  p.id === activeProjectId && "bg-accent",
                )}
              >
                <div className="flex size-5 items-center justify-center rounded bg-primary/20 text-xs font-bold text-primary">
                  {p.name[0]?.toUpperCase()}
                </div>
                <span className="truncate">{p.name}</span>
              </DropdownMenuItem>
            ))}
            {projects.length > 0 && <DropdownMenuSeparator />}
            <DropdownMenuItem onClick={onNewProject}>
              <Plus className="size-4" />
              New project
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2">
        <ul className="space-y-0.5">
          {navItems.map((item) => (
            <li key={item.id}>
              <button
                onClick={() => setPage(item.id)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
                  page === item.id
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                )}
              >
                <item.icon className="size-4" />
                <span className="flex-1">{item.label}</span>
                {item.count !== undefined && item.count > 0 && (
                  <span
                    className={cn(
                      "min-w-5 rounded-full px-1.5 py-0.5 text-center text-xs font-medium",
                      item.pulse
                        ? "animate-pulse-dot bg-primary/20 text-primary"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {item.count}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* Settings at bottom */}
      <div className="border-t border-sidebar-border p-2">
        <button
          onClick={() => setPage("settings")}
          className={cn(
            "flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
            page === "settings"
              ? "bg-sidebar-accent text-sidebar-accent-foreground"
              : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
          )}
        >
          <Settings className="size-4" />
          <span>Settings</span>
        </button>
      </div>
    </aside>
  );
}
