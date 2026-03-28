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
      "args": ["/path/to/src/server.py", "--transport", "stdio", "--run-id", "<runId>"],
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
  ├── effectivePrompt = BROWSER_MCP_PREAMBLE + BROWSER_CAPTCHA_PREAMBLE + job.prompt
  ├── InterventionWatcher(runId).start()  ← polls ~/.openhelm/interventions/
  ├── runnerFn({ ..., mcpConfigPath }) → spawns claude with --mcp-config --run-id
  ├── InterventionWatcher.stop()  ← cleanup after run
  └── removeMcpConfigFile(mcpConfigPath)  ← cleanup after run
```

Startup cleanup: `cleanupOrphanedConfigs()` and `cleanupOrphanedInterventions()` sweep their respective directories on agent boot to remove files left behind by crashes.

---

## File Structure

```
agent/
├── mcp-servers/
│   └── browser/
│       ├── src/
│       │   ├── server.py            # FastMCP server (97 tools, vendored + CAPTCHA tools)
│       │   ├── tool_timeout.py      # Per-tool timeout decorator
│       │   ├── captcha_detector.py  # DOM-based CAPTCHA pattern detection
│       │   ├── intervention.py      # User intervention request file writing
│       │   └── *.py                 # All other vendored modules
│       ├── tests/
│       │   ├── test_tool_timeout.py
│       │   ├── test_captcha_detector.py
│       │   └── test_intervention.py
│       ├── requirements.txt         # fastmcp, nodriver, pydantic, etc.
│       ├── pyproject.toml
│       └── .gitignore               # Excludes .venv/, __pycache__/, element_clones/
│
└── src/
    ├── mcp-servers/
    │   ├── browser-setup.ts         # Python venv detection & lazy setup
    │   └── mcp-config-builder.ts    # Generates --mcp-config JSON per run
    └── executor/
        └── intervention-watcher.ts  # Polls for CAPTCHA intervention requests → dashboard alerts
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

- `buildMcpConfig(runId, credentialsFilePath?)` — returns `McpConfigFile | null`; passes `--run-id` to server
- `writeMcpConfigFile(runId, credentialsFilePath?)` — writes to `~/.openhelm/mcp-configs/run-<runId>.json`
- `removeMcpConfigFile(path)` — post-run cleanup
- `cleanupOrphanedConfigs()` — startup sweep
- `BROWSER_MCP_PREAMBLE` — exported constant prepended to job prompts (browser preference)
- `BROWSER_CAPTCHA_PREAMBLE` — exported constant for CAPTCHA detection/handling instructions
- `BROWSER_CREDENTIALS_PREAMBLE` — exported constant for credential usage instructions

### `ipc/handlers/browser-mcp.ts` — Frontend IPC

- `browserMcp.status` → `{ venvReady, sourceAvailable, pythonAvailable }`
- `browserMcp.setup` → triggers `setupBrowserMcpVenv()`, returns `{ success, pythonPath, serverModule }`
- `browserMcp.focusBrowser` → activates Chrome via `osascript`, returns `{ success }`

### `intervention-watcher.ts` — CAPTCHA intervention file watcher

- `InterventionWatcher` class — polls `~/.openhelm/interventions/` every 5s for request files
- Creates `captcha_intervention` dashboard items when requests are found for the current run
- `cleanupOrphanedInterventions()` — startup sweep

### MCP preambles

When `openhelm-browser` is available for a run, three preambles may be prepended to `effectivePrompt`:

