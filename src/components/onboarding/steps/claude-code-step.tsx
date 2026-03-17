import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import * as api from "@/lib/api";
import type { ClaudeCodeDetectionResult } from "@openhelm/shared";

export function ClaudeCodeStep({ onNext }: { onNext: () => void }) {
  const [detecting, setDetecting] = useState(true);
  const [result, setResult] = useState<ClaudeCodeDetectionResult | null>(null);
  const [showManual, setShowManual] = useState(false);
  const [manualPath, setManualPath] = useState("");
  const [verifying, setVerifying] = useState(false);

  const runDetection = async () => {
    setDetecting(true);
    setResult(null);
    try {
      const r = await api.detectClaudeCode();
      setResult(r);
    } catch {
      setResult({ found: false, path: null, version: null, meetsMinVersion: false });
    } finally {
      setDetecting(false);
    }
  };

  useEffect(() => {
    runDetection();
  }, []);

  const verifyManualPath = async () => {
    setVerifying(true);
    try {
      const r = await api.verifyClaudeCode({ path: manualPath });
      setResult(r);
    } catch {
      setResult({ found: false, path: manualPath, version: null, meetsMinVersion: false });
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="flex flex-col">
      <h2 className="text-2xl font-semibold">Claude Code CLI</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        OpenHelm uses Claude Code to execute jobs in your projects.
      </p>

      <div className="mt-6 rounded-lg border border-border bg-card p-4">
        {detecting ? (
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <Loader2 className="size-5 animate-spin text-primary" />
            Detecting Claude Code...
          </div>
        ) : result?.found && result.meetsMinVersion ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-success">
              <CheckCircle2 className="size-5" />
              Claude Code detected
            </div>
            <div className="ml-7 space-y-1 text-xs text-muted-foreground">
              <p>Path: {result.path}</p>
              <p>Version: {result.version}</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-destructive">
              <XCircle className="size-5" />
              {result?.found && !result.meetsMinVersion
                ? `Claude Code found but version ${result.version} is below minimum required`
                : "Claude Code not found"}
            </div>
            <p className="text-xs text-muted-foreground">
              Install Claude Code with:{" "}
              <code className="rounded bg-muted px-1.5 py-0.5">
                npm install -g @anthropic-ai/claude-code
              </code>
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={runDetection}>
                Check again
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowManual(!showManual)}
              >
                Set path manually
              </Button>
            </div>
          </div>
        )}
      </div>

      {showManual && (
        <div className="mt-3 flex gap-2">
          <Input
            value={manualPath}
            onChange={(e) => setManualPath(e.target.value)}
            placeholder="/usr/local/bin/claude"
            className="flex-1"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={verifyManualPath}
            disabled={!manualPath || verifying}
          >
            {verifying ? "Verifying..." : "Verify"}
          </Button>
        </div>
      )}

      <Button
        onClick={onNext}
        className="mt-6"
        disabled={!result?.found || !result.meetsMinVersion}
      >
        Continue
      </Button>
    </div>
  );
}
