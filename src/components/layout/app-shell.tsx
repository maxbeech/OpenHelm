import { Sidebar } from "./sidebar";

interface AppShellProps {
  children: React.ReactNode;
  onNewProject?: () => void;
}

export function AppShell({ children, onNewProject }: AppShellProps) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar onNewProject={onNewProject} />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