1. `BROWSER_MCP_PREAMBLE` — always; encourages Claude to prefer `mcp__openhelm-browser__*` tools
2. `BROWSER_CAPTCHA_PREAMBLE` — always; instructs Claude on CAPTCHA detection, auto-solve, and user intervention
3. `BROWSER_CREDENTIALS_PREAMBLE` — only when browser credentials are present

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
| `captcha_detector.py` | `mcp-servers/browser/tests/test_captcha_detector.py` | ✅ Full (all CAPTCHA types, visibility filtering, blocking priority, error handling) |
| `intervention.py` | `mcp-servers/browser/tests/test_intervention.py` | ✅ Full (file writing, screenshots, error cases, null run ID, unique IDs) |
| `intervention-watcher.ts` | `test/intervention-watcher.test.ts` | ✅ Full (detection, dashboard creation, dedup, cleanup, orphan sweep) |
| `browserMcp.focusBrowser` | `test/browser-mcp-handler.test.ts` | ✅ Full (success + failure) |
| `macos_background.py` | `mcp-servers/browser/tests/test_macos_background.py` | ✅ Full (bundle paths, PID lookup, deactivation, launch happy/error paths) |
| Background launch integration | `mcp-servers/browser/tests/test_background_launch.py` | ✅ Full (process tracking by PID, browser type ID, config set/reset) |

Run Python tests: `cd agent/mcp-servers/browser && python -m pytest tests/`
Run TypeScript tests: `cd agent && npm test`

---

## Browser Credential Injection (Plan 5b)

### Problem

When a browser automation job needs to log into a website, credentials must reach the browser. The original options exposed credential values to Claude Code:

- **Env var** — set as `$OPENHELM_*`; Claude Code can read via `echo $VAR`
- **Env + prompt** — value also injected into the prompt text, sent to Anthropic's servers

### Solution

A third injection mode: **"browser only"**. Credentials are written to a short-lived temp file, passed to the browser MCP server at startup, and immediately deleted. Claude Code knows credential names but never sees values. It calls named tools (`auto_login`, `inject_auth_cookie`, `inject_auth_header`) and the MCP server performs the actual credential use internally.

### Architecture

```
Executor
  ├── resolveCredentialsForJob()
  ├── Partition into envCredentials (allowBrowserInjection=false)
  │   └── inject as $OPENHELM_* env vars (existing behaviour)
  └── browserCredentials (allowBrowserInjection=true)
      ├── writeBrowserCredentialsFile(runId, creds) → ~/.openhelm/browser-credentials/run-<id>-<uuid>.json
      │   (0600 permissions, random UUID in filename)
      └── pass path to writeMcpConfigFile(runId, credentialsFilePath)
              └── appended as --credentials-file <path> to browser MCP server args

Browser MCP server (server.py)
  └── app_lifespan() startup:
      ├── _load_browser_credentials() reads --credentials-file
      ├── os.unlink() the file immediately (sub-second window on disk)
      └── _browser_credentials: Dict[str, dict] held in memory for run lifetime
```

### Temp File Security Properties

- **0600 permissions** — owner read/write only
- **Random UUID filename** — not predictable by Claude Code
- **Sub-second lifetime** — deleted in `app_lifespan()` before any tools are called
- **Redactor still applies** — browser credential secrets are added to `allSecrets[]` so any accidental log leakage is caught
- **Future hardening** — FIFO (named pipe) could replace the file to avoid disk entirely; skipped for v1 as stdin is reserved for MCP stdio transport

### New MCP Tools (credentials section)

| Tool | Input | Purpose |
|------|-------|---------|
| `list_browser_credentials` | — | Returns `[{name, type}]` — names/types only, never values |
| `auto_login` | `instance_id`, `credential_name`, selectors | Fills username/password form and submits |
| `inject_auth_cookie` | `instance_id`, `credential_name`, `cookie_name`, `domain` | Sets auth cookie from token credential |
| `inject_auth_header` | `instance_id`, `credential_name`, `header_name`, `prefix` | Sets Authorization header from token credential |

All tools return success/failure messages without echoing credential values.

### Prompt Hints

When browser credentials are present, two preamble lines are prepended to the run prompt:

```
BROWSER_CREDENTIALS_PREAMBLE — "Browser credentials are pre-loaded securely…use list_browser_credentials…"
BROWSER_MCP_PREAMBLE         — "A built-in browser MCP server is available…"
```

And a hint section appended to the prompt:
```
Browser credentials available (use browser MCP tools — values are pre-loaded securely):
- "GitHub Login" (username_password) — use auto_login
- "API Token" (token) — use inject_auth_cookie or inject_auth_header
```

