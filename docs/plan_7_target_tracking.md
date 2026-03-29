# Plan 7: Target Tracking

## Context

OpenHelm now has data tables (plan 6) and an autopilot system (plan 4), but goals remain purely descriptive — there's no way to quantify "how close are we?" Adding numerical targets that link goals/jobs to specific data table columns lets the autopilot monitor progress, escalate when off-track, and proactively create jobs to collect missing data or course-correct.

---

## Data Model

### New `targets` table (migration `0028_add_targets.sql`)

| Column | Type | Notes |
|--------|------|-------|
| `id` | text PK | UUID |
| `goal_id` | text FK→goals (CASCADE) | nullable — target belongs to a goal OR a job |
| `job_id` | text FK→jobs (CASCADE) | nullable |
| `project_id` | text FK→projects (CASCADE) | required for project-scoped queries |
| `data_table_id` | text FK→data_tables (CASCADE) | which table holds the metric |
| `column_id` | text | stable column ID (col_xxxxx) within that table |
| `target_value` | real | numerical target to reach |
| `direction` | text | `gte` / `lte` / `eq` — at least, at most, exactly |
| `aggregation` | text | `latest` / `sum` / `avg` / `max` / `min` / `count` |
| `label` | text | optional human-readable name |
| `deadline` | text | optional ISO datetime |
| `created_by` | text | `user` / `ai` |
| `created_at` | text | ISO timestamp |
| `updated_at` | text | ISO timestamp |

**Constraint:** Exactly one of `goal_id` or `job_id` must be non-null (enforced in application logic, matching existing patterns).

---

## Shared Types

Add to `shared/src/index.ts`:

- `TargetDirection = 'gte' | 'lte' | 'eq'`
- `TargetAggregation = 'latest' | 'sum' | 'avg' | 'max' | 'min' | 'count'`
- `Target` interface (mirrors DB columns)
- `TargetEvaluation { targetId, currentValue, targetValue, direction, met, progress (0-1), rowCount, label, deadline, isOverdue }`
- CRUD param interfaces: `CreateTargetParams`, `UpdateTargetParams`, `ListTargetsParams`

---

## Agent Layer

### 1. DB Queries — `agent/src/db/queries/targets.ts` (new, ~120 lines)

CRUD functions following the `data-tables.ts` pattern:
- `createTarget(params)` — validates exactly one of goalId/jobId is set
- `getTarget(id)`, `listTargets(params)`, `updateTarget(params)`, `deleteTarget(id)`
- `listTargetsForGoal(goalId)`, `listTargetsForJob(jobId)` — convenience wrappers

### 2. Target Evaluator — `agent/src/data-tables/target-evaluator.ts` (new, ~120 lines)

Pure evaluation logic:
- `evaluateTarget(target)` → `TargetEvaluation`
- `evaluateTargets(targets)` → `TargetEvaluation[]`

**Aggregation logic:**
- `latest`: most recent row (by `sortOrder` DESC, then `createdAt` DESC)
- `sum/avg/max/min`: standard aggregations over all numeric values in the column
- `count`: count of non-null values in the column

**Progress calculation:**
- `gte`: `clamp(0, currentValue / targetValue, 1)`
- `lte`: `1.0` if current ≤ target, else `clamp(0, targetValue / currentValue, 1)`
- `eq`: `1.0 - clamp(0, |current - target| / max(|target|, 1), 1)`

**Edge cases:** Non-numeric values skipped. Missing column → `currentValue: null`, `progress: 0`. No rows → same.

### 3. IPC Handlers — `agent/src/ipc/handlers/targets.ts` (new, ~100 lines)

| Method | Returns |
|--------|---------|
| `targets.list` | `Target[]` |
| `targets.get` | `Target` |
| `targets.create` | `Target` |
| `targets.update` | `Target` |
| `targets.delete` | `{ deleted: boolean }` |
| `targets.evaluate` | `TargetEvaluation` |
| `targets.evaluateAll` | `TargetEvaluation[]` |

Register in `agent/src/ipc/handlers/index.ts`.

### 4. Prompt Injection — `agent/src/data-tables/target-prompt-builder.ts` (new, ~80 lines)

Builds a `## Active Targets` markdown section injected into job prompts. Format:

```
## Active Targets
- **Test Coverage %** → Target: ≥80 (Current: 67.3, Progress: 84%) — Deadline: 2026-04-15
- **Error Count** → Target: ≤5 (Current: 12, Progress: 42% — NOT MET)
```

