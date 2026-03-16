import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import * as api from "@/lib/api";
import type { ClaudeCodeDetectionResult } from "@openorchestra/shared";

export function SettingsScreen() {
  return (
    <div className="mx-auto max-w-2xl p-6">
      <h2 className="mb-6 text-xl font-semibold">Settings</h2>
      <div className="space-y-8">
        <ClaudeCodeSection />
        <Separator />
        <ExecutionSection />
        <Separator />
        <ApplicationSection />
      </div>
    </div>
  );
}

function ClaudeCodeSection() {
  const [detection, setDetection] = useState<ClaudeCodeDetectionResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [showChange, setShowChange] = useState(false);
  const [customPath, setCustomPath] = useState("");
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    api.getClaudeCodeStatus().then(setDetection).finally(() => setLoading(false));
  }, []);

  const verifyPath = async () => {
    setVerifying(true);
    try {
      const r = await api.verifyClaudeCode({ path: customPath });
      setDetection(r);
      if (r.found) setShowChange(false);
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div>
      <h3 className="mb-3 font-medium">Claude Code</h3>
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading...
        </div>
      ) : detection?.found ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-success">
            <CheckCircle2 className="size-4" />
            Detected
          </div>
          <div className="space-y-1 text-xs text-muted-foreground">
            <p>Path: {detection.path}</p>
            <p>Version: {detection.version}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowChange(!showChange)}
          >
            Change path
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-destructive">
            <XCircle className="size-4" />
            Not detected
          </div>
          <p className="text-xs text-muted-foreground">
            Install with:{" "}
            <code className="rounded bg-muted px-1 py-0.5">
              npm install -g @anthropic-ai/claude-code
            </code>
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowChange(true)}
          >
            Set path manually
          </Button>
        </div>
      )}
      {showChange && (
        <div className="mt-2 flex gap-2">
          <Input
            value={customPath}
            onChange={(e) => setCustomPath(e.target.value)}
            placeholder="/path/to/claude"
            className="flex-1"
          />
          <Button variant="outline" size="sm" onClick={verifyPath} disabled={!customPath || verifying}>
            {verifying ? "..." : "Verify"}
          </Button>
        </div>
      )}
    </div>
  );
}

function ExecutionSection() {
  const [maxConcurrent, setMaxConcurrent] = useState("1");
  const [timeout, setTimeout_] = useState("0");
  const [autoCorrect, setAutoCorrect] = useState(true);

  useEffect(() => {
    Promise.all([
      api.getSetting("max_concurrent_runs"),
      api.getSetting("run_timeout_minutes"),
      api.getSetting("auto_correction_enabled"),
    ]).then(([concurrent, to, correction]) => {
      if (concurrent?.value) setMaxConcurrent(concurrent.value);
      if (to?.value) setTimeout_(to.value);
      if (correction?.value) setAutoCorrect(correction.value !== "false");
    });
  }, []);

  const saveSetting = async (key: "max_concurrent_runs" | "run_timeout_minutes", value: string) => {
    await api.setSetting({ key, value });
  };

  return (
    <div>
      <h3 className="mb-3 font-medium">Execution</h3>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-sm">Max concurrent runs</Label>
          <Select
            value={maxConcurrent}
            onValueChange={(v) => {
              setMaxConcurrent(v);
              saveSetting("max_concurrent_runs", v);
            }}
          >
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1</SelectItem>
              <SelectItem value="2">2</SelectItem>
              <SelectItem value="3">3</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Recommended: 1 for most use cases.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm">Default run timeout</Label>
          <Select
            value={timeout}
            onValueChange={(v) => {
              setTimeout_(v);
              saveSetting("run_timeout_minutes", v);
            }}
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">No limit</SelectItem>
              <SelectItem value="10">10 minutes</SelectItem>
              <SelectItem value="20">20 minutes</SelectItem>
              <SelectItem value="30">30 minutes</SelectItem>
              <SelectItem value="60">60 minutes</SelectItem>
              <SelectItem value="120">120 minutes</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            The silence timeout (10 min) catches stuck processes independently.
          </p>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm">Auto-correct failed runs</Label>
            <p className="text-xs text-muted-foreground">
              When a run fails, analyze the error and automatically retry with
              correction context.
            </p>
          </div>
          <Switch
            checked={autoCorrect}
            onCheckedChange={(checked) => {
              setAutoCorrect(checked);
              api.setSetting({
                key: "auto_correction_enabled",
                value: String(checked),
              });
            }}
          />
        </div>
      </div>
    </div>
  );
}

function ApplicationSection() {
  const [launchAtLogin, setLaunchAtLogin] = useState(false);
  const [launchLoading, setLaunchLoading] = useState(true);

  useEffect(() => {
    invoke<boolean>("plugin:autostart|is_enabled")
      .then(setLaunchAtLogin)
      .catch(() => setLaunchAtLogin(false))
      .finally(() => setLaunchLoading(false));
  }, []);

  const toggleLaunchAtLogin = async (enabled: boolean) => {
    try {
      if (enabled) {
        await invoke("plugin:autostart|enable");
      } else {
        await invoke("plugin:autostart|disable");
      }
      setLaunchAtLogin(enabled);
    } catch (err) {
      console.error("Failed to toggle launch at login:", err);
    }
  };

  return (
    <div>
      <h3 className="mb-3 font-medium">Application</h3>
      <div className="space-y-4 text-sm text-muted-foreground">
        <p>Version: 0.1.0</p>
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm text-foreground">Launch at login</Label>
            <p className="text-xs text-muted-foreground">
              Start OpenOrchestra automatically when you log in.
            </p>
          </div>
          <Switch
            checked={launchAtLogin}
            onCheckedChange={toggleLaunchAtLogin}
            disabled={launchLoading}
          />
        </div>
        <div className="flex gap-4">
          <a
            href="https://openorchestra.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 hover:text-foreground"
          >
            OpenOrchestra.ai <ExternalLink className="size-3" />
          </a>
          <a
            href="https://github.com/openorchestra/openorchestra"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 hover:text-foreground"
          >
            GitHub <ExternalLink className="size-3" />
          </a>
        </div>
      </div>
    </div>
  );
}
