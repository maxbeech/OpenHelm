# Data Tables — Implementation Plan

## Context

OpenHelm's AI jobs currently operate on unstructured text (prompts, memories, logs). Users and AI agents have no way to create, maintain, or query structured data within the platform. This limits use cases like CRM tracking, performance monitoring, content calendars, and any workflow where the AI needs to read/write tabular data over time.

This plan adds **Data Tables** — Notion-inspired structured databases that both users and AI can CRUD. Tables are project-scoped, support rich column types, and are automatically surfaced to AI jobs via semantic relevance matching. The design is generalized (no hardcoded table schemas) and future-proofed for programmatic population (scripts/APIs), chart visualizations, and autopilot goal-progress monitoring.

### Competitor Research Summary

| Tool | Key Pattern | Takeaway for OpenHelm |
|------|------------|----------------------|
| **Notion** | Properties (columns) with rich types; multiple views over same data; 50KB schema cap | Start with core types (text, number, date, select, checkbox); use column IDs not names as row keys |
| **Airtable** | Views as primary interaction; rate-limited API (5 req/s); rich field types | Views/filters are v2; batch operations where possible |
| **Dust.tt** | Schema → LLM generates SQL → validate → execute on SQLite | Inspiration for MCP tool design; let AI query via structured tool calls, not free-form |
| **Research** | Schema enrichment with sample rows improves retrieval F1 from 0.79→0.88 | Embed table name + description + columns + sample rows for relevance matching |
| **Best practice** | Don't inject full schemas; use vector similarity to select relevant columns/tables | Always summarize, never dump; paginate large tables |

---

## 1. Data Model

### 1.1 `data_tables` Table

| Column | Type | Notes |
|--------|------|-------|
| `id` | TEXT PK | `crypto.randomUUID()` |
| `project_id` | TEXT FK→projects | CASCADE delete |
| `name` | TEXT NOT NULL | User-visible table name |
| `description` | TEXT | Optional description (helps AI relevance) |
| `columns` | TEXT NOT NULL | JSON: `DataTableColumn[]` (schema definition) |
| `embedding` | TEXT | JSON: 384-dim float array (for relevance retrieval) |
| `row_count` | INTEGER | Denormalized count (updated on row insert/delete) |
| `created_by` | TEXT NOT NULL | `"user"` or `"ai"` — who created this table |
| `created_at` | TEXT NOT NULL | ISO 8601 |
| `updated_at` | TEXT NOT NULL | ISO 8601 |

### 1.2 `data_table_rows` Table

| Column | Type | Notes |
|--------|------|-------|
| `id` | TEXT PK | `crypto.randomUUID()` |
| `table_id` | TEXT FK→data_tables | CASCADE delete |
| `data` | TEXT NOT NULL | JSON object keyed by column ID: `{ "col_abc": "Acme", "col_def": 5000 }` |
| `sort_order` | INTEGER NOT NULL | Row ordering within table |
| `created_at` | TEXT NOT NULL | ISO 8601 |
| `updated_at` | TEXT NOT NULL | ISO 8601 |

### 1.3 Column Schema Format

```typescript
interface DataTableColumn {
  id: string;          // Stable ID: "col_" + nanoid(8)
  name: string;        // Display name (renameable without breaking data)
  type: DataTableColumnType;
  config: ColumnConfig; // Type-specific config
  width?: number;       // Pixel width (UI state, optional)
}

type DataTableColumnType =
  | "text"
  | "number"
  | "date"
  | "checkbox"
  | "select"
  | "multi_select"
  | "url"
  | "email";

// Type-specific config
interface TextConfig { }
interface NumberConfig { format?: "plain" | "currency" | "percent"; decimals?: number; }
interface DateConfig { includeTime?: boolean; }
interface CheckboxConfig { }
interface SelectConfig { options: SelectOption[]; }
interface MultiSelectConfig { options: SelectOption[]; }
interface UrlConfig { }
interface EmailConfig { }

interface SelectOption {
  id: string;     // Stable ID
  label: string;  // Display text
  color?: string; // Tailwind color name (e.g. "blue", "green", "red")
}
```

