import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Mail } from "lucide-react";
import * as api from "@/lib/api";

interface NewsletterStepProps {
  onNext: () => void;
}

export function NewsletterStep({ onNext }: NewsletterStepProps) {
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

  async function handleSubscribe() {
    if (!isValidEmail(email)) {
      setError("Please enter a valid email address.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.setSetting({ key: "newsletter_email", value: email.trim() });
      onNext();
    } catch {
      setError("Failed to save — please try again.");
    } finally {
      setSaving(false);
    }
  }

  function handleSkip() {
    onNext();
  }

  return (
    <div className="flex flex-col items-center text-center">
      <div className="rounded-full bg-primary/10 p-3">
        <Mail className="size-10 text-primary" />
      </div>
      <h2 className="mt-4 text-2xl font-semibold">Stay in the loop</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Get occasional updates on new features and releases. No spam — unsubscribe any time.
      </p>
      <div className="mt-6 w-full max-w-sm space-y-2">
        <Input
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSubscribe();
          }}
          disabled={saving}
          autoFocus
        />
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
      <Button
        onClick={handleSubscribe}
        size="lg"
        className="mt-4 w-full max-w-sm"
        disabled={saving || email.trim() === ""}
      >
        {saving ? "Saving…" : "Subscribe"}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="mt-2 text-muted-foreground"
        onClick={handleSkip}
        disabled={saving}
      >
        Skip for now
      </Button>
    </div>
  );
}
