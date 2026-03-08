- runClauderun
    - About
        
        # runCLAUDErun - Scheduler for Claude Code on macOS
        
        ![runCLAUDErun Logo](/icon.png)
        
        # runCLAUDErun
        
        ## Easily schedule Claude tasks to run in the background
        
        Wake up to finished work every morning. Stay ahead of the curve while others are still catching up.
        
        [Download for macOS](https://github.com/runCLAUDErun/releases/releases/download/v2.4.1/runCLAUDErun-2.4.1-arm64.dmg)
        
        or download for[Intel (older Macs)](https://github.com/runCLAUDErun/releases/releases/download/v2.4.1/runCLAUDErun-2.4.1.dmg)
        
        ![runCLAUDErun - Scheduler for Claude Code (macOS) | Product Hunt](https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1023657&theme=light&t=1759777841417)
        
        macOS 10.13+Apple Silicon & Intel
        
        ![runCLAUDErun App Interface - Click to watch demo](/app-screenshot.png)
        
        Watch 2-min Demo
        
        ## Everything You Need
        
        Powerful automation without the complexity
        
        ### Runs Locally
        
        Everything runs on your Mac. Your data stays with you.
        
        ### Background Execution
        
        Schedule tasks to run at specific times, even when you're away.
        
        ### Native macOS App
        
        Clean interface that fits naturally into your workflow.
        
        ### Flexible Scheduling
        
        Set tasks to run once, daily, weekly, or on custom intervals.
        
        ### Automatic Updates
        
        New features and improvements download in the background.
        
        ### Task History
        
        View logs and outputs from past runs.
        
        [Get Started Now](https://github.com/runCLAUDErun/releases/releases/download/v2.4.1/runCLAUDErun-2.4.1-arm64.dmg)
        
        ## Support Us on Product Hunt Today! 🚀
        
        We're featured on Product Hunt! Your upvote helps more developers discover runCLAUDErun and shows support for our mission to make Claude automation accessible to everyone.
        
        ![runCLAUDErun - Scheduler for Claude Code (macOS) | Product Hunt](https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1023657&theme=dark&t=1759777841417)
        
        Every vote counts! Help us reach #1 Product of the Day
        
        ## What People Are Saying
        
        Feedback from early users
        
        "Way easier than dealing with cron jobs. I can actually understand what's running when."
        
        Sarah Chen
        
        DevOps Engineer
        
        "Clean interface, solid execution. Does exactly what I need it to do."
        
        Marcus Rodriguez
        
        Full Stack Developer
        
        "Love that everything runs locally. No cloud dependencies, no privacy concerns."
        
        Alex Thompson
        
        Data Scientist
        
        ## Frequently Asked Questions
        
        ### What is runCLAUDErun?
        
        runCLAUDErun is a native macOS app that lets you schedule and automate Claude Code tasks. Instead of manually running commands or dealing with cron jobs, you can set up tasks to run automatically at specific times or intervals.
        
        ### How can I schedule Claude Code tasks?
        
        Download runCLAUDErun for macOS. It gives you a simple interface to schedule any Claude Code task to run automatically at specific times or on recurring schedules. [Learn how to automate Claude](https://www.notion.so/how-to-automate-claude).
        
        ### Do I need a Claude subscription?
        
        Yes, runCLAUDErun works with the official Claude Code from Anthropic. You'll need an active Claude subscription and Claude Code installed on your Mac.
        
        ### How do I run Claude Code tasks automatically?
        
        runCLAUDErun lets you automate Claude Code tasks without writing scripts or cron jobs. Just set your task, pick a schedule, and it runs in the background.
        
        ### What can I automate with runCLAUDErun?
        
        Anything you can do with Claude Code - code reviews, content generation, data analysis, report generation, and more. If you can write a Claude prompt for it, you can schedule it.
        
        ### Is there a GUI for scheduling Claude Code?
        
        Yes, runCLAUDErun provides a native macOS interface for scheduling and managing Claude Code tasks. No command line required.
        
        ### Does it work on Apple Silicon and Intel Macs?
        
        Yes! runCLAUDErun supports both Apple Silicon (M1/M2/M3) and Intel Macs running macOS 10.13 or later.
        
        ### What's the easiest way to automate Claude on Mac?
        
        runCLAUDErun is the simplest solution for Mac users. Download the app, create your tasks, set schedules, and let it run automatically.
        
        ### Is runCLAUDErun free?
        
        Yes, runCLAUDErun is completely free to download and use.
        
        ### Do I have to sign up for this?
        
        No, you don't need to sign up, login or pay anything. We recommend you leave your email below, however, to get regular updates.
        
        [View All FAQs](https://www.notion.so/faq)
        
        ## Stay Updated
        
        Get notified about new features and updates
        
        Subscribe
        
    - Technical and UX design
        
        This architecture and UX together implement what the public FAQ describes: a native macOS GUI to define, schedule, and monitor Claude Code tasks and hooks, without requiring users to touch cron or the command line.runclaude+1
        
        1. The next morning they open the app, go to **History**, click the last run, and inspect the log output to see exactly what Claude produced.[[runclauderun](https://runclauderun.com/faq)]
        2. The background agent, via launchd, fires every weekday, spawns the CLI, respects any project hooks, collects logs, and marks runs as succeeded or failed.runclauderun+1
        3. They add a **Schedule** for weekdays at 8:00 AM, with timezone set to their local time.runclaude+1
        4. They create a **Task** called “Morning Status Summary”, pick the repo, define the Claude command via the builder (headless mode, specific model, and context limit), and test run it once.[[runclauderun](https://runclauderun.com/faq)]
        5. User opens runCLAUDErun, runs onboarding to detect `claude` CLI, and connects to their project folder.runclaude+1
        
        A typical usage flow, combining the design above:
        
        ## Example end‑to‑end flow
        
        ---
        
        - Provide sample tasks templates like “Daily codebase review” or “Weekly documentation update” that users can enable with minimal edits.
        - Check if `claude` CLI is installed; if not, show a friendly step-by-step with copyable install commands, not requiring deep terminal knowledge.
        
        To align with “no command line knowledge required”, onboarding should:
        
        **5.2 First-run onboarding**
        
        - Security:
            - Manage API keys (delegated to system or CLI config).
            - List of approved project directories with ability to remove access.
        - Notifications:
            - Toggles for success/failure notifications.
        - Concurrency:
            - Max concurrent runs slider.
        - Claude Code integration:
            - Path to `claude` binary (auto-detect with “Test” button).
            - Default working directory.
            - CLI version display.
        
        Settings pane with:
        
        **5.1 Settings**
        
        ## 5. Settings and onboarding UX
        
        ---
        
        These support “view execution logs and results in the task history” described in the FAQ.[[runclauderun](https://runclauderun.com/faq)]
        
        - When a Run is selected:
            - Header:
                - Task name, schedule info (if any).
                - Start and finish times, duration, exit code.
                - Quick buttons: “Re-run with same settings”, “Duplicate as new Task”.
            - Log viewer:
                - Split view or single log area with:
                    - Streaming output for active runs.
                    - Color-coded stdout/stderr.
                    - Search bar with highlight.
                    - Option to copy log or export to a file.
            - Summary:
                - Compact text summary at the top.
                - If available, a simple status explanation like “Claude Code completed successfully” or “Failed: network timeout.”
        
        **4.2 Run detail**
        
        - Filters:
            - Date range picker.
            - Task multi-select.
            - Status filter.
        - History tab shows a table:
            - Run time
            - Task name
            - Trigger (Scheduled / Manual)
            - Status badge (Succeeded, Failed, Running)
            - Duration
        
        **4.1 History list**
        
        ## 4. History, logs, and results UX
        
        ---
        
        - Inline toggle to quickly pause/resume schedules without deleting them.
        - Table with columns:
            - Task name
            - Type
            - Next run
            - Enabled toggle
        
        In the Schedules tab:
        
        **3.2 Schedule list**
        
        This design directly supports “one-time execution”, “daily recurring”, “weekly recurring”, and “custom intervals” mentioned in the FAQ.runclaude+1
        
        - “Preview next 3 run times” mini-component to give confidence.
        - “Add Schedule” button opening a right-side sheet:
            - Schedule type selector:
                - One-time
                - Daily
                - Weekly
                - Custom interval
            - For each type:
                - One-time:
                    - Date/time picker.
                - Daily:
                    - Time of day picker.
                - Weekly:
                    - Time of day picker, weekday checkboxes.
                - Custom interval:
                    - Numeric interval input (“Run every N minutes/hours”).
                    - Optional start/end datetime pickers.
            - Timezone indicator:
                - Defaults to system.
                - Link “Use different timezone” to change at the task or schedule level.
        
        From Task detail:
        
        **3.1 Add schedule**
        
        ## 3. Scheduling UX
        
        ---
        
        - From the Task detail screen:
            - “Run now” button:
                - Starts an immediate Run.
                - Opens a log view pane showing streaming output.
            - “Duplicate as new Task” for quick variations.
        
        **2.2 Test run**
        
        This supports “all Claude Code commands and flags” while remaining approachable.[[runclauderun](https://runclauderun.com/faq)]
        
        - Step 2: Command builder
            - Non-technical mode:
                - Prominent fields:
                    - “Claude Code action” dropdown (e.g., “Run code”, “Refactor project”, “Generate tests”).
                    - Prompt text area.
                    - Model dropdown (showing available Claude models).
                    - Context limit slider or numeric input.
                    - Headless mode toggle.
                - Advanced flags collapsible section:
                    - Extra CLI flags as key-value rows.
            - Expert mode:
                - A raw command text box showing the full `claude ...` command.
                - Syntax highlighting and validation (errors surfaced inline).
                - “Parse to form” button to sync back into the structured view.
        - Step 1: Basic info
            - Name field (e.g., “Nightly Code Review”).
            - Project directory selector (file picker).
            - Optional description.
        - Entry points:
            - “New Task” button in toolbar.
            - “+” in Tasks sidebar.
        
        **2.1 New Task flow**
        
        ## 2. Task creation and command builder UX
        
        ---
        
        - Each section has a corresponding list/detail layout to support power users managing multiple tasks.runclaude+1
        - Sidebar with three sections:
            - Tasks
            - Schedules
            - History (or Runs)
        
        Top-level structure:
        
        - **Runs** represent “what actually happened”.
        - **Schedules** represent “when to run it”.
        - **Tasks** represent “what to run” (Claude Code command + project).
        
        The primary mental model is “Tasks & Schedules”:
        
        ## 1. Main navigation and mental model
        
        This UX design focuses on meeting the behaviors described in the FAQ: defining tasks, building commands, scheduling, and inspecting history without using the terminal.runclaude+1
        
        ## UX design overview
        
        ---
        
        - Environment variables and API keys must never be logged.
        - The app should:
            - Restrict execution to user-approved directories.
            - Clearly surface which directories a task will use.
        - If sandboxed (Mac App Store style), it must obtain user permission to access:
            - Project directories (through security-scoped bookmarks).
            - Any other file system location the CLI needs.
        
        Because the app runs arbitrary CLI commands:
        
        **4.2 Sandboxing and permissions**
        
        - Provides status (agent running/not running) and a “Restart agent” action in a settings screen.
        - On first launch, sets up the agent and optionally asks user permission.
        
        The main UI app:
        
        - Install a per-user `launchd` agent plist in `~/Library/LaunchAgents/com.runclauderun.daemon.plist` with:
            - `ProgramArguments` pointing to the background agent binary.
            - `KeepAlive` set, to automatically restart on crash or logout/login.
            - Appropriate `ProcessType` and `RunAtLoad`.
        
        To allow background scheduling:
        
        **4.1 Launchd integration**
        
        ## 4. macOS integration and security
        
        ---
        
        - A validation step ensures:
            - Required flags for certain modes are present.
            - No conflicting flags.
            - CLI version compatibility.
        - Parsed **AST** or array of `{flag, value, enabled}` objects to:
            - Toggle flags on/off via UI without corrupting the command.
            - Allow safe editing of prompts, model names, context limits, etc.
        - Original **string** (for display and export).
        
        Internally, a Task’s commandTemplate could be represented as:
        
        The “flexible command builder interface” mentioned in the FAQ implies runCLAUDErun allows users to construct and persist arbitrarily complex Claude Code commands and flags.[[runclauderun](https://runclauderun.com/faq)]
        
        **3.3 Command builder configuration**
        
        - API keys or secrets:
            - Prefer the macOS **Keychain** for storing Claude API keys, if the CLI supports them via environment or config.
            - The app surfaces a UI to configure them, but they never live in plain text on disk.
        - Application preferences (like paths, concurrency, default model, etc.) stored in `UserDefaults`.
        
        **3.2 Preferences and secure storage**
        
        - For log data:
            - Either store as row chunks in SQLite (simplest, good enough for moderate log sizes).
            - Or store log files per run under `~/Library/Application Support/runCLAUDErun/logs/<runId>.log` with DB rows holding file metadata.
        - Use **SQLite** via Core Data or a lightweight ORM as the primary data store.
        
        To provide a searchable history and multi-task management:
        
        **3.1 Storage choice**
        
        ## 3. Configuration and persistence
        
        ---
        
        - Status updates:
            - On process start: `status=running`, `startedAt=now`.
            - On process exit:
                - `status = succeeded` if `exitCode == 0`, else `failed`.
                - `finishedAt=now`, `exitCode` set.
            - Optionally triggers a macOS user notification for completed runs (with a setting for success/failure thresholds).
        - Output collection:
            - The agent reads `stdout` and `stderr` asynchronously, chunking into `RunLogChunk` records in the DB.
            - A run-level summary can be built:
                - First N lines of output.
                - Optional short “parsed summary” created after completion by running a local summarizer or just truncating logs.
            - As chunks are stored, the agent also streams them via IPC to any UI client that is currently viewing that Run.
        - Hooks:
            - The FAQ explicitly says “respects and executes any Claude Code hooks you’ve configured in your projects.”[[runclaude](https://runclaude.run/faq)]
            - This is done by simply invoking the CLI in the **project directory** where `.clauderc` or hook configuration files live; `claude` handles the hooks, so the app does not need to understand them.
            - To ensure hooks run, the agent does not wrap or override the CLI in a way that would bypass pre/post-run hooks.
        - Process spawn:
            - Uses `Process` (formerly `NSTask`) with:
                - `launchPath` = path to `claude` CLI.
                - `arguments` = parsed args array.
                - `currentDirectoryPath` = task’s `workingDirectory`.
                - Piped `stdout` and `stderr` streams.
        - Command construction:
            - Each Task stores a **command template** that supports all Claude Code commands and flags (including headless, context limits, specific models, custom hooks, etc.) as the FAQ states.runclaude+1
            - A small **CommandBuilder** replaces placeholders (like `{PROJECT_PATH}`, `{PROMPT}`, `{MODEL}`, etc.) based on saved task options and possibly user variables.
            - CommandBuilder validates that the resulting command is safe (e.g., no path traversal outside allowed directories, optional sandbox rules).
        - The execution agent has a **worker pool**:
            - `maxConcurrentRuns` configurable in preferences.
            - Each worker:
                - Dequeues a pending Run.
                - Performs pre-flight checks:
                    - `claude` binary presence and version.
                    - Connectivity check for API if configured (optional).
                    - Working directory exists and is accessible.
        
        When a **Run** is queued:
        
        **2.2 Execution pipeline**
        
        Because the app “runs tasks in the background automatically”, the scheduler never depends on the UI being open; it relies on launchd to keep the agent alive.[[runclauderun](https://runclauderun.com/faq)]
        
        - On wake:
            - All schedules with `nextFireTime <= now` are enqueued as **Run** records with `status=queued`.
            - `nextFireTime` is recomputed for each schedule.
        - A single timer (e.g., `DispatchSourceTimer`) wakes up at the earliest next fire time.
        - Uses a priority queue or min-heap keyed by next run time.
        - Computes **next fire time** per schedule based on type:
            - One-time: single timestamp, then auto-disable after run.
            - Daily: generate next timestamp at `timeOfDay` in the configured timezone.
            - Weekly: next timestamp at `timeOfDay` on the next selected weekday.
            - Interval: next timestamp is `lastRun + intervalMinutes` as long as within `[startAt, endAt]` if set.
        - Maintains an in-memory list of enabled schedules loaded from the DB on startup.
        
        The **scheduler** runs inside the background agent and is responsible for evaluating all active schedules:
        
        **2.1 Scheduler**
        
        ## 2. Scheduler and execution engine
        
        ---
        
        These entities back the “task history” the FAQ mentions for viewing execution logs and results.[[runclauderun](https://runclauderun.com/faq)]
        
        - RunLogChunk
            - `id` (UUID)
            - `runId` (FK)
            - `sequence` (int)
            - `timestamp`
            - `stream` (stdout | stderr)
            - `text` (chunk content)
        - Run
            - `id` (UUID)
            - `taskId` (FK)
            - `scheduleId` (nullable for manual runs)
            - `status` (queued | running | succeeded | failed | canceled)
            - `startedAt`, `finishedAt`
            - `exitCode` (int, nullable)
            - `triggerSource` (schedule/manual/test)
            - `summary` (small text summary produced post-run, e.g., first lines of output)
        - Schedule
            - `id` (UUID)
            - `taskId` (FK)
            - `type` (oneTime | daily | weekly | interval) – matches FAQ: specific time, daily, weekly, custom interval.runclaude+1
            - For `oneTime`: `runAt` (timestamp)
            - For `daily`: `timeOfDay`
            - For `weekly`: `timeOfDay`, `daysOfWeek[]`
            - For `interval`: `intervalMinutes`, `startAt`, optional `endAt`
            - `timezone` (defaults to system but can be task-specific)
            - `isEnabled` (bool)
        - Task
            - `id` (UUID)
            - `name` (user label)
            - `commandTemplate` (full Claude Code command string with parameter tokens)
            - `workingDirectory` (project directory where `claude` is run)
            - `environmentOverrides` (per-task env vars, e.g., `ANTHROPIC_API_KEY`)
            - `isEnabled` (bool)
            - `createdAt`, `updatedAt`
        
        Core entities stored in the local database:
        
        **1.2 Task model**
        
        - Background execution agent
            - Runs as a launchd agent (per-user) with “KeepAlive” so it can trigger scheduled jobs even when the main UI is closed.runclauderun+1
            - Owns the scheduler, command execution, log collection, and status updates.
            - Exposes an XPC API to the UI for:
                - Creating/updating/deleting tasks and schedules
                - Querying status
                - Streaming logs for a given run
        - Foreground UI process
            - Bundled as a standard macOS app.
            - Handles windows, task editing, viewing logs, notifications, and configuration.runclaude+1
            - Communicates with a background agent via XPC or a local IPC mechanism.
        
        **1.1 Processes**
        
        ## 1. Core components and process model
        
        ## Detailed technical design
        
        ---
        
        This section assumes a single-user, local-only design (no server) because the FAQ emphasizes “native macOS graphical interface” and scheduling on the same machine.runclauderun+1
        
        - An integration layer that maps GUI selections into valid `claude` CLI invocations with all supported flags and hooks.runclaude+1
        - A configuration and persistence layer (local database plus filesystem) that stores tasks, schedules, and logs.runclauderun+1
        - A background scheduler and execution daemon that actually runs Claude Code commands as child processes on macOS.runclaude+1
        - A macOS UI client (Swift / SwiftUI or AppKit) that manages tasks, schedules, and history.runclauderun+1
        
        At a high level, runCLAUDErun consists of:
        
        ## High‑level architecture
        
        ---
        
        runCLAUDErun is a native macOS app that gives you a GUI layer on top of Claude Code’s CLI so you can define, schedule, and monitor Claude Code runs without touching the terminal. Below is a detailed technical architecture plus a concise UX design walkthrough consistent with the public FAQ and what is required to support those features.runclaude+1
        
    - Pros
        - Easy to use interface
        - No bloat on top of Claude to work - it uses Claude Code directly
    - Cons
        - No agentic capabilities
- Idea Browser v2
    - About
        
        Something big is happening. I'm about to launch the new Ideabrowser 2.0.
        
        You opened my last email so I want to give you a sneak peek and a limited exclusive offer.
        
        Imagine a switchboard for your entire business. It knows your niche, tracks your progress, gives you fresh ideas based on where you actually are. Agents that can build on those ideas and get better every time. One living, breathing place that gets smarter every session and always knows what's next.
        
        It connects directly to your LLMs. Claude, Codex, Gemini, wherever you build. Your AI tools have full context on your business, your artifacts stream back to ideabrowser.
        
        Your niche, voice, goals, progress and tasks from one command center.
        
        That's Ideabrowser 2.0.
        
        [**Get early access**](https://91e7efd1.click.convertkit-mail4.com/o8upr6e0nrcqh693dq6bvhqwmkml6hq56v3rwz7g4k06d2q39nn487wemd52wel8g9e620g2082wrwddq70xl63k0grmwv9wdd0439zzz6np9dn4lrogzxl7n9kcdelgp/owhkhwuwpd03lobq/aHR0cHM6Ly93d3cuaWRlYWJyb3dzZXIuY29tL3ByaWNpbmc_ZGVhbD13b3Jrc2hvcC1tYXItNQ==)
        
        You stop being a context cowboy.
        
        You stop wrangling files across 10 places.
        
        You stop starting from scratch every day.
        
        You just... build.
        
        You become the orchestrator. You steer.
        
        Agents do the work.
        
        You react, approve, adjust, move, redirect.
        
        I use Ideabrowser as a co-founder to jam on new ideas we can build. A coach to keep me focused. A therapist to get me unstuck at 2am. And an employee to execute.
        
        My work compounds every session. It honestly feels like a video game. I'm having so much fun. Ideabrowser had the idea and helped write this email.
        
        The new way to build startups is here.
        
        If this fires you up, I have a limited number of spots for early access.
        
        I'm doing a full behind-the-scenes workshop this Thursday March 5th and giving exclusive early access to Pro and Empire members only.
        
        Pro at ~~$1,499/yr~~ $999/yr. (Get Ideabrowser 2.0 ideas, research, trends, workspaces and agents)
        
        Empire at ~~$2,999/yr~~ $1,999/yr. (Pro + coaching, vibe coding training, community, $50K+ in tool discounts)
        
        Your price locks in forever.
        
        [**Get early access + join the March 5th workshop**](https://91e7efd1.click.convertkit-mail4.com/o8upr6e0nrcqh693dq6bvhqwmkml6hq56v3rwz7g4k06d2q39nn487wemd52wel8g9e620g2082wrwddq70xl63k0grmwv9wdd0439zzz6np9dn4lrogzxl7n9kcdelgp/owhkhwuwpd03lobq/aHR0cHM6Ly93d3cuaWRlYWJyb3dzZXIuY29tL3ByaWNpbmc_ZGVhbD13b3Jrc2hvcC1tYXItNQ==)
        
        It's time to build.
        
        Jordan
        
    - Pros
        - Designed specifically for startup founders
    - Cons
        - High cost of entry as not built around claude
        - Doesnt seem to be opensource
- Openclaw
    - Technical and UX design
        
        OpenClaw is a local-first agent runtime plus message router that turns models into stateful, tool-using “personal assistants” across many channels, all driven by file-based workspaces and an event-driven gateway.ppaolo.substack+2
        
        Below is a deep technical design followed by a brief UX design.
        
        ---
        
        ## High-level architecture
        
        OpenClaw is structured as a **core runtime** with a **gateway/control plane** that all UIs and channels connect to.digitalocean+1
        
        - Core principles:
            - Local-first, self-hosted, single-user; multi-tenant requires explicit workspace separation.vallettasoftware+1
            - Workspace-first: agent configuration and state live as files in a directory.[[kenhuangus.substack](https://kenhuangus.substack.com/p/openclaw-design-patterns-part-1-of)]
            - Event-driven rather than poll-based; clients subscribe to events.[[ppaolo.substack](https://ppaolo.substack.com/p/openclaw-system-architecture-overview)]
            - Tools and integrations are explicit “skills” defined per agent/workspace.kenhuangus.substack+1
        
        At a high level, a user message flows: Channel → Gateway → Session Resolution → Context Assembly → Model + Tools → Response → Channel.[[ppaolo.substack](https://ppaolo.substack.com/p/openclaw-system-architecture-overview)]
        
        ---
        
        ## Core components and flows
        
        ## Gateway / control plane
        
        The **Gateway** is the central process all clients and channel adapters connect to.vallettasoftware+1
        
        Key responsibilities:
        
        - Network endpoints:
            - WebSocket server for web UI, desktop, and mobile clients.reddit+1
            - Channel adapter hooks for WhatsApp (Baileys), Telegram (grammY), Discord (discord.js), Slack, etc.tencentcloud+1
        - Security:
            - Token/password authentication for any non-loopback bindings.vallettasoftware+1
            - Pairing system for direct messages; remote connections require challenge–response signing and explicit approval, while local/“same tailnet” can auto-approve.ppaolo.substack+1
            - Local credential storage (API keys, OAuth tokens, bot tokens) under the user’s machine, not a cloud service.digitalocean+1
        - State and orchestration:
            - Session registry and presence (which agent/session is active, typing indicators, health).[[ppaolo.substack](https://ppaolo.substack.com/p/openclaw-system-architecture-overview)]
            - Cron-style scheduled actions (“tick” events) and webhook-based external triggers.[[ppaolo.substack](https://ppaolo.substack.com/p/openclaw-system-architecture-overview)]
            - Health monitoring of agent runtimes and skills.reddit+1
        
        The Gateway exposes an event bus; clients subscribe to topics like `agent`, `presence`, `health`, and `tick` rather than polling.[[ppaolo.substack](https://ppaolo.substack.com/p/openclaw-system-architecture-overview)]
        
        ## Channel adapters
        
        Adapters normalize inbound and outbound messages from external platforms into a canonical internal format.tencentcloud+1
        
        Typical behavior:
        
        - Inbound:
            - Receive platform-specific events (Slack commands, Telegram messages, WhatsApp messages).
            - Normalize into an internal message envelope: sender, channel, content, attachments, metadata.tencentcloud+1
            - Forward envelope to Gateway ingestion.
        - Outbound:
            - Receive canonical agent responses (text, attachments, actions).
            - Map into platform-native responses (Slack messages, Telegram replies, etc.).tencentcloud+1
        
        For robotics-specific deployments, an adapter might also map high-level commands into ROS messages (e.g., Twist commands for linear and angular velocities).[[openclawrobotics](https://www.openclawrobotics.com/)]
        
        ## Authentication and access control
        
        OpenClaw uses multiple layers of **access control** around its powerful tools and channels.digitalocean+2
        
        - User/device authentication:
            - Tokens or passwords for non-loopback clients.vallettasoftware+1
            - Pairing flows for new devices (e.g., scanning a code or signing a challenge).[[ppaolo.substack](https://ppaolo.substack.com/p/openclaw-system-architecture-overview)]
        - Channel-level permissions:
            - Policies around which external channels are allowed to trigger which workspaces/agents.vallettasoftware+1
        - Tool/skill risk controls:
            - Each skill (e.g., file I/O, browser automation, smart-home control) is declared and attached to an agent workspace.kenhuangus.substack+1
            - Skills can have eligibility and trust rules, and the system can enforce approval or restrict dangerous operations.reddit+1
        - Idempotency:
            - Any side-effecting operation (e.g., writing files, triggering external APIs, moving a robot) requires an idempotency key to prevent duplicate actions during retries.[[ppaolo.substack](https://ppaolo.substack.com/p/openclaw-system-architecture-overview)]
        
        ## Workspace-first agent model
        
        Each agent lives in a **workspace directory** treated as the source of truth for identity and behavior.reddit+1
        
        Core bootstrapping files often include:[[kenhuangus.substack](https://kenhuangus.substack.com/p/openclaw-design-patterns-part-1-of)]
        
        - `SOUL.md`: Defines purpose, goals, and behavioral norms.
        - `TOOLS.md`: Lists tools/skills and their configuration.
        - `IDENTITY.md`: Personalization, tone, and user-specific context.
        - `HEARTBEAT.md`: Execution cadence and scheduled behaviors.
        
        This file-based design enables:
        
        - Version control (e.g., git) for behavior/state.reddit+1
        - Easy replication and migration of agents between machines.
        - Manual editing by power users to refine behavior.
        
        Persistent memory for the user also lives as local Markdown docs or similar files, giving models a durable, inspectable memory space.[[digitalocean](https://www.digitalocean.com/resources/articles/what-is-openclaw)]
        
        ## Session resolution & context assembly
        
        When a message enters, the Gateway must decide which session/agent workspace handles it.reddit+1
        
        - Session resolution:
            - Use channel + sender + conversation/thread ID to map to an existing or new session.[[ppaolo.substack](https://ppaolo.substack.com/p/openclaw-system-architecture-overview)]
            - Optionally route via multi-agent routing rules (e.g., which agent is best suited).reddit+1
        - Context assembly:
            - Pull workspace bootstrapping files (SOUL, TOOLS, IDENTITY).[[kenhuangus.substack](https://kenhuangus.substack.com/p/openclaw-design-patterns-part-1-of)]
            - Retrieve relevant persistent memory docs and recent conversation history.digitalocean+1
            - Add channel metadata (e.g., Slack thread context, file attachments, environment state).tencentcloud+1
            - Optionally add external signals (scheduled job context, webhooks, robot sensor data).openclawrobotics+1
        
        The assembled context forms the system/user/assistant messages passed to the model, plus any tool schemas declared in `TOOLS.md`.kenhuangus.substack+1
        
        ## Agent runtime and execution loop
        
        The **Agent Runtime** is responsible for model invocation and tool orchestration.digitalocean+1
        
        Execution loop phases:[[ppaolo.substack](https://ppaolo.substack.com/p/openclaw-system-architecture-overview)]
        
        1. Model invocation:
            - Call the configured LLM/VLM (e.g., Claude, Gemini, Qwen VLM) with the assembled context and tool schemas.openclawrobotics+1
            - Receive either a direct response or a tool invocation request.
        2. Tool execution:
            - Validate requested tool against configured skills and access policy.reddit+2
            - Enforce idempotency keys and risk controls for side-effecting operations.reddit+1
            - Execute tools in a sandbox with access to:
                - File system operations (read/write under a workspace or sandbox path).[[digitalocean](https://www.digitalocean.com/resources/articles/what-is-openclaw)]
                - Script execution, browser automation, third-party APIs, or robotics endpoints (e.g., ROS).openclawrobotics+1
        3. Iteration:
            - Feed tool results back into the model as observations.
            - Iterate until stopping condition: answer produced, max steps, or user-specified limit.[[ppaolo.substack](https://ppaolo.substack.com/p/openclaw-system-architecture-overview)]
        4. Response delivery:
            - Format final answer for the target channel (plain text for CLI, structured messages for Slack, etc.).tencentcloud+1
            - Return through Gateway to channel adapter.
        
        The runtime can coordinate multiple agents with **multi-agent routing** and **Session Tools**, allowing agents to call each other as tools where appropriate.reddit+1
        
        ---
        
        ## Event-driven model, scheduling, and robotics
        
        ## Event-driven Gateway
        
        Instead of clients polling, OpenClaw uses an event-driven model.[[ppaolo.substack](https://ppaolo.substack.com/p/openclaw-system-architecture-overview)]
        
        - Clients subscribe to topics:
            - `agent`: messages, status updates, tool progress.
            - `presence`: online/typing/idle indicators.
            - `health`: runtime health, skill readiness.
            - `tick`: scheduled cron events.
        - This reduces network overhead and provides real-time updates across web, CLI, desktop, and mobile clients.reddit+1
        
        ## Cron jobs and external triggers
        
        OpenClaw supports **scheduled actions** and **webhook triggers** baked into the Gateway.[[ppaolo.substack](https://ppaolo.substack.com/p/openclaw-system-architecture-overview)]
        
        - Cron jobs:
            - Configured in workspace heartbeat files; define when to wake an agent and run tasks.kenhuangus.substack+1
            - Emit `tick` events that agents listen to and act on.
        - Webhooks:
            - External systems can POST events which the Gateway translates into internal events.
            - Used for integrating sensors, CI pipelines, or external apps.
        
        ## Robotics and embodied control
        
        Although OpenClaw was originally oriented toward “computer tasks” (files, browsers, apps), it has been successfully applied to robotics.[[openclawrobotics](https://www.openclawrobotics.com/)]
        
        - Architecture for robotics:
            - High-level natural language command to agent via a UI or messaging channel.[[openclawrobotics](https://www.openclawrobotics.com/)]
            - Agent uses a VLM/robotics model (e.g., Gemini Robotics-ER, Qwen VLM) to interpret environment from camera streams.[[openclawrobotics](https://www.openclawrobotics.com/)]
            - Tool skills bridge to ROS topics/services:
                - Processing depth camera data streams at high speed.
                - Issuing ROS Twist commands for linear and angular velocity control.[[openclawrobotics](https://www.openclawrobotics.com/)]
            - Continuous replanning as new sensor data arrives; no fixed motion plans hard-coded.[[openclawrobotics](https://www.openclawrobotics.com/)]
        
        This proves OpenClaw can orchestrate real-time perception and control loops, with motion planning effectively delegated to models and the external robotics stack.[[openclawrobotics](https://www.openclawrobotics.com/)]
        
        ---
        
        ## Storage, configuration, and security
        
        ## Configuration and storage
        
        - Configuration:
            - Mostly file-based under each workspace and a global config directory.vallettasoftware+1
            - Includes model configs, skill declarations, channel bindings, and scheduling rules.kenhuangus.substack+1
        - Data storage:
            - Conversation logs, memories, and behavior files stored locally, usually as Markdown or simple text formats.digitalocean+1
            - Allows manual inspection, backups, and version control.
        
        ## Credentials and secrets
        
        - Credentials stored locally under the user’s environment (e.g., for WhatsApp, Telegram, API keys).vallettasoftware+1
        - DRAM-style desktop wrappers include strict local key storage and secure IPC, so credentials never leave the machine.[[reddit](https://www.reddit.com/r/openclaw/comments/1r9su59/been_working_on_a_localfirst_desktop_ui_for/)]
        - No centralized cloud key vault is required; this aligns with OpenClaw’s privacy focus.vallettasoftware+1
        
        ## Risk controls and idempotency
        
        - Side-effecting operations require explicit idempotency keys, making retries safe.[[ppaolo.substack](https://ppaolo.substack.com/p/openclaw-system-architecture-overview)]
        - Skills may be disabled/enabled with trust handling logic and better remediation flows (e.g., telling the user how to install missing dependencies).[[reddit](https://www.reddit.com/r/openclaw/comments/1r9su59/been_working_on_a_localfirst_desktop_ui_for/)]
        - Enterprise guides recommend explicit “skill risk controls” and workspace separation to keep dangerous capabilities scoped.[[vallettasoftware](https://vallettasoftware.com/blog/post/openclaw-2026-guide)]
        
        ---
        
        ## UX design (current reality and future directions)
        
        ## Overall UX posture
        
        OpenClaw’s current UX is **engineer-centric** and heavily CLI-driven.uxwritinghub+1
        
        - Strengths:
            - Very fast execution once configured.uxwritinghub+1
            - Deep local control and privacy; data mostly stays on your machine.uxwritinghub+1
            - Highly extensible via Markdown configuration and local tooling.reddit+1
        - Weaknesses:
            - Steep learning curve; comfort with terminal, Docker, and YAML/Markdown configs is assumed.uxwritinghub+1
            - Minimal visual feedback; little “Undo,” no drag-and-drop, and few guardrails in the base engine.uxwritinghub+1
            - Easy to misconfigure; a wrong command can crash containers or overwrite files.uxwritinghub+1
        
        A typical interaction is “live in the terminal” with commands that start, configure, and converse with agents.[[uxwritinghub](https://uxwritinghub.com/openclaw-ux/)]
        
        ## Desktop / web UX (DRAM and similar)
        
        Community tools like DRAM provide a more **desktop-friendly** interface on top of the engine.[[reddit](https://www.reddit.com/r/openclaw/comments/1r9su59/been_working_on_a_localfirst_desktop_ui_for/)]
        
        Key UX features:
        
        - Cross-platform desktop app (Windows, macOS, Linux).[[reddit](https://www.reddit.com/r/openclaw/comments/1r9su59/been_working_on_a_localfirst_desktop_ui_for/)]
        - Unified views for:
            - Chat sessions.
            - Voice interactions.
            - Canvas workflows (structured, multi-pane tasks, often used for visual or multi-step flows).[[reddit](https://www.reddit.com/r/openclaw/comments/1r9su59/been_working_on_a_localfirst_desktop_ui_for/)]
        - Settings and management:
            - “Connections” tab for internet mode, DM policy, and device pairing.[[reddit](https://www.reddit.com/r/openclaw/comments/1r9su59/been_working_on_a_localfirst_desktop_ui_for/)]
            - Manager for discovering OpenClaw runtimes, handling configs, and coordinating the engine.[[reddit](https://www.reddit.com/r/openclaw/comments/1r9su59/been_working_on_a_localfirst_desktop_ui_for/)]
            - Improved IPC UX for skills/plugins: safer enable/disable flows, better eligibility/trust messaging.[[reddit](https://www.reddit.com/r/openclaw/comments/1r9su59/been_working_on_a_localfirst_desktop_ui_for/)]
        
        From a UX-design perspective, these wrappers treat OpenClaw as a headless engine and focus on:
        
        - Making configuration explicit but discoverable (e.g., tabs for skills, connections, workspaces).
        - Translating cryptic errors into actionable remediation hints (“install X package,” “add Y env var”).[[reddit](https://www.reddit.com/r/openclaw/comments/1r9su59/been_working_on_a_localfirst_desktop_ui_for/)]
        - Preserving the underlying workspace-first philosophy without exposing raw file structures to non-technical users.kenhuangus.substack+1
        
        ## Ideal UX flows (brief design)
        
        Given the current architecture and constraints, a **brief target UX** for OpenClaw could look like this:
        
        - Onboarding:
            - Guided setup wizard connects to a local Gateway, scans for workspaces, and offers to create a starter agent (populating SOUL/TOOLS/IDENTITY files through forms).kenhuangus.substack+1
        - Everyday usage:
            - Primary “Chat” tab with:
                - Conversation list where each conversation maps to a session/workspace.[[ppaolo.substack](https://ppaolo.substack.com/p/openclaw-system-architecture-overview)]
                - Inline indicators for active skills (file access, browser, robotics).
                - Live event-driven status (typing, tool execution progress, scheduled jobs).reddit+1
        - Skills & risk:
            - “Skills” panel showing each tool’s permissions, last usage, and risk level.
            - One-click toggle to disable risky capabilities, with explanations sourced from the skill descriptors.vallettasoftware+1
        - Scheduling & automations:
            - Visual calendar/cron editor that writes to `HEARTBEAT.md` behind the scenes, showing upcoming tasks and past runs.kenhuangus.substack+1
        - Robotics (if enabled):
            - “Robot” tab with:
                - Live camera feed and depth visualization.
                - Controls to test basic movements, with logs of ROS Twist commands issued.[[openclawrobotics](https://www.openclawrobotics.com/)]
                - Safety states (stop, hold, manual override) clearly surfaced.
        
        This UX sits on top of the existing technical design: every UI action ultimately manipulates workspace files or sends events to the Gateway, keeping behavior reproducible and inspectable.kenhuangus.substack+2
        
    - Pros
        - Open source
        - Flexible and powerful
    - Cons
        - Doesnt seem to be working on its own over time, just individual requests
        - Expensive as cant use claude code