import { useState } from "react";
import { Pause, Play, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useSchedulerStatus } from "@/hooks/use-scheduler-status";

export function SchedulerControl() {
  const { status, pause, resume, stopAll, loading } = useSchedulerStatus();
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (loading || !status) return null;

  const isPaused = status.paused;
  const hasActiveWork = status.activeRuns > 0 || status.queuedRuns > 0;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="xs"
            onMouseDown={(e) => e.stopPropagation()}
            className="gap-1.5"
          >
            <span
              className={`inline-block size-2 rounded-full ${
                isPaused ? "bg-amber-500" : "bg-emerald-500"
              }`}
            />
            {isPaused ? "Paused" : "Running"}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          {isPaused ? (
            <DropdownMenuItem onClick={() => void resume()}>
              <Play className="mr-2 size-3.5" />
              Resume scheduling
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={() => void pause()}>
              <Pause className="mr-2 size-3.5" />
              Pause scheduling
            </DropdownMenuItem>
          )}
          {hasActiveWork && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => setConfirmOpen(true)}
              >
                <Square className="mr-2 size-3.5" />
                Stop all tasks
              </DropdownMenuItem>
            </>
          )}
          <DropdownMenuSeparator />
          <div className="px-2 py-1.5 text-xs text-muted-foreground">
            {status.activeRuns} active, {status.queuedRuns} queued
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Stop all tasks?</AlertDialogTitle>
            <AlertDialogDescription>
              This will cancel {status.activeRuns > 0 && `${status.activeRuns} running`}
              {status.activeRuns > 0 && status.queuedRuns > 0 && " and "}
              {status.queuedRuns > 0 && `${status.queuedRuns} queued`}
              {" "}task{(status.activeRuns + status.queuedRuns) !== 1 ? "s" : ""}.
              Running Claude Code processes will be terminated.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void stopAll()}
            >
              Stop all
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