**Injection point:** `agent/src/executor/index.ts` (~line 356), after data table schema injection. Fetches targets for the job and its parent goal, builds section, appends to prompt. Non-fatal on error.

### 5. MCP Tools — `agent/src/mcp-servers/data-tables/target-tools.ts` (new, ~180 lines)

5 new tools available to Claude Code during job runs:

| Tool | Purpose |
|------|---------|
| `list_targets` | List targets for a goal/job |
| `create_target` | Create a target linking to a data table column |
| `update_target` | Modify target value, direction, aggregation, label, deadline |
| `delete_target` | Remove a target |
| `evaluate_targets` | Get current progress for all targets on a goal/job |

Imported into `tools.ts` and merged into `TOOL_DEFINITIONS` + `handleToolCall`. No autopilot mode gating on MCP tools (approval gate is at job-creation level, matching existing pattern).

---

## Autopilot Integration

### System Job Generation Awareness

**Modify: `agent/src/planner/system-jobs.ts`**

In `buildUserMessage()`, after job summaries, inject evaluated target info:
```
Target metrics for this goal:
  - Test Coverage %: ≥80 (current: 67.3, progress: 84%)
  - Error Count: ≤5 (current: 12, progress: 42% — OVERDUE)
```

This gives the LLM context to generate monitoring jobs that reference specific targets.

**Modify: `agent/src/planner/prompts.ts`**

Add to `SYSTEM_JOB_GENERATION_PROMPT`: "If target metrics are provided, consider generating jobs that track progress, collect missing data, or take corrective action when targets are off-track. You can use the `create_target`, `update_target`, and `evaluate_targets` MCP tools."

### Autopilot CRUD Flow

The autopilot already has the three-mode gate:
- **off**: No system jobs run → no AI target CRUD
- **approval_required**: System jobs proposed → user approves → jobs run with full MCP access including target tools
- **full_auto**: System jobs auto-created → run with full MCP access

No new gating logic needed. The existing mode enforcement at the job-creation level covers target CRUD.

### Corrective Actions

System jobs can see target progress and take action:
1. See a target not being met → create/modify jobs to work toward it
2. See missing data → create a one-off job to set up data collection
3. See targets with approaching deadlines → escalate priority

All via existing MCP tools (job CRUD not yet exposed as MCP tools — system jobs accomplish this by reporting recommendations in their summary, which the autopilot triages).

---

## Frontend

### API Functions — modify `src/lib/api.ts` (~30 lines added)

```typescript
listTargets(params), createTarget(params), updateTarget(params),
deleteTarget(id), evaluateTarget(id), evaluateTargets(params)
```

### Zustand Store — `src/stores/target-store.ts` (new, ~80 lines)

```typescript
interface TargetState {
  targets: Target[];
  evaluations: TargetEvaluation[];
  loading: boolean;
  error: string | null;
  fetchTargets(params): Promise<void>;
  fetchEvaluations(goalId?, jobId?): Promise<void>;
  createTarget(params): Promise<Target | null>;
  updateTarget(params): Promise<void>;
  deleteTarget(id): Promise<void>;
}
```

### Components

**`src/components/targets/target-list.tsx`** (new, ~180 lines)
- Renders targets with progress bars, current vs target value, direction, deadline
- Edit/delete actions per target
- "Add Target" button opens create form
- Props: `goalId` or `jobId` — fetches targets and evaluations on mount

