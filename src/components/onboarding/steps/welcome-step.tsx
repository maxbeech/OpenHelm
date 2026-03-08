import { Button } from "@/components/ui/button";

export function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <div className="flex flex-col items-center text-center">
      <h1 className="text-4xl font-bold tracking-tight">
        <span className="text-primary">Open</span>Orchestra
      </h1>
      <p className="mt-4 text-lg text-muted-foreground">
        Turn high-level goals into scheduled, self-correcting Claude Code jobs.
      </p>
      <Button onClick={onNext} size="lg" className="mt-8">
        Let's get started
      </Button>
    </div>
  );
}
