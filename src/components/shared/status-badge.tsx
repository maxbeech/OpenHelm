import type { RunStatus, GoalStatus } from "@openorchestra/shared";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  Ban,
  AlertTriangle,
  Target,
  Pause,
  Archive,
} from "lucide-react";
import { cn } from "@/lib/utils";

const runStatusConfig: Record<
  RunStatus,
  { label: string; icon: React.ElementType; className: string }
> = {
  queued: {
    label: "Queued",
    icon: Clock,
    className: "bg-muted text-muted-foreground",
  },
  running: {
    label: "Running",
    icon: Loader2,
    className: "bg-primary/20 text-primary",
  },
  succeeded: {
    label: "Succeeded",
    icon: CheckCircle2,
    className: "bg-success/20 text-success",
  },
  failed: {
    label: "Failed",
    icon: XCircle,
    className: "bg-destructive/20 text-destructive",
  },
  permanent_failure: {
    label: "Permanent Failure",
    icon: AlertTriangle,
    className: "bg-destructive/20 text-destructive",
  },
  cancelled: {
    label: "Cancelled",
    icon: Ban,
    className: "bg-muted text-muted-foreground",
  },
};

export function RunStatusBadge({ status }: { status: RunStatus }) {
  const config = runStatusConfig[status];
  const Icon = config.icon;
  return (
    <Badge variant="ghost" className={cn("gap-1", config.className)}>
      <Icon
        className={cn("size-3", status === "running" && "animate-spin")}
      />
      {config.label}
    </Badge>
  );
}

const goalStatusConfig: Record<
  GoalStatus,
  { label: string; icon: React.ElementType; className: string }
> = {
  active: {
    label: "Active",
    icon: Target,
    className: "bg-success/20 text-success",
  },
  paused: {
    label: "Paused",
    icon: Pause,
    className: "bg-muted text-muted-foreground",
  },
  archived: {
    label: "Archived",
    icon: Archive,
    className: "bg-muted text-muted-foreground",
  },
};

export function GoalStatusBadge({ status }: { status: GoalStatus }) {
  const config = goalStatusConfig[status];
  const Icon = config.icon;
  return (
    <Badge variant="ghost" className={cn("gap-1", config.className)}>
      <Icon className="size-3" />
      {config.label}
    </Badge>
  );
}
