import { useState, useRef, useEffect } from "react";
import { X } from "lucide-react";
import type { DataTableColumnType } from "@openhelm/shared";
import { ColumnTypeIcon } from "./column-type-icon";

interface Props {
  onAdd: (name: string, type: DataTableColumnType) => void;
  onClose: () => void;
}

const COLUMN_TYPES: { value: DataTableColumnType; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "checkbox", label: "Checkbox" },
  { value: "select", label: "Select" },
  { value: "multi_select", label: "Multi Select" },
  { value: "url", label: "URL" },
  { value: "email", label: "Email" },
];

export function DataTableAddColumn({ onAdd, onClose }: Props) {
  const [name, setName] = useState("");
  const [type, setType] = useState<DataTableColumnType>("text");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = () => {
    if (!name.trim()) return;
    onAdd(name.trim(), type);
    setName("");
    setType("text");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[120px]">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div className="relative z-10 w-72 rounded-lg border border-border bg-popover p-4 shadow-lg">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium">Add Column</h3>
          <button onClick={onClose} className="flex size-5 items-center justify-center rounded hover:bg-accent">
            <X className="size-3.5" />
          </button>
        </div>

        <div className="space-y-3">
          <input
            ref={inputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
            placeholder="Column name"
            className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />

          <div className="grid grid-cols-2 gap-1.5">
            {COLUMN_TYPES.map((t) => (
              <button
                key={t.value}
                onClick={() => setType(t.value)}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs transition-colors ${
                  type === t.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                <ColumnTypeIcon type={t.value} className="size-3" />
                {t.label}
              </button>
            ))}
          </div>

          <button
            onClick={handleSubmit}
            disabled={!name.trim()}
            className="w-full rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            Add Column
          </button>
        </div>
      </div>
    </div>
  );
}