**`src/components/targets/target-create-form.tsx`** (new, ~180 lines)
- Select data table (dropdown of project's tables)
- Select column (filtered to `number` type columns from selected table)
- Target value (number input)
- Direction selector (at least / at most / exactly)
- Aggregation selector (latest / sum / average / max / min / count)
- Optional label, optional deadline (date picker)

**`src/components/targets/target-progress-bar.tsx`** (new, ~60 lines)
- Color-coded bar: green (met), amber (>50%), red (<50%)
- Overdue indicator if deadline passed and not met
- Compact mode for inline display

### Integration Points

**`src/components/content/goal-detail-view.tsx`** — add a "Targets" section between the goal header and the jobs list, rendering `<TargetList goalId={goalId} />`

**`src/components/jobs/job-detail-panel.tsx`** — add target progress inline if job has targets

**`src/components/goals/goal-edit-sheet.tsx`** — optionally add target management (or keep it read-only here and manage via goal detail view)

---

## Build Sequence

### Phase 1: Data Layer
1. Shared types in `shared/src/index.ts`
2. Migration `agent/src/db/migrations/0028_add_targets.sql`
3. Register in `agent/src/db/migrations-data.ts`
4. Schema in `agent/src/db/schema.ts`
5. Queries in `agent/src/db/queries/targets.ts`
6. Evaluator in `agent/src/data-tables/target-evaluator.ts`

### Phase 2: IPC + MCP
7. IPC handlers `agent/src/ipc/handlers/targets.ts`
8. Register in `agent/src/ipc/handlers/index.ts`
9. MCP tools `agent/src/mcp-servers/data-tables/target-tools.ts`
10. Wire into `tools.ts`

### Phase 3: Prompt Integration
11. `agent/src/data-tables/target-prompt-builder.ts`
12. Modify `agent/src/executor/index.ts` — inject targets into prompts
13. Modify `agent/src/planner/system-jobs.ts` — target context in generation
14. Modify `agent/src/planner/prompts.ts` — mention targets in system job prompt

### Phase 4: Frontend
15. API functions in `src/lib/api.ts`
16. Store `src/stores/target-store.ts`
17. `src/components/targets/target-progress-bar.tsx`
18. `src/components/targets/target-list.tsx`
19. `src/components/targets/target-create-form.tsx`
20. Wire into `goal-detail-view.tsx`
21. Wire into `job-detail-panel.tsx`

### Phase 5: Tests + Verification
22. Unit tests for evaluator (aggregation logic, edge cases)
23. Unit tests for IPC handlers
24. E2E: create a data table with number column, add a target, verify progress bar renders
25. E2E: run a job that writes to a data table, verify target evaluation updates

---

## Files Summary

### New Files (10)
| File | Lines | Purpose |
|------|-------|---------|
| `agent/src/db/migrations/0028_add_targets.sql` | ~20 | DB migration |
| `agent/src/db/queries/targets.ts` | ~120 | CRUD queries |
| `agent/src/data-tables/target-evaluator.ts` | ~120 | Evaluation logic |
| `agent/src/data-tables/target-prompt-builder.ts` | ~80 | Prompt section builder |
| `agent/src/ipc/handlers/targets.ts` | ~100 | IPC handlers |
| `agent/src/mcp-servers/data-tables/target-tools.ts` | ~180 | MCP tool definitions |
| `src/stores/target-store.ts` | ~80 | Zustand store |
| `src/components/targets/target-progress-bar.tsx` | ~60 | Progress bar |
| `src/components/targets/target-list.tsx` | ~180 | Target list + management |
| `src/components/targets/target-create-form.tsx` | ~180 | Creation form |

### Modified Files (10)
| File | Change |
|------|--------|
| `shared/src/index.ts` | Add Target types (~50 lines) |
| `agent/src/db/schema.ts` | Add targets table (~20 lines) |
| `agent/src/db/migrations-data.ts` | Register migration 0028 |
| `agent/src/ipc/handlers/index.ts` | Register target handlers |
| `agent/src/mcp-servers/data-tables/tools.ts` | Import + wire target tools |
| `agent/src/executor/index.ts` | Inject target progress (~15 lines) |
| `agent/src/planner/system-jobs.ts` | Target context in generation (~15 lines) |
| `agent/src/planner/prompts.ts` | Mention targets in prompt (~3 lines) |
| `src/lib/api.ts` | Add target API functions (~30 lines) |
| `src/components/content/goal-detail-view.tsx` | Add Targets section (~15 lines) |
| `src/components/jobs/job-detail-panel.tsx` | Show target progress (~15 lines) |

---

## Verification

1. **Unit tests**: Evaluator aggregation logic (latest, sum, avg, max, min, count), progress calculation for each direction, edge cases (no rows, non-numeric data, missing column)
2. **IPC tests**: CRUD operations, evaluate endpoint, validation (must have exactly one of goalId/jobId)
3. **E2E flow**:
   - Create a project with a data table containing a number column
   - Add rows with numeric values
   - Create a goal with a target pointing to that column
   - Verify target progress bar renders correctly in goal detail view
   - Create a job that writes to the data table via MCP tools
   - Run the job, verify target evaluation updates
4. **Autopilot integration**: Verify system job generation prompt includes target info when targets exist
5. **Browser MCP**: Navigate to goal detail view at `http://localhost:1420`, confirm targets section renders with progress bars
