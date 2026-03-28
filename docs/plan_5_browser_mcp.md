# Plan 5: Built-in Browser MCP Server

## Problem

OpenHelm job runs experienced recurring 600-second silence timeouts when Claude Code used `stealth-browser-mcp` for browser automation. Root cause: `stealth-browser-mcp` has no per-tool-call timeout — when Chrome's CDP connection stalls (e.g. on complex pages like Reddit), the MCP tool call blocks forever. Claude Code produces no output, OpenHelm's `InteractiveDetector` fires after 600s, kills the run, and marks it `failed`.

## Solution

Copy `stealth-browser-mcp` into the OpenHelm repo as a built-in MCP server with per-tool-call timeouts. Inject it into every Claude Code job run via `--mcp-config` so users get browser automation out of the box without configuring an external MCP server.

---

## Architecture

### How `--mcp-config` Works

Claude Code CLI accepts a `--mcp-config <path>` flag pointing to a JSON file that defines additional MCP servers to start for that session:

```json
{
  "mcpServers": {
    "openhelm-browser": {
      "command": "/path/to/.venv/bin/python",
      "args": ["/path/to/src/server.py", "--transport", "stdio"],
      "cwd": "/path/to/browser"
    }
  }
}
```

Claude Code starts the server subprocess at session start and stops it when the session ends. OpenHelm writes a per-run config file to `~/.openhelm/mcp-configs/run-<runId>.json` and passes its path via `--mcp-config`. The file is deleted after the run completes.

### Per-Run Lifecycle

```
executeRun()
  ├── isVenvReady()? → writeMcpConfigFile(runId) → mcpConfigPath
  ├── effectivePrompt = BROWSER_MCP_PREAMBLE + job.prompt (if mcpConfigPath set)
  ├── runnerFn({ ..., mcpConfigPath }) → spawns claude with --mcp-config
  └── removeMcpConfigFile(mcpConfigPath)  ← cleanup after run
```

Startup cleanup: `cleanupOrphanedConfigs()` sweeps `~/.openhelm/mcp-configs/` on agent boot to remove files left behind by crashes.

---

## File Structure

```
agent/
├── mcp-servers/
│   └── browser/
│       ├── src/
│       │   ├── server.py            # FastMCP server (95 tools, vendored from stealth-browser-mcp)
│       │   ├── tool_timeout.py      # Per-tool timeout decorator (NEW)
│       │   └── *.py                 # All other vendored modules
│       ├── requirements.txt         # fastmcp, nodriver, pydantic, etc.
│       ├── pyproject.toml
│       └── .gitignore               # Excludes .venv/, __pycache__/, element_clones/
│
└── src/
    └── mcp-servers/
        ├── browser-setup.ts         # Python venv detection & lazy setup
        └── mcp-config-builder.ts    # Generates --mcp-config JSON per run
```

---

## Key Components

### `tool_timeout.py` — Per-tool timeout decorator

Wraps every MCP tool handler with `asyncio.wait_for()`. On timeout, returns an error dict instead of hanging:

```python
DEFAULT_TIMEOUT_S = 60   # Most tools
EXTENDED_TIMEOUT_S = 120  # Heavy tools (take_screenshot, get_page_content, etc.)

@with_timeout()
async def take_screenshot(...):
    ...
```

Applied via the `section_tool()` decorator in `server.py` — a single wrap point covering all 95 tools.

### `browser-setup.ts` — Venv management

- `detectPython()` — tries `python3.13 → python3.12 → python3.11 → python3.10 → python3 → python`; accepts 3.10–3.13 only (3.14+ excluded because `pydantic-core` uses PyO3 which caps at 3.13 as of March 2026)
- `isVenvReady()` — checks if `.venv/bin/python` exists
- `setupBrowserMcpVenv()` — creates venv + `pip install -r requirements.txt` (idempotent)
- `getBrowserMcpPaths()` — returns paths if ready, null otherwise