### Data Model Changes

- `credentials.allow_browser_injection` column (integer boolean, default 0) — migration `0025_add_browser_injection.sql`
- `run_credentials.injection_method` enum extended with `"browser"` value
- Shared types: `Credential.allowBrowserInjection`, `CreateCredentialParams.allowBrowserInjection`, `UpdateCredentialParams.allowBrowserInjection`

### Frontend UI Changes

The two-state `allowPromptInjection` toggle is replaced with a three-option radio group:

| Mode | Fields | Visual |
|------|--------|--------|
| Environment variable | `allowPromptInjection=false, allowBrowserInjection=false` | Green shield badge: "Env Only" |
| Env + prompt | `allowPromptInjection=true, allowBrowserInjection=false` | Amber badge: "Env + Prompt" |
| Browser only | `allowPromptInjection=false, allowBrowserInjection=true` | Blue badge: "Browser" |

### New Files

- `agent/src/credentials/browser-credentials.ts` — `writeBrowserCredentialsFile()` / `removeBrowserCredentialsFile()`
- `agent/src/db/migrations/0025_add_browser_injection.sql`
- `agent/test/browser-credentials.test.ts`

### Residual Risks

Claude Code *could* use `execute_script` to read cookies after injection, or screenshot a filled form. This is inherent to any browser automation grant and cannot be fully prevented without removing those tools. The "browser only" mode is strictly better than env vars and prompt injection for credential confidentiality.

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

---

## CAPTCHA/Robot-Check Handling (Plan 5c)

### Problem

When navigating pages during browser automation, Claude Code may encounter CAPTCHA challenges (reCAPTCHA, hCaptcha, Cloudflare Turnstile, challenge pages). Previously there was no detection or handling — Claude would either try a different approach, give up, or stall until the silence timeout fired.

### Solution — Three-Layer Escalation

1. **Detect + Auto-solve**: `detect_captcha` MCP tool inspects the DOM for known CAPTCHA patterns. Claude uses its vision capabilities (screenshot analysis) to attempt solving checkbox CAPTCHAs, image challenges, text CAPTCHAs, and waits for Cloudflare auto-resolve.

2. **Find Alternatives**: `BROWSER_CAPTCHA_PREAMBLE` instructs Claude to reason about alternative paths (different URL, API endpoint, alternate method) if auto-solve fails.

3. **Alert User**: `request_user_help` MCP tool writes a signal file to `~/.openhelm/interventions/`. The agent's `InterventionWatcher` detects it and creates a `captcha_intervention` dashboard item with native notification. The dashboard shows a "Focus Browser" CTA that brings Chrome to the foreground via osascript. Claude enters a polling loop (screenshot every 30s, 5-minute timeout) until the CAPTCHA is gone.

### File Structure

```
agent/
├── mcp-servers/browser/src/
│   ├── captcha_detector.py      # DOM-based CAPTCHA detection (reCAPTCHA, hCaptcha, Turnstile, etc.)
│   ├── intervention.py          # Writes intervention request files + takes screenshots
│   └── server.py                # Registers detect_captcha and request_user_help tools (captcha section)
│
├── src/executor/
│   └── intervention-watcher.ts  # Polls ~/.openhelm/interventions/ for request files → dashboard items
│
├── src/ipc/handlers/
│   └── browser-mcp.ts           # browserMcp.focusBrowser handler (osascript Chrome activation)
│
└── src/mcp-servers/
    └── mcp-config-builder.ts    # BROWSER_CAPTCHA_PREAMBLE + --run-id arg plumbing
```

### Communication Flow

```
MCP server writes → ~/.openhelm/interventions/req-{uuid}.json
  ↓ (file-based signaling)
InterventionWatcher polls (5s interval) → detects file
  → creates dashboard item (type: captcha_intervention)
  → emits dashboard.created event → native notification
  → deletes consumed request file
Meanwhile Claude polls page state (screenshot every 30s)
  → outputs status messages (prevents silence timeout)
  → when CAPTCHA gone → continues task
```