**Why column IDs instead of names as row data keys:** Column renames don't require migrating every row. The `data` JSON uses `col_xxx` keys, not human-readable column names.

### 1.4 Audit Trail: `data_table_changes` Table

| Column | Type | Notes |
|--------|------|-------|
| `id` | TEXT PK | UUID |
| `table_id` | TEXT FK→data_tables | CASCADE delete |
| `row_id` | TEXT | Nullable (null for schema changes) |
| `action` | TEXT | `"insert"` / `"update"` / `"delete"` / `"schema_change"` |
| `actor` | TEXT | `"user"` / `"ai"` / `"system"` |
| `run_id` | TEXT | Nullable FK→runs (which AI run made this change) |
| `diff` | TEXT | JSON: what changed (old/new values for updates, full row for inserts) |
| `created_at` | TEXT | ISO 8601 |

This enables: (a) showing users what the AI changed, (b) future undo support, (c) autopilot monitoring of data changes over time.

---

## 2. Data Types — Validation & Storage

| Type | JSON Storage | Validation | Display |
|------|-------------|------------|---------|
| `text` | `string` | Any string | Plain text |
| `number` | `number \| null` | `typeof val === "number"` or parseable | Formatted per config |
| `date` | `string \| null` | Valid ISO 8601 | Date picker |
| `checkbox` | `boolean` | `typeof val === "boolean"` | Toggle |
| `select` | `string \| null` | Must be valid option ID | Colored badge |
| `multi_select` | `string[]` | Each must be valid option ID | Multiple badges |
| `url` | `string \| null` | Optional URL validation | Clickable link |
| `email` | `string \| null` | Optional email validation | Clickable mailto |

**Type coercion rules (for AI writes):** Numbers accept string-encoded numbers. Dates accept common formats and normalize to ISO 8601. Selects accept option labels (not just IDs) and fuzzy-match. Invalid values are rejected with a clear error message — never silently dropped.

---

## 3. AI Integration Architecture

Two complementary mechanisms ensure AI can both *know about* and *interact with* tables:

### 3.1 Schema Injection (Awareness — Read Path)

Reuses the existing memory embedding infrastructure (`agent/src/memory/embeddings.ts`).

**Embedding generation:** When a table is created or its schema changes, generate a 384-dim embedding of:
```
Table: {name}
Description: {description}
Columns: {col1.name} ({col1.type}), {col2.name} ({col2.type}), ...
Sample rows (3-5):
  {col1.name}: val1, {col2.name}: val2, ...
  ...
Row count: {rowCount}
```

**Retrieval during prompt building** (`agent/src/executor/index.ts`, after memory injection):
1. Build the same retrieval query used for memories
2. Compute cosine similarity against all table embeddings for the project
3. Tables scoring above 0.25 threshold are injected as a prompt section
4. Section format (via new `buildDataTableSection()` in prompt-builder):

```markdown
---

## Available Data Tables

The following data tables are available in this project. Use the openhelm-data MCP tools to query or modify them.

### Customers (42 rows)
Tracks prospective leads and their pipeline status.
| Column | Type |
|--------|------|
| Name | text |
| Status | select (Lead, Qualified, Customer, Churned) |
| Revenue | number (currency) |
| Last Contact | date |

### Content Calendar (18 rows)
Blog posts planned and published.
...
```

This gives Claude Code *awareness* of available tables without dumping all data. Claude can then use MCP tools to query specific data.

### 3.2 MCP Server (Interaction — Read/Write Path)

A lightweight **Node.js MCP server** at `agent/mcp-servers/data-tables/` that Claude Code invokes during job execution. It connects directly to the same SQLite database (WAL mode supports concurrent access).

**Why a separate MCP server (not integrated into agent)?**
- Claude Code spawns MCP servers itself via the `--mcp-config` flag
- Matches the existing browser MCP pattern
- No additional IPC complexity — just SQLite as the shared state
- Clean separation of concerns

**MCP Tools exposed:**

