import { useCallback, useEffect, useState } from "react";
import { Download, Upload, AlertTriangle, FolderOpen, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import * as api from "@/lib/api";
import type {
  ExportStatsResult,
  ImportPreviewResult,
  ImportResult,
  InvalidProjectPath,
} from "@openhelm/shared";
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

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DataSection() {
  const [stats, setStats] = useState<ExportStatsResult | null>(null);
  const [includeRunLogs, setIncludeRunLogs] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState<ImportPreviewResult | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [invalidPaths, setInvalidPaths] = useState<InvalidProjectPath[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getExportStats().then(setStats).catch(() => {});
  }, []);

  const [importFilePath, setImportFilePath] = useState<string | null>(null);

  const handleExport = useCallback(async () => {
    setError(null);
    setExporting(true);
    try {
      const { save } = await import("@tauri-apps/plugin-dialog");
      const date = new Date().toISOString().slice(0, 10);
      const filePath = await save({
        defaultPath: `openhelm-export-${date}.json`,
        filters: [{ name: "JSON", extensions: ["json"] }],
      });
      if (!filePath) return;
      await api.exportData({ includeRunLogs, filePath });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setExporting(false);
    }
  }, [includeRunLogs]);

  const handleImportFlow = useCallback(async () => {
    setError(null);
    setImportResult(null);
    setInvalidPaths([]);
    setImporting(true);
    try {
      const { open: openDialog } = await import("@tauri-apps/plugin-dialog");
      const filePath = await openDialog({
        filters: [{ name: "JSON", extensions: ["json"] }],
        multiple: false,
      });
      if (!filePath) {
        setImporting(false);
        return;
      }
      setImportFilePath(filePath as string);
      const previewResult = await api.previewImport({ filePath: filePath as string });
      if (!previewResult.valid) {
        setError(previewResult.error ?? "Invalid file");
        setImporting(false);
        return;
      }
      setPreview(previewResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setImporting(false);
    }
  }, []);

  const executeImport = useCallback(async () => {
    if (!importFilePath) return;
    setPreview(null);
    try {
      const result = await api.executeImport({ filePath: importFilePath });
      setImportResult(result);
      setInvalidPaths(result.invalidPaths);
      if (result.invalidPaths.length === 0) {
        setTimeout(() => window.location.reload(), 2000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setImporting(false);
    }
  }, [importFilePath]);

  const handleFixPath = useCallback(async (projectId: string) => {
    try {
      const { open: openDialog } = await import("@tauri-apps/plugin-dialog");
      const selected = await openDialog({ directory: true, multiple: false });
      if (!selected) return;
      await api.fixProjectPath({ id: projectId, directoryPath: selected as string });
      setInvalidPaths((prev) => prev.filter((p) => p.projectId !== projectId));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  const dismissInvalidPaths = useCallback(() => {
    setInvalidPaths([]);
    setImportResult(null);
    window.location.reload();
  }, []);

  return (
    <div>
      <h3 className="mb-3 font-medium">Data Management</h3>
      <div className="space-y-5 text-sm text-muted-foreground">
        {/* Export */}
        <div className="space-y-3">
          <div>
            <Label className="text-sm text-foreground">Export</Label>
            <p className="text-xs">
              Export all OpenHelm data to a JSON file for backup or migration.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="include-run-logs"
              checked={includeRunLogs}
              onCheckedChange={(checked) => setIncludeRunLogs(checked === true)}
            />
            <Label htmlFor="include-run-logs" className="text-xs font-normal">
              Include run logs
              {stats && (
                <span className="ml-1 text-muted-foreground">
                  ({stats.runLogCount.toLocaleString()} logs,{" "}
                  ~{formatBytes(includeRunLogs ? stats.estimatedSizeWithLogs : stats.estimatedSizeWithoutLogs)})
                </span>
              )}
            </Label>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={exporting}
          >
            {exporting ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Download className="mr-2 size-4" />
            )}
            Export Data
          </Button>
        </div>

        {/* Import */}
        <div className="space-y-3">
          <div>
            <Label className="text-sm text-foreground">Import</Label>
            <p className="text-xs">
              Import data from an OpenHelm export file. This will replace all
              existing data.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleImportFlow}
            disabled={importing}
          >
            {importing ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Upload className="mr-2 size-4" />
            )}
            Import Data
          </Button>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-destructive">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <p className="text-xs">{error}</p>
          </div>
        )}

        {/* Import success */}
        {importResult?.success && invalidPaths.length === 0 && (
          <div className="rounded-md bg-green-500/10 p-3 text-xs text-green-700 dark:text-green-400">
            Import successful. Reloading...
          </div>
        )}

        {/* Invalid paths panel */}
        {invalidPaths.length > 0 && (
          <div className="space-y-3 rounded-md border border-yellow-500/30 bg-yellow-500/10 p-3">
            <div className="flex items-center gap-2 text-xs font-medium text-yellow-700 dark:text-yellow-400">
              <AlertTriangle className="size-4" />
              Some project directories were not found on this machine
            </div>
            <div className="space-y-2">
              {invalidPaths.map((ip) => (
                <div
                  key={ip.projectId}
                  className="flex items-center justify-between gap-2 text-xs"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">{ip.projectName}</p>
                    <p className="truncate text-muted-foreground">{ip.directoryPath}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    onClick={() => handleFixPath(ip.projectId)}
                  >
                    <FolderOpen className="mr-1 size-3" />
                    Browse
                  </Button>
                </div>
              ))}
            </div>
            <Button variant="ghost" size="sm" onClick={dismissInvalidPaths}>
              Done
            </Button>
          </div>
        )}
      </div>

      {/* Import confirmation dialog */}
      <AlertDialog open={!!preview} onOpenChange={(open) => { if (!open) { setPreview(null); setImporting(false); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Import Data</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  This will <strong>replace all existing data</strong> with the
                  contents of this export file.
                </p>
                {preview && (
                  <div className="rounded-md bg-muted p-3 text-xs">
                    <p>Exported: {preview.exportedAt ? new Date(preview.exportedAt).toLocaleString() : "Unknown"}</p>
                    <p>App version: {preview.appVersion ?? "Unknown"}</p>
                    <p>File size: {formatBytes(preview.fileSizeBytes)}</p>
                    {preview.recordCounts && (
                      <p className="mt-1">
                        {preview.recordCounts.projects} projects,{" "}
                        {preview.recordCounts.goals} goals,{" "}
                        {preview.recordCounts.jobs} jobs,{" "}
                        {preview.recordCounts.runs} runs
                        {preview.includesRunLogs && `, ${preview.recordCounts.runLogs} logs`}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={executeImport}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Replace All Data
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
