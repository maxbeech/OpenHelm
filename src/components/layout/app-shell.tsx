import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sidebar } from "./sidebar";
import { ChatPanel } from "@/components/chat/chat-panel";
import { useChatStore } from "@/stores/chat-store";
import { useAppStore } from "@/stores/app-store";
import { getCurrentWindow } from "@tauri-apps/api/window";

interface AppShellProps {
  children: React.ReactNode;
  rightPanel?: React.ReactNode;
  onNewProject?: () => void;
  onEditProject?: (projectId: string) => void;
  onNewJobForGoal: (goalId: string, initialName: string) => void;
}

export function AppShell({
  children,
  rightPanel,
  onNewProject,
  onEditProject,
  onNewJobForGoal,
}: AppShellProps) {
  const { panelOpen, togglePanel } = useChatStore();
  const { activeProjectId } = useAppStore();

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar onNewProject={onNewProject} onEditProject={onEditProject} onNewJobForGoal={onNewJobForGoal} />
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header strip — h-12 matches sidebar logo row; drag region + chat toggle */}
        <div
          data-tauri-drag-region
          onMouseDown={() => { getCurrentWindow().startDragging(); }}
          className="flex h-12 shrink-0 items-center justify-end border-b border-border px-3"
        >
          {!panelOpen && (
            <Button
              variant="outline"
              size="xs"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={togglePanel}
              className="gap-1.5"
              title="Open chat"
            >
              <MessageSquare className="size-3" />
              Chat
            </Button>
          )}
        </div>
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
      {rightPanel && (
        <div className="flex h-full w-[440px] shrink-0 flex-col border-l border-border bg-card">
          {rightPanel}
        </div>
      )}
      {activeProjectId && <ChatPanel projectId={activeProjectId} />}
    </div>
  );
}