| Tool | Description | Parameters |
|------|------------|------------|
| `list_tables` | List all tables with schemas | `projectId` |
| `query_table` | Get rows (with optional filter/sort/limit) | `tableId`, `filter?`, `sort?`, `limit?`, `offset?` |
| `create_table` | Create a new table | `projectId`, `name`, `description?`, `columns` |
| `insert_rows` | Insert one or more rows | `tableId`, `rows[]` |
| `update_rows` | Update rows matching a filter | `tableId`, `filter`, `updates` |
| `delete_rows` | Delete rows matching a filter | `tableId`, `filter` |
| `add_column` | Add a column to existing table | `tableId`, `column` |
| `rename_column` | Rename a column | `tableId`, `columnId`, `newName` |
| `remove_column` | Remove a column | `tableId`, `columnId` |
| `get_table_summary` | Schema + stats + sample rows | `tableId` |

**Filter format** (simple, not full SQL):
```json
{
  "column": "col_abc",
  "op": "eq" | "neq" | "gt" | "lt" | "gte" | "lte" | "contains" | "in",
  "value": "..."
}
```
Filters compose with AND logic. This is intentionally simpler than SQL — it prevents injection attacks and keeps the AI's tool calls predictable.

**Pagination:** Default limit of 50 rows per query. AI can paginate with offset. For tables > 500 rows, `get_table_summary` returns stats + sample instead of all data.

**Change logging:** Every mutation writes to `data_table_changes` with `actor: "ai"` and the run ID (passed as a CLI arg to the MCP server).

**Notification to agent:** After each mutation, the MCP server writes a line to a notification file (`~/.openhelm/data-table-notifications/{runId}.jsonl`). The agent's executor watches this file (similar to `intervention-watcher.ts`) and emits IPC events (`dataTable.rowsChanged`, `dataTable.schemaChanged`) so the frontend updates in real-time.

### 3.3 MCP Config Integration

Extend `agent/src/mcp-servers/mcp-config-builder.ts`:

```typescript
// In buildMcpConfig():
const dataTablesServerPath = join(__dirname, "../../mcp-servers/data-tables/index.js");
servers["openhelm-data"] = {
  command: "node",
  args: [dataTablesServerPath, "--db-path", dbPath, "--run-id", runId, "--project-id", projectId],
};
```

Add a preamble constant:
```
DATA_TABLES_PREAMBLE = 'OpenHelm: Data tables are available via "openhelm-data" MCP tools. '
  + 'Use mcp__openhelm-data__list_tables to see available tables, '
  + 'mcp__openhelm-data__query_table to read data, and '
  + 'mcp__openhelm-data__insert_rows / update_rows / delete_rows to modify data. '
  + 'Always check existing tables before creating new ones.\n\n';
```

### 3.4 Smart Interaction Patterns (Anti-pattern Prevention)

1. **Don't dump full tables into prompts** — only inject schema summaries via embeddings; AI queries via MCP for actual data
2. **Validate on write** — MCP server enforces column types, select option validity, required fields
3. **Idempotent operations** — `insert_rows` returns created row IDs; `update_rows` returns count of affected rows
4. **Rate limiting** — MCP server caps at 100 mutations per tool call (prevents runaway loops)
5. **Read-before-write guidance** — preamble instructs Claude to check existing tables before creating duplicates

---

## 4. Agent Layer

### 4.1 New Files

```
agent/src/db/queries/data-tables.ts     — CRUD for tables + rows + changes
agent/src/ipc/handlers/data-tables.ts   — IPC handlers for frontend
agent/src/data-tables/embeddings.ts     — Table schema embedding generation
agent/src/data-tables/prompt-builder.ts — Format table info for prompt injection
agent/src/data-tables/retriever.ts      — Retrieve relevant tables by similarity
agent/src/data-tables/notification-watcher.ts — Watch for MCP server mutations
agent/mcp-servers/data-tables/index.ts  — MCP server entry point
agent/mcp-servers/data-tables/tools.ts  — Tool implementations
agent/mcp-servers/data-tables/validation.ts — Type validation + coercion
```

### 4.2 Query Module (`agent/src/db/queries/data-tables.ts`)

Follows existing CRUD pattern from memories.ts / credentials.ts:

