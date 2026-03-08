import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";
import { useAppStore } from "@/stores/app-store";

interface ConfirmationStepProps {
  jobCount: number;
  onClose: () => void;
}

export function ConfirmationStep({ jobCount, onClose }: ConfirmationStepProps) {
  const { setPage } = useAppStore();

  return (
    <div className="flex flex-col items-center py-8 text-center">
      <div className="rounded-full bg-success/20 p-3">
        <CheckCircle2 className="size-8 text-success" />
      </div>
      <h3 className="mt-4 text-lg font-semibold">Your plan is running.</h3>
      <p className="mt-2 text-sm text-muted-foreground">
        {jobCount} {jobCount === 1 ? "job has" : "jobs have"} been created. The
        first job has started. You can track progress in the Runs screen.
      </p>
      <div className="mt-6 flex gap-3">
        <Button
          variant="outline"
          onClick={() => {
            onClose();
            setPage("runs");
          }}
        >
          View runs
        </Button>
        <Button onClick={onClose}>Close</Button>
      </div>
    </div>
  );
}