Paths resolve relative to the bundled agent binary (`__dirname`):
- Dev (`agent/dist/`): `../mcp-servers/browser/` → `agent/mcp-servers/browser/`
- Prod (`src-tauri/binaries/`): `../mcp-servers/browser/` → `src-tauri/mcp-servers/browser/`

Override via `OPENHELM_BROWSER_MCP_DIR` env var.

### `mcp-config-builder.ts` — Config file generation

- `buildMcpConfig()` — returns `McpConfigFile | null`
- `writeMcpConfigFile(runId)` — writes to `~/.openhelm/mcp-configs/run-<runId>.json`
- `removeMcpConfigFile(path)` — post-run cleanup
- `cleanupOrphanedConfigs()` — startup sweep
- `BROWSER_MCP_PREAMBLE` — exported constant prepended to job prompts (see below)

### `ipc/handlers/browser-mcp.ts` — Frontend IPC

- `browserMcp.status` → `{ venvReady, sourceAvailable, pythonAvailable }`
- `browserMcp.setup` → triggers `setupBrowserMcpVenv()`, returns `{ success, pythonPath, serverModule }`

### MCP preference preamble

When `openhelm-browser` is available for a run, `BROWSER_MCP_PREAMBLE` is prepended to `effectivePrompt` in the executor. This encourages Claude to prefer `mcp__openhelm-browser__*` tools over any globally-installed browser MCP unless the job prompt explicitly requests a different one.

---

## Build Integration

`agent/scripts/build.mjs` copies `agent/mcp-servers/browser/` → `src-tauri/mcp-servers/browser/` during build, excluding `.venv/`, `__pycache__/`, and `element_clones/`. The venv is created at runtime (not bundled).

---

## Python Version Constraint

`pydantic-core` (a dependency of `pydantic` which `fastmcp` requires) uses PyO3 for its Rust bindings. As of March 2026, PyO3 supports Python ≤3.13. Python 3.14 was released but breaks `pydantic-core` compilation. `detectPython()` therefore caps the accepted range at 3.13. When pydantic-core ships 3.14+ wheels, raise the cap in `browser-setup.ts`.

---

## Test Coverage

| File | Test File | Coverage |
|------|-----------|---------|
| `tool_timeout.py` | `mcp-servers/browser/tests/test_tool_timeout.py` | ✅ Full (constants, timeout, error dict, function names, auto-selection) |
| `browser-setup.ts` | `test/browser-setup.test.ts` | ✅ Full (detectPython all branches, isVenvReady, isSourceAvailable, getBrowserMcpPaths, setupBrowserMcpVenv happy path + error cases) |
| `mcp-config-builder.ts` | `test/mcp-config-builder.test.ts` | ✅ Full (buildMcpConfig, writeMcpConfigFile null + happy path, removeMcpConfigFile, cleanupOrphanedConfigs with files) |
| `ipc/handlers/browser-mcp.ts` | `test/browser-mcp-handler.test.ts` | ✅ Full (status all states, setup success + error) |
| Executor preamble injection | `test/executor.test.ts` | ✅ Full (prepended when venv ready, absent when not) |

Run Python tests: `cd agent/mcp-servers/browser && python -m pytest tests/`
Run TypeScript tests: `cd agent && npm test`

---

## Operations

### First-time setup

Users trigger `browserMcp.setup` from the frontend (or it can be called via IPC). This creates the venv and installs deps (~30–90s on first run depending on network). Subsequent runs are instant.

### Manual setup via curl (dev/testing)

```bash
curl -s -X POST http://localhost:1421/ipc \
  -H "Content-Type: application/json" \
  -d '{"id":"1","method":"browserMcp.setup","params":{}}'
```

### Checking status

```bash
curl -s -X POST http://localhost:1421/ipc \
  -H "Content-Type: application/json" \
  -d '{"id":"1","method":"browserMcp.status","params":{}}'
# → {"result":{"venvReady":true,"sourceAvailable":true,"pythonAvailable":true}}
```

### Verifying a run gets --mcp-config

```bash
ps aux | grep claude | grep mcp-config
# Should show: claude --print ... --mcp-config ~/.openhelm/mcp-configs/run-<id>.json
```
