import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { FolderOpen } from "lucide-react";
import { useProjectStore } from "@/stores/project-store";

interface ProjectStepProps {
  onNext: (projectId: string) => void;
}

export function ProjectStep({ onNext }: ProjectStepProps) {
  const [name, setName] = useState("");
  const [directoryPath, setDirectoryPath] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { createProject } = useProjectStore();

  const pickDirectory = async () => {
    try {
      // Use Tauri's dialog API for native file picker
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({ directory: true, multiple: false });
      if (selected) setDirectoryPath(selected as string);
    } catch {
      // Fallback: user can type the path manually
    }
  };

  const handleCreate = async () => {
    if (!name.trim() || !directoryPath.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const project = await createProject({
        name: name.trim(),
        directoryPath: directoryPath.trim(),
        description: description.trim() || undefined,
      });
      onNext(project.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project");
      setCreating(false);
    }
  };

  return (
    <div className="flex flex-col">
      <h2 className="text-2xl font-semibold">Your first project</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Link a project directory where Claude Code will run jobs.
      </p>

      <div className="mt-6 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="name">Project name</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Project"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="directory">Directory</Label>
          <div className="flex gap-2">
            <Input
              id="directory"
              value={directoryPath}
              onChange={(e) => setDirectoryPath(e.target.value)}
              placeholder="/Users/you/projects/my-project"
              className="flex-1"
            />
            <Button variant="outline" size="icon" onClick={pickDirectory}>
              <FolderOpen className="size-4" />
            </Button>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="description">
            Description{" "}
            <span className="text-muted-foreground">(optional)</span>
          </Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe your project — this helps generate better job plans."
            rows={2}
          />
        </div>

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}
      </div>

      <Button
        onClick={handleCreate}
        className="mt-6"
        disabled={!name.trim() || !directoryPath.trim() || creating}
      >
        {creating ? "Creating..." : "Create project"}
      </Button>
    </div>
  );
}