```typescript
// Table CRUD
export function createDataTable(params): DataTable
export function getDataTable(id): DataTable | null
export function listDataTables(params: { projectId?: string }): DataTable[]
export function updateDataTable(params): DataTable
export function deleteDataTable(id): boolean

// Row CRUD
export function insertDataTableRows(tableId, rows[]): DataTableRow[]
export function getDataTableRows(params: { tableId, limit?, offset?, filter?, sort? }): DataTableRow[]
export function updateDataTableRow(rowId, data): DataTableRow
export function deleteDataTableRows(rowIds[]): number
export function countDataTableRows(tableId): number

// Schema operations
export function addColumn(tableId, column): DataTable
export function renameColumn(tableId, columnId, newName): DataTable
export function removeColumn(tableId, columnId): DataTable

// Change log
export function logDataTableChange(params): void
export function listDataTableChanges(tableId, params?): DataTableChange[]

// Embedding
export function getTablesWithEmbeddings(projectId): DataTableWithEmbedding[]
export function updateTableEmbedding(tableId, embedding): void
```

### 4.3 IPC Handlers (`agent/src/ipc/handlers/data-tables.ts`)

```typescript
// Table CRUD
"dataTables.list"           → listDataTables({ projectId })
"dataTables.get"            → getDataTable(id)
"dataTables.create"         → createDataTable(params) + generate embedding + emit
"dataTables.update"         → updateDataTable(params) + regenerate embedding + emit
"dataTables.delete"         → deleteDataTable(id) + emit

// Row CRUD
"dataTables.listRows"       → getDataTableRows(params)
"dataTables.insertRows"     → insertDataTableRows(tableId, rows) + emit
"dataTables.updateRow"      → updateDataTableRow(rowId, data) + emit
"dataTables.deleteRows"     → deleteDataTableRows(rowIds) + emit

// Schema operations
"dataTables.addColumn"      → addColumn(tableId, column) + regenerate embedding + emit
"dataTables.renameColumn"   → renameColumn(tableId, columnId, newName) + emit
"dataTables.removeColumn"   → removeColumn(tableId, columnId) + emit

// Utility
"dataTables.count"          → count tables for project
"dataTables.listChanges"    → listDataTableChanges(tableId)

// Cross-project (All Projects mode)
"dataTables.listAll"        → listAllDataTables()
"dataTables.countAll"       → countAllDataTables()
```

### 4.4 Executor Integration

In `agent/src/executor/index.ts`, after memory injection (line ~333), add table injection:

```typescript
// Inject relevant data table schemas into prompt
try {
  const { retrieveRelevantTables } = await import("../data-tables/retriever.js");
  const { buildDataTableSection } = await import("../data-tables/prompt-builder.js");
  const relevantTables = await retrieveRelevantTables({
    projectId: job.projectId,
    query: retrievalQuery,  // Same query used for memories
  });
  if (relevantTables.length > 0) {
    effectivePrompt += buildDataTableSection(relevantTables);
    console.error(`[executor] injected ${relevantTables.length} table schemas into run ${runId}`);
  }
} catch (err) {
  console.error("[executor] data table retrieval error (non-fatal):", err);
}
```

In the MCP config section (line ~468), add the data tables MCP server alongside browser MCP.

### 4.5 Embedding Regeneration Triggers

Regenerate table embedding when:
- Table is created
- Table name/description changes
- Columns are added/removed/renamed
- Row count crosses a threshold (0→1, or every 20% change)
- Triggered by MCP server mutations (via notification watcher)

Use a debounce (5 second) to batch rapid changes (e.g., AI inserting 50 rows in sequence).

---

## 5. Frontend Layer

### 5.1 New Files

```
src/stores/data-table-store.ts
src/components/data-tables/data-table-list-view.tsx    — Table list (main view)
src/components/data-tables/data-table-detail-view.tsx  — Single table view
src/components/data-tables/data-table-create-dialog.tsx
src/components/data-tables/data-table-card.tsx          — Table card in list view
src/components/data-tables/data-table-grid.tsx          — The table grid (rows + columns)
src/components/data-tables/data-table-cell.tsx          — Cell renderer per type
src/components/data-tables/data-table-cell-editor.tsx   — Cell editor per type
src/components/data-tables/data-table-column-header.tsx — Column header with type icon
src/components/data-tables/data-table-add-column.tsx    — Add column UI
src/components/data-tables/data-table-toolbar.tsx       — Row add, search, filter
src/components/data-tables/column-type-icon.tsx         — Icon per column type
```