### Key Design Decisions

- **Non-blocking MCP tool**: `request_user_help` returns immediately. Claude polls via screenshots (avoids silence timeout).
- **File-based signaling**: Same pattern as browser credentials. MCP → agent communication without direct IPC coupling.
- **Page-state resolution**: Claude detects CAPTCHA removal by inspecting screenshots, not via explicit user signal.
- **New dashboard type**: `captcha_intervention` — distinct icon (Monitor, blue) and "Focus Browser" CTA button.
- **`--run-id` arg**: Passed to MCP server so intervention requests include run context for proper routing.

---

## Background Browser Launch (Plan 5d)

### Problem

When the OpenHelm browser MCP server spawns Chrome via nodriver, Chrome calls `[NSApp activateIgnoringOtherApps:YES]` during window creation on macOS. This steals focus from the user's current application and briefly shows the browser window on top — disruptive during autonomous background job runs.

### Solution — Two-Phase Background Launch

On macOS (non-headless mode), the browser manager uses a two-phase launch:

1. **Phase 1 — Background spawn via Launch Services**: Chrome is launched with `open -g -n -a "Google Chrome.app" --args ...` instead of direct subprocess execution. The `-g` flag instructs macOS Launch Services to suppress initial activation.

2. **Phase 2 — nodriver connects to existing instance**: The nodriver Config receives pre-set `host`/`port` values, triggering its `connect_existing` code path which skips subprocess creation and connects via CDP to the already-running Chrome.

An AppleScript deactivation (`set visible of process "Google Chrome" to false`) runs as a safety net after launch, reclaiming focus within ~100ms if Chrome briefly activated despite `-g`.

Falls back gracefully to normal nodriver launch if background launch fails or on non-macOS platforms.

### Architecture

```
BrowserManager.spawn_browser(options)
  └── _try_background_launch(config, executable, options)
        ├── is_macos() && !headless && options.background?
        │     ├── NO → return False (use normal nodriver launch)
        │     └── YES ↓
        ├── Reserve free TCP port
        ├── Set config.host / config.port (triggers nodriver connect_existing)
        ├── Generate chrome_args via config()
        └── launch_browser_background(executable, chrome_args, port)
              ├── Derive .app bundle path from executable
              ├── subprocess.Popen(['open', '-g', '-n', '-a', bundle, '--args'] + args)
              ├── find_pid_on_port(port) — retries up to 5s for Chrome startup
              ├── deactivate_app(app_name) — AppleScript safety net
              └── return PID (or None on failure → fallback)
```

### New Files

- `agent/mcp-servers/browser/src/macos_background.py` — macOS background launch utilities
- `agent/mcp-servers/browser/tests/test_macos_background.py` — 24 tests for background launch
- `agent/mcp-servers/browser/tests/test_background_launch.py` — 13 tests for integration + process tracking

### Modified Files

- `browser_manager.py` — Two-phase launch in `spawn_browser()`, new `_try_background_launch()`, `_configure_tab()`, `_identify_browser_type()` helpers
- `process_cleanup.py` — New `track_browser_process_by_pid(instance_id, pid)` for externally-launched Chrome
- `models.py` — `BrowserOptions.background: bool = True`
- `server.py` — `spawn_browser` tool accepts `background` parameter (default True)

### API

`spawn_browser(background=True)` — default behavior on macOS. Set `background=False` to allow Chrome to appear normally (e.g., for debugging or when user wants to watch automation). On non-macOS platforms the parameter is ignored.

### Test Coverage

| File | Test File | Tests |
|------|-----------|-------|
| `macos_background.py` | `tests/test_macos_background.py` | 24 (bundle path extraction, app name, port, platform detection, PID lookup, deactivation, full launch happy/error paths) |
| `browser_manager.py` + `process_cleanup.py` | `tests/test_background_launch.py` | 13 (process tracking by PID, browser type identification, background launch skip conditions, config set/reset on success/failure) |
