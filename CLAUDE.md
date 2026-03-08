# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

**OpenOrchestra** is a local-first macOS desktop application that turns high-level goals into scheduled, self-correcting Claude Code jobs. Users type a goal ("Improve test coverage"), the system generates a plan of Claude Code tasks, and those tasks run autonomously in the background on a schedule.

The project is currently in the planning/bootstrapping phase. The `docs/` directory contains the PRD (`prd.md`), v1 implementation plan (`plan_1_v1.md`), and competitor research (`competitors.md`).

---

## Tech Stack (Locked)

| Layer | Choice |
|---|---|
| Desktop framework | Tauri 2 (Rust shell + native WebView) |
| Frontend | React 18 + TypeScript |
| Styling | Tailwind CSS 4 + shadcn/ui |
| Local database | SQLite via `better-sqlite3` |
| ORM | Drizzle ORM |
| Background agent | Node.js sidecar process |
| IPC (UI ↔ agent) | Tauri stdin/stdout sidecar (JSON-RPC) |
| AI planning/summarisation | Anthropic SDK (direct API, `claude-sonnet-4-5`) |
| State management | Zustand |

**Prerequisites**: Node 20+, Rust toolchain, Xcode Command Line Tools.

---

## Development Commands

```bash
# Root — start Tauri dev server (frontend + Rust shell + agent sidecar)
npm run tauri dev

# Frontend only (Vite)
npm run dev

# Build the agent sidecar
cd agent && npm run build

# Run Drizzle migrations
cd agent && npx drizzle-kit migrate

# Type-check everything
npm run typecheck

# Lint
npm run lint
```

> These commands are defined in the implementation plan but the project is not yet scaffolded. Update this section once the Tauri scaffold exists.

---

## Repository Structure

```
openorchestra/
├── src-tauri/               # Tauri Rust shell (keep minimal — thin wrappers only)
│   ├── src/
│   │   ├── main.rs          # Entry point, sidecar launch, window setup
│   │   └── lib.rs           # Tauri commands (thin wrappers only)
│   └── Cargo.toml
│
├── src/                     # React frontend
│   ├── components/
│   │   ├── ui/              # shadcn/ui primitives
│   │   ├── layout/          # Sidebar, shell, navigation
│   │   ├── goals/
│   │   ├── jobs/
│   │   ├── runs/
│   │   ├── onboarding/
│   │   └── shared/
│   ├── hooks/               # Custom React hooks
│   ├── stores/              # Zustand stores
│   ├── lib/                 # API client (agent-client.ts), type utils
│   └── App.tsx
│
├── agent/                   # Node.js background agent (sidecar)
│   ├── src/
│   │   ├── index.ts         # Entry point, IPC server init
│   │   ├── scheduler/       # Job queue and scheduling engine
│   │   ├── executor/        # Claude Code process management
│   │   ├── planner/         # Goal → job plan generation (Anthropic API)
│   │   ├── db/              # Drizzle schema, migrations, queries
│   │   ├── claude-code/     # ClaudeCodeRunner abstraction layer
│   │   └── ipc/             # JSON-RPC server (stdin/stdout)
│   └── package.json
│
├── shared/                  # Types shared between frontend and agent
│   └── types.ts             # IpcRequest, IpcResponse, IpcEvent
│
└── docs/                    # Planning documents
```

---

## Two Distinct Claude Integrations

**Never conflate these. Keep them in completely separate modules.**

1. **Claude Code CLI** — the agentic tool users subscribe to. Used exclusively for *running jobs*. Spawned as a child process from `agent/src/claude-code/ClaudeCodeRunner.ts`. All CLI invocations must go through this single module — never call Claude Code flags directly from the scheduler.

2. **Anthropic API** (`claude-sonnet-4-5`) — used for goal planning, prompt clarification, run summarisation, and failure triage. Simple completions; not agentic. Requires a separate API key the user provides in settings.

---

## Data Model

```
Project      id, name, description, directory_path, created_at, updated_at
Goal         id, project_id, description, status(active|paused|archived), created_at
Job          id, goal_id (nullable), project_id, name, description, prompt,
             schedule_type(once|interval|cron), schedule_config(JSON),
             is_enabled, next_fire_at, created_at, updated_at
Run          id, job_id, status(queued|running|succeeded|failed|permanent_failure|cancelled),
             trigger_source(scheduled|manual|corrective),
             started_at, finished_at, exit_code, summary, created_at
RunLog       id, run_id, sequence, stream(stdout|stderr), text, timestamp
Settings     key, value, updated_at
```

Database lives at `~/.openorchestra/openorchestra.db`. WAL mode enabled; foreign keys enforced.

---

## IPC Protocol (UI ↔ Agent)

The agent communicates via stdin/stdout using newline-delimited JSON:

- **Requests** (UI → agent): `{ id: string, method: string, params?: unknown }`
- **Responses** (agent → UI): `{ id: string, result?: unknown, error?: { code, message } }`
- **Events** (agent → UI, unprompted): `{ event: string, data: unknown }` — e.g. `run.log`, `run.statusChanged`

Frontend uses `src/lib/agent-client.ts` for all agent communication. Events are re-dispatched as `CustomEvent` on `window` under the name `agent:<event>`.

---

## Background Agent Architecture

The agent owns three subsystems that must be fault-isolated:

1. **Scheduler** — 1-minute tick; enqueues runs when `next_fire_at <= now`
2. **Executor** — worker pool (default concurrency: 1); spawns Claude Code, streams logs to DB, updates run status
3. **Watchdog** — per-run timeout (default 30 min); SIGTERMs hung processes, marks run as failed

A UI crash must never interrupt a running job.

---

## Key Architecture Rules

- **`ClaudeCodeRunner` is the only entry point** to the Claude Code CLI. Pin a minimum supported CLI version; warn users if their installed version is below it.
- **No plan runs without user approval.** The plan review step is mandatory before any job fires for the first time.
- **Jobs can exist without a goal** (`goal_id` is nullable). Manual job creation is a first-class feature.
- **File size limit**: keep code files ≤ 225 lines; split into submodules when a file grows beyond this.
- **Log to stderr** from the agent (stdout is reserved for IPC).
- **The hosted tier** (v3+) is a separate business layer; the OSS version runs fully locally with no external services in v1.
