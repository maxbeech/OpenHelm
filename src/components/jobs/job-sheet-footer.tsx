import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface JobSheetFooterProps {
  hasClarification: boolean;
  assessing: boolean;
  creating: boolean;
  isValid: boolean;
  onSubmit: () => void;
  onCreateAnyway: () => void;
}

export function JobSheetFooter({
  hasClarification,
  assessing,
  creating,
  isValid,
  onSubmit,
  onCreateAnyway,
}: JobSheetFooterProps) {
  const spinnerLabel = assessing ? "Checking prompt..." : "Creating...";

  if (hasClarification) {
    return (
      <div className="flex gap-2 border-t border-border p-4">
        <Button
          variant="ghost"
          className="flex-1"
          onClick={onCreateAnyway}
          disabled={creating}
        >
          Create anyway
        </Button>
        <Button className="flex-1" onClick={onCreateAnyway} disabled={creating}>
          {creating ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Creating...
            </>
          ) : (
            "Create job"
          )}
        </Button>
      </div>
    );
  }

  return (
    <div className="border-t border-border p-4">
      <Button
        onClick={onSubmit}
        disabled={!isValid || assessing || creating}
        className="w-full"
      >
        {assessing || creating ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            {spinnerLabel}
          </>
        ) : (
          "Create job"
        )}
      </Button>
    </div>
  );
}
