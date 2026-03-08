import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowDown, Search } from "lucide-react";
import { useAutoScroll } from "@/hooks/use-auto-scroll";
import { useState, useMemo } from "react";
import type { RunLog } from "@openorchestra/shared";
import { cn } from "@/lib/utils";

interface LogViewerProps {
  logs: RunLog[];
  loading: boolean;
  isLive: boolean;
}

export function LogViewer({ logs, loading, isLive }: LogViewerProps) {
  const { containerRef, isAtBottom, scrollToBottom } = useAutoScroll([
    logs.length,
  ]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);

  const filteredLogs = useMemo(() => {
    if (!searchQuery) return logs;
    const q = searchQuery.toLowerCase();
    return logs.filter((l) => l.text.toLowerCase().includes(q));
  }, [logs, searchQuery]);

  const highlightText = (text: string, query: string) => {
    if (!query) return text;
    const q = query.toLowerCase();
    const idx = text.toLowerCase().indexOf(q);
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <mark className="rounded bg-primary/30 text-foreground">
          {text.slice(idx, idx + query.length)}
        </mark>
        {text.slice(idx + query.length)}
      </>
    );
  };

  return (
    <div className="relative flex h-full flex-col">
      {/* Search Bar */}
      {showSearch && (
        <div className="flex items-center gap-2 border-b border-border px-3 py-2">
          <Search className="size-3.5 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search logs..."
            className="h-7 border-none bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
            autoFocus
          />
          <button
            onClick={() => {
              setShowSearch(false);
              setSearchQuery("");
            }}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Close
          </button>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
        <span className="text-xs text-muted-foreground">
          {loading
            ? "Loading..."
            : `${filteredLogs.length} line${filteredLogs.length !== 1 ? "s" : ""}`}
        </span>
        <button
          onClick={() => setShowSearch(!showSearch)}
          className="rounded p-1 text-muted-foreground hover:text-foreground"
        >
          <Search className="size-3.5" />
        </button>
      </div>

      {/* Log Content */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto bg-background p-2 font-mono text-xs leading-5"
      >
        {filteredLogs.length === 0 && !loading ? (
          <p className="py-8 text-center text-muted-foreground">
            {isLive ? "Waiting for output..." : "No log output"}
          </p>
        ) : (
          filteredLogs.map((log) => (
            <div
              key={`${log.runId}-${log.sequence}`}
              className={cn(
                "whitespace-pre-wrap break-all",
                log.stream === "stderr" && "text-destructive/80",
              )}
            >
              {searchQuery
                ? highlightText(log.text, searchQuery)
                : log.text}
            </div>
          ))
        )}
      </div>

      {/* Jump to Latest */}
      {!isAtBottom && isLive && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
          <Button
            variant="secondary"
            size="sm"
            onClick={scrollToBottom}
            className="shadow-lg"
          >
            <ArrowDown className="size-3.5" />
            Jump to latest
          </Button>
        </div>
      )}
    </div>
  );
}
