import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";

export function CompleteStep({ onComplete }: { onComplete: () => void }) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="rounded-full bg-success/20 p-3">
        <CheckCircle2 className="size-10 text-success" />
      </div>
      <h2 className="mt-4 text-2xl font-semibold">You're all set.</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Everything is configured. Create your first goal to get started.
      </p>
      <Button onClick={onComplete} size="lg" className="mt-8">
        Create your first goal
      </Button>
    </div>
  );
}
