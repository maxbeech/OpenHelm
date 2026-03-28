import { useState, useRef, useCallback } from "react";
import { ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SortMode, Goal, Job } from "@openhelm/shared";

const SORT_LABELS: Record<SortMode, string> = {
  custom: "Custom",
  alpha_asc: "A — Z",
  created_asc: "Oldest first",
  created_desc: "Newest first",
};

const SORT_OPTIONS: SortMode[] = ["custom", "alpha_asc", "created_asc", "created_desc"];

export function applySortGoals(items: Goal[], mode: SortMode): Goal[] {
  if (mode === "custom") return items; // already ordered by sort_order from DB
  const sorted = [...items];
  switch (mode) {
    case "alpha_asc":
      sorted.sort((a, b) => (a.name || a.description).localeCompare(b.name || b.description));
      break;
    case "created_asc":
      sorted.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      break;
    case "created_desc":
      sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      break;
  }
  return sorted;
}

export function applySortJobs(items: Job[], mode: SortMode): Job[] {
  if (mode === "custom") return items;
  const sorted = [...items];
  switch (mode) {
    case "alpha_asc":
      sorted.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case "created_asc":
      sorted.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      break;
    case "created_desc":
      sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      break;
  }
  return sorted;
}

export function SortDropdown({
  value,
  onChange,
  label,
}: {
  value: SortMode;
  onChange: (mode: SortMode) => void;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const handleBlur = useCallback((e: React.FocusEvent) => {
    if (!ref.current?.contains(e.relatedTarget as Node)) {
      setOpen(false);
    }
  }, []);

  return (
    <div ref={ref} className="relative" onBlur={handleBlur}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "rounded p-0.5 text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
          value !== "custom" && "text-primary",
        )}
        title={`Sort ${label}: ${SORT_LABELS[value]}`}
      >
        <ArrowUpDown className="size-3.5" />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 min-w-[130px] rounded-md border border-sidebar-border bg-sidebar py-1 shadow-lg">
          {SORT_OPTIONS.map((mode) => (
            <button
              key={mode}
              onClick={() => {
                onChange(mode);
                setOpen(false);
              }}
              className={cn(
                "flex w-full items-center px-3 py-1.5 text-left text-xs transition-colors hover:bg-sidebar-accent",
                mode === value
                  ? "font-medium text-primary"
                  : "text-sidebar-foreground",
              )}
            >
              {SORT_LABELS[mode]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
