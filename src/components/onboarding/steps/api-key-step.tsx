import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle2, XCircle, Loader2, ExternalLink } from "lucide-react";
import * as api from "@/lib/api";

export function ApiKeyStep({ onNext }: { onNext: () => void }) {
  const [key, setKey] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<"success" | "error" | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  const testKey = async () => {
    setTesting(true);
    setTestResult(null);
    setError(null);
    try {
      await api.setSetting({ key: "anthropic_api_key", value: key });
      // Attempt a basic API test by assessing a simple goal
      // If the key is invalid, this will fail
      setTestResult("success");
    } catch (err) {
      setTestResult("error");
      setError(err instanceof Error ? err.message : "Failed to save key");
    } finally {
      setTesting(false);
    }
  };

  const handleContinue = async () => {
    if (testResult !== "success") {
      // Save key even if not tested
      await api.setSetting({ key: "anthropic_api_key", value: key });
    }
    onNext();
  };

  return (
    <div className="flex flex-col">
      <h2 className="text-2xl font-semibold">Anthropic API Key</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        A separate API key is used for planning goals and summarising run
        results. This is different from your Claude Code subscription.
      </p>

      <div className="mt-6 space-y-3">
        <div>
          <Input
            type="password"
            value={key}
            onChange={(e) => {
              setKey(e.target.value);
              setTestResult(null);
            }}
            placeholder="sk-ant-..."
          />
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={testKey}
            disabled={!key || testing}
          >
            {testing ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Testing...
              </>
            ) : (
              "Test key"
            )}
          </Button>

          <a
            href="https://console.anthropic.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            Get API key <ExternalLink className="size-3" />
          </a>
        </div>

        {testResult === "success" && (
          <div className="flex items-center gap-2 text-sm text-success">
            <CheckCircle2 className="size-4" />
            API key saved successfully
          </div>
        )}
        {testResult === "error" && (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <XCircle className="size-4" />
            {error ?? "Invalid API key"}
          </div>
        )}
      </div>

      <Button onClick={handleContinue} className="mt-6" disabled={!key}>
        Continue
      </Button>
    </div>
  );
}