### 5.2 Navigation

**Sidebar** (`src/components/layout/sidebar.tsx`):
- Add "Data" button between "Memory" and "Credentials" buttons
- Icon: `Database` from lucide-react
- Shows table count badge (like memory count)

**ContentView** (`src/stores/app-store.ts`):
- Add `"data-tables"` and `"data-table-detail"` to the `ContentView` union type
- Add `selectedDataTableId: string | null` to state

**App.tsx routing:**
- `contentView === "data-tables"` → `<DataTableListView />`
- `contentView === "data-table-detail"` → `<DataTableDetailView tableId={selectedDataTableId} />`

### 5.3 Store (`src/stores/data-table-store.ts`)

Follows the established pattern from memory-store / credential-store:

```typescript
interface DataTableState {
  // Data
  tables: DataTable[];
  tableCount: number;
  loading: boolean;
  error: string | null;

  // Current table detail
  currentRows: DataTableRow[];
  rowsLoading: boolean;
  totalRowCount: number;

  // Actions
  fetchTables: (projectId?: string) => Promise<void>;
  fetchTableCount: (projectId?: string) => Promise<void>;
  createTable: (params: CreateDataTableParams) => Promise<DataTable>;
  updateTable: (params: UpdateDataTableParams) => Promise<DataTable>;
  deleteTable: (id: string) => Promise<void>;

  // Row actions
  fetchRows: (tableId: string) => Promise<void>;
  insertRows: (tableId: string, rows: Record<string, unknown>[]) => Promise<void>;
  updateRow: (rowId: string, data: Record<string, unknown>) => Promise<void>;
  deleteRows: (rowIds: string[]) => Promise<void>;

  // Column actions
  addColumn: (tableId: string, column: DataTableColumn) => Promise<void>;
  renameColumn: (tableId: string, columnId: string, newName: string) => Promise<void>;
  removeColumn: (tableId: string, columnId: string) => Promise<void>;

  // Store update methods (from IPC events)
  addTableToStore: (table: DataTable) => void;
  updateTableInStore: (table: DataTable) => void;
  removeTableFromStore: (id: string) => void;
  refreshRowsInStore: (tableId: string) => void;
}
```

### 5.4 Table List View (`data-table-list-view.tsx`)

- Header with "Data Tables" title + "New Table" button
- Grid of table cards showing: name, description, column count, row count, created_by badge, last updated
- Click card → navigate to detail view
- Empty state: "No data tables yet. Create one manually or let your AI jobs create them."
- Project-filtered (respects active project selection)

### 5.5 Table Detail View — Notion-style Grid (`data-table-detail-view.tsx`)

The core UI — a spreadsheet-like grid:

- **Header row:** Column names with type icons, click to rename/configure/delete
- **Data rows:** Click cell to edit inline; type-appropriate editors:
  - `text`: contentEditable div
  - `number`: numeric input
  - `date`: date picker (shadcn DatePicker)
  - `checkbox`: toggle switch
  - `select`: dropdown with colored options
  - `multi_select`: multi-select dropdown with badges
  - `url`: text input + external link icon
  - `email`: text input
- **Add row:** "+" button at bottom, creates empty row
- **Add column:** "+" button at right of header, opens type selector
- **Toolbar:** Back button, table name (editable), description, row count
- **Change indicator:** Small "AI" badge on rows/cells modified by AI (from change log)
- **Keyboard navigation:** Tab between cells, Enter to confirm edit, Escape to cancel

### 5.6 Real-time Updates

Register IPC event handlers in `App.tsx`:
```typescript
useAgentEvent("dataTable.created", (table) => addTableToStore(table));
useAgentEvent("dataTable.updated", (table) => updateTableInStore(table));
useAgentEvent("dataTable.deleted", ({ id }) => removeTableFromStore(id));
useAgentEvent("dataTable.rowsChanged", ({ tableId }) => refreshRowsInStore(tableId));
```

This ensures the UI updates live when an AI job modifies table data during a run.

---

## 6. Shared Types

Add to `shared/src/index.ts`:

