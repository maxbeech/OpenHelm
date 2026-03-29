import { useState, useRef, useEffect } from "react";
import type { DataTableColumn } from "@openhelm/shared";

interface Props {
  column: DataTableColumn;
  value: unknown;
  onChange: (value: unknown) => void;
}

export function DataTableCell({ column, value, onChange }: Props) {
  switch (column.type) {
    case "checkbox":
      return <CheckboxCell value={value} onChange={onChange} />;
    case "select":
      return <SelectCell column={column} value={value} onChange={onChange} />;
    default:
      return <TextCell value={value} onChange={onChange} type={column.type} />;
  }
}

// ─── Text-based cell (text, number, date, url, email) ───

function TextCell({ value, onChange, type }: { value: unknown; onChange: (v: unknown) => void; type: string }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const displayValue = value !== null && value !== undefined ? String(value) : "";

  const startEdit = () => {
    setDraft(displayValue);
    setEditing(true);
  };

  const commitEdit = () => {
    setEditing(false);
    let parsed: unknown = draft || null;
    if (type === "number" && draft) {
      const n = Number(draft);
      parsed = isNaN(n) ? null : n;
    }
    if (parsed !== value) onChange(parsed);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commitEdit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commitEdit();
          if (e.key === "Escape") setEditing(false);
        }}
        type={type === "number" ? "number" : type === "date" ? "date" : "text"}
        className="w-full bg-transparent px-3 py-1.5 text-sm outline-none ring-1 ring-primary/50"
      />
    );
  }

  return (
    <div
      onClick={startEdit}
      className="min-h-[30px] cursor-text px-3 py-1.5 text-sm truncate"
      title={displayValue}
    >
      {displayValue || <span className="text-muted-foreground/30">-</span>}
    </div>
  );
}

// ─── Checkbox cell ───

function CheckboxCell({ value, onChange }: { value: unknown; onChange: (v: unknown) => void }) {
  return (
    <div className="flex items-center justify-center min-h-[30px]">
      <input
        type="checkbox"
        checked={!!value}
        onChange={(e) => onChange(e.target.checked)}
        className="size-3.5 rounded border-input"
      />
    </div>
  );
}

// ─── Select cell ───

function SelectCell({ column, value, onChange }: { column: DataTableColumn; value: unknown; onChange: (v: unknown) => void }) {
  const options = (column.config?.options ?? []) as Array<{ id: string; label: string; color?: string }>;
  const selected = options.find((o) => o.id === value);

  return (
    <select
      value={(value as string) ?? ""}
      onChange={(e) => onChange(e.target.value || null)}
      className="w-full bg-transparent px-3 py-1.5 text-sm outline-none cursor-pointer min-h-[30px]"
    >
      <option value="">-</option>
      {options.map((opt) => (
        <option key={opt.id} value={opt.id}>{opt.label}</option>
      ))}
    </select>
  );
}
