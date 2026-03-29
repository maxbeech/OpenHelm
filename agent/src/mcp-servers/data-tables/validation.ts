/**
 * Validates and coerces row data against column schema.
 * Ensures type safety on AI writes without being overly strict.
 *
 * Coercion rules:
 * - Numbers: accept string-encoded numbers ("5000" → 5000)
 * - Dates: accept common formats, normalize to ISO 8601
 * - Selects: accept option labels (fuzzy-match), not just IDs
 * - Booleans: accept "true"/"false"/"yes"/"no" strings
 */

import type { DataTableColumn } from "@openhelm/shared";

/**
 * Validate and coerce row data in-place.
 * Mutates the data object to normalize values.
 * Throws on values that can't be coerced.
 */
export function validateRowData(
  columns: DataTableColumn[],
  data: Record<string, unknown>,
): void {
  for (const [colId, value] of Object.entries(data)) {
    if (value === null || value === undefined) continue;

    const col = columns.find((c) => c.id === colId);
    if (!col) continue; // Extra keys are ignored (not an error)

    data[colId] = coerceValue(col, value);
  }
}

function coerceValue(col: DataTableColumn, value: unknown): unknown {
  switch (col.type) {
    case "text":
    case "url":
    case "email":
      return String(value);

    case "number": {
      if (typeof value === "number") return value;
      const n = Number(value);
      if (isNaN(n)) throw new Error(`Column "${col.name}": "${value}" is not a valid number`);
      return n;
    }

    case "checkbox": {
      if (typeof value === "boolean") return value;
      const s = String(value).toLowerCase();
      if (s === "true" || s === "yes" || s === "1") return true;
      if (s === "false" || s === "no" || s === "0") return false;
      throw new Error(`Column "${col.name}": "${value}" is not a valid boolean`);
    }

    case "date": {
      const str = String(value);
      const d = new Date(str);
      if (isNaN(d.getTime())) throw new Error(`Column "${col.name}": "${value}" is not a valid date`);
      return d.toISOString();
    }

    case "select": {
      const options = (col.config?.options ?? []) as Array<{ id: string; label: string }>;
      return resolveSelectOption(col.name, options, value);
    }

    case "multi_select": {
      const options = (col.config?.options ?? []) as Array<{ id: string; label: string }>;
      const values = Array.isArray(value) ? value : [value];
      return values.map((v) => resolveSelectOption(col.name, options, v));
    }

    default:
      return value;
  }
}

/**
 * Resolve a select value to a valid option ID.
 * Accepts: exact ID, exact label, or case-insensitive label match.
 */
function resolveSelectOption(
  colName: string,
  options: Array<{ id: string; label: string }>,
  value: unknown,
): string {
  const str = String(value);

  // Exact ID match
  const byId = options.find((o) => o.id === str);
  if (byId) return byId.id;

  // Exact label match
  const byLabel = options.find((o) => o.label === str);
  if (byLabel) return byLabel.id;

  // Case-insensitive label match
  const lower = str.toLowerCase();
  const byLabelCI = options.find((o) => o.label.toLowerCase() === lower);
  if (byLabelCI) return byLabelCI.id;

  // No match — but if there are no options defined, allow raw value
  if (options.length === 0) return str;

  const validLabels = options.map((o) => o.label).join(", ");
  throw new Error(`Column "${colName}": "${str}" is not a valid option. Valid: ${validLabels}`);
}