```typescript
// Data Table types
export interface DataTableColumn {
  id: string;
  name: string;
  type: DataTableColumnType;
  config: Record<string, unknown>;
  width?: number;
}

export type DataTableColumnType =
  | "text" | "number" | "date" | "checkbox"
  | "select" | "multi_select" | "url" | "email";

export interface DataTable {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  columns: DataTableColumn[];
  rowCount: number;
  createdBy: "user" | "ai";
  createdAt: string;
  updatedAt: string;
}

export interface DataTableRow {
  id: string;
  tableId: string;
  data: Record<string, unknown>;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface DataTableChange {
  id: string;
  tableId: string;
  rowId: string | null;
  action: "insert" | "update" | "delete" | "schema_change";
  actor: "user" | "ai" | "system";
  runId: string | null;
  diff: Record<string, unknown>;
  createdAt: string;
}
```

---

## 7. Edge Cases & Design Decisions

### 7.1 Schema Changes with Existing Rows

| Operation | Behavior |
|-----------|----------|
| **Add column** | Existing rows get `null` for new column. No data migration needed. |
| **Remove column** | Column removed from schema. Row data keys are NOT cleaned up (orphaned keys are harmless). Keeps data recoverable. |
| **Rename column** | Only column `name` changes. Column `id` stays the same. Zero data migration. |
| **Change column type** | v1: Not supported (must delete + re-add). v2: Add type coercion with user confirmation. |

### 7.2 Concurrent Access

- SQLite WAL mode supports concurrent reads from agent + MCP server + frontend
- Writes serialize at the SQLite level (5-second busy timeout configured)
- Row-level conflicts: last write wins (acceptable for v1 data volumes)
- The notification file + IPC event system ensures the frontend stays in sync

### 7.3 Large Tables

- MCP `query_table`: default limit 50 rows, max 200 per request
- MCP `get_table_summary`: returns schema + 5 sample rows + stats (never full dump)
- Prompt injection: always schema + row count only (never row data)
- Frontend: virtual scrolling for tables > 100 rows (use `@tanstack/react-virtual` if needed)
- Change log: auto-prune entries older than 90 days (keep last 1000 per table)

### 7.4 Embedding Performance

- Embedding generation: ~50ms per table (reuses existing all-MiniLM-L6-v2)
- Debounced: 5-second window batches rapid changes
- Only re-embed when schema or description changes (not on every row insert)
- Exception: re-embed when row count crosses 0→1 threshold (sample rows now available)

### 7.5 MCP Server Lifecycle

- Spawned per-run by Claude Code (not long-running)
- Receives DB path, run ID, and project ID as CLI args
- Opens its own SQLite connection (WAL mode)
- Closes connection on stdio EOF (Claude Code process exit)
- Notification file cleaned up by executor after run completion

---

## 8. Implementation Phases

### Phase 1: Foundation — Schema + Agent CRUD (~2-3 sessions)

**Files to create/modify:**

1. `shared/src/index.ts` — Add DataTable/DataTableRow/DataTableChange types
2. `agent/src/db/schema.ts` — Add `dataTables`, `dataTableRows`, `dataTableChanges` table definitions
3. `agent/src/db/migrations/` — New migration SQL
4. `agent/src/db/queries/data-tables.ts` — Full CRUD module
5. `agent/src/ipc/handlers/data-tables.ts` — All IPC handlers
6. `agent/src/ipc/handlers/index.ts` — Register new handlers
7. `agent/test/data-tables.test.ts` — Unit tests for query module + handlers

### Phase 2: AI Integration — MCP Server + Embeddings (~2-3 sessions)

**Files to create/modify:**

1. `agent/mcp-servers/data-tables/index.ts` — MCP server entry point (stdio transport)
2. `agent/mcp-servers/data-tables/tools.ts` — Tool implementations
3. `agent/mcp-servers/data-tables/validation.ts` — Type validation + coercion
4. `agent/mcp-servers/data-tables/package.json` — Dependencies (MCP SDK)
5. `agent/src/data-tables/embeddings.ts` — Schema embedding generation
6. `agent/src/data-tables/retriever.ts` — Cosine similarity retrieval
7. `agent/src/data-tables/prompt-builder.ts` — Format table info for prompts
8. `agent/src/data-tables/notification-watcher.ts` — Watch for MCP mutations
9. `agent/src/mcp-servers/mcp-config-builder.ts` — Add data-tables server entry
10. `agent/src/executor/index.ts` — Add table schema injection + MCP config
11. `agent/test/data-tables-mcp.test.ts` — MCP server tests
12. `agent/test/data-tables-retriever.test.ts` — Retriever tests

