/**
 * Generates embeddings for data table schemas.
 * Reuses the memory system's all-MiniLM-L6-v2 model.
 *
 * Embedding text includes: table name, description, column definitions,
 * and a few sample rows — research shows sample rows improve retrieval
 * F1 from 0.79 to 0.88.
 */

import { generateEmbedding } from "../memory/embeddings.js";
import { getDataTable, getSampleRows, updateTableEmbedding } from "../db/queries/data-tables.js";
import type { DataTable, DataTableColumn, DataTableRow } from "@openhelm/shared";

/**
 * Build the text representation used for embedding.
 * Combines table metadata, column definitions, and sample rows.
 */
export function buildEmbeddingText(table: DataTable, sampleRows: DataTableRow[]): string {
  const parts: string[] = [`Table: ${table.name}`];

  if (table.description) {
    parts.push(`Description: ${table.description}`);
  }

  if (table.columns.length > 0) {
    const colDescs = table.columns.map((c) => formatColumnForEmbedding(c));
    parts.push(`Columns: ${colDescs.join(", ")}`);
  }

  if (sampleRows.length > 0) {
    parts.push(`Sample rows (${sampleRows.length} of ${table.rowCount}):`);
    for (const row of sampleRows.slice(0, 5)) {
      const cells = table.columns
        .map((col) => {
          const val = row.data[col.id];
          return val !== null && val !== undefined ? `${col.name}: ${val}` : null;
        })
        .filter(Boolean);
      parts.push(`  ${cells.join(", ")}`);
    }
  }

  parts.push(`Row count: ${table.rowCount}`);

  return parts.join("\n");
}

function formatColumnForEmbedding(col: DataTableColumn): string {
  let desc = `${col.name} (${col.type})`;
  const config = col.config;

  if (col.type === "select" || col.type === "multi_select") {
    const options = config?.options as Array<{ label: string }> | undefined;
    if (options && options.length > 0) {
      const labels = options.map((o) => o.label).join(", ");
      desc += ` [${labels}]`;
    }
  }

  if (col.type === "number" && config?.format) {
    desc += ` (${config.format})`;
  }

  return desc;
}

/**
 * Generate and store an embedding for a data table.
 * Called by IPC handlers when tables are created or schemas change.
 */
export async function generateTableEmbedding(tableId: string): Promise<void> {
  const table = getDataTable(tableId);
  if (!table) return;

  const sampleRows = getSampleRows(tableId, 5);
  const text = buildEmbeddingText(table, sampleRows);
  const embedding = await generateEmbedding(text);
  updateTableEmbedding(tableId, embedding);

  console.error(`[dataTables] embedding updated for "${table.name}" (${tableId})`);
}