### Phase 3: Frontend — UI Components (~2-3 sessions)

**Files to create/modify:**

1. `src/stores/data-table-store.ts` — Zustand store
2. `src/stores/app-store.ts` — Add "data-tables" + "data-table-detail" to ContentView
3. `src/lib/api.ts` — Add data table API methods
4. `src/components/layout/sidebar.tsx` — Add Data tab
5. `src/App.tsx` — Add routing + event handlers
6. `src/components/data-tables/data-table-list-view.tsx`
7. `src/components/data-tables/data-table-card.tsx`
8. `src/components/data-tables/data-table-create-dialog.tsx`
9. `src/components/data-tables/data-table-detail-view.tsx`
10. `src/components/data-tables/data-table-grid.tsx`
11. `src/components/data-tables/data-table-cell.tsx`
12. `src/components/data-tables/data-table-cell-editor.tsx`
13. `src/components/data-tables/data-table-column-header.tsx`
14. `src/components/data-tables/data-table-add-column.tsx`
15. `src/components/data-tables/data-table-toolbar.tsx`
16. `src/components/data-tables/column-type-icon.tsx`

### Phase 4: Testing + Polish (~1 session)

1. End-to-end test: create table in UI → run AI job that writes to it → verify data appears
2. Run existing test suite — ensure no regressions
3. E2E browser validation at `http://localhost:1420`
4. Update `CLAUDE.md` with new data model entries
5. Update `CHANGELOG.md`

---

## 9. Future Considerations (Out of Scope for v1)

These informed the design but are NOT implemented in this plan:

| Feature | How This Design Enables It |
|---------|---------------------------|
| **Programmatic population (scripts/APIs)** | MCP server already provides the API; a future HTTP wrapper or CLI tool can reuse the same `queries/data-tables.ts` module |
| **Chart visualizations** | `data_table_rows` JSON format is easily queryable in JS; number/date columns are typed for aggregation; `data_table_changes` enables time-series from change history |
| **Autopilot goal monitoring** | Change log with timestamps enables "did metric X improve this week?"; row_count tracking enables "is the table growing?"; embeddings enable "which tables are relevant to this goal?" |
| **Table views (filtered/sorted/grouped)** | Column IDs are stable; add a `data_table_views` table later with filter/sort/group config |
| **Formulas & computed columns** | Column config is extensible; add `formula` type with expression string |
| **Relations between tables** | Add `relation` column type that stores foreign row IDs |
| **Import/export (CSV, JSON)** | Rows are already JSON; CSV import/export is a thin transform |
| **Row-level permissions** | Change log already tracks actor; add ACL column if needed |

---

## 10. Verification Plan

### Automated Tests
- [ ] `data-tables.test.ts`: Table CRUD, row CRUD, schema changes, validation, embedding generation
- [ ] `data-tables-mcp.test.ts`: MCP tool calls, filter logic, type coercion, pagination
- [ ] `data-tables-retriever.test.ts`: Cosine similarity scoring, threshold filtering
- [ ] Existing test suite passes (`npm test` in agent/)

### Manual E2E Verification
- [ ] Create a table via UI → verify it appears in sidebar count
- [ ] Add columns of each type → verify type-appropriate editors work
- [ ] Add/edit/delete rows → verify persistence across page refresh
- [ ] Create a job that references table data → verify AI can query via MCP
- [ ] Create a job that creates a new table → verify it appears in UI
- [ ] Run a job that inserts rows → verify real-time update in UI
- [ ] Test "All Projects" view → verify tables from multiple projects appear
- [ ] Verify table schema injection in prompt (check run logs for "Available Data Tables" section)
- [ ] Test with >100 rows → verify pagination in MCP and smooth scrolling in UI
