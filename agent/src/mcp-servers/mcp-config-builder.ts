/**
 * Generates MCP config JSON for Claude Code's --mcp-config flag.
 *
 * Writes a per-run config file to ~/.openhelm/mcp-configs/ that tells
 * Claude Code how to start the built-in browser MCP server. The file is
 * cleaned up after the run completes.
 */

import { writeFileSync, mkdirSync, readdirSync, unlinkSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { getBrowserMcpPaths, type BrowserMcpPaths } from "./browser-setup.js";

/**
 * Prepended to job prompts when the built-in browser MCP is available.
 * Encourages Claude to prefer openhelm-browser over any other browser MCP
 * configured globally, unless the prompt explicitly requests a different one.
 */
export const BROWSER_MCP_PREAMBLE =
  'OpenHelm: A built-in browser MCP server is available as "openhelm-browser". ' +
  "For any browser automation, prefer the mcp__openhelm-browser__* tools — " +
  "they include per-operation timeout protection. Only use a different browser " +
  "MCP if the task explicitly requests one.\n\n";

const MCP_CONFIG_DIR = join(
  process.env.OPENHELM_DATA_DIR ?? join(homedir(), ".openhelm"),
  "mcp-configs",
);

export interface McpServerEntry {
  command: string;
  args: string[];
  cwd?: string;
}

export interface McpConfigFile {
  mcpServers: Record<string, McpServerEntry>;
}

/**
 * Build the MCP config object for a run.
 * Returns null if no MCP servers are available (venv not set up).
 */
export function buildMcpConfig(): McpConfigFile | null {
  const servers: Record<string, McpServerEntry> = {};

  const browserPaths = getBrowserMcpPaths();
  if (browserPaths) {
    servers["openhelm-browser"] = {
      command: browserPaths.pythonPath,
      args: [browserPaths.serverModule, "--transport", "stdio"],
      cwd: browserPaths.cwd,
    };
  }

  if (Object.keys(servers).length === 0) return null;
  return { mcpServers: servers };
}

/**
 * Write the MCP config to a file and return the path.
 * Returns null if no MCP servers are available.
 */
export function writeMcpConfigFile(runId: string): string | null {
  const config = buildMcpConfig();
  if (!config) return null;

  mkdirSync(MCP_CONFIG_DIR, { recursive: true });
  const configPath = join(MCP_CONFIG_DIR, `run-${runId}.json`);
  writeFileSync(configPath, JSON.stringify(config, null, 2));
  return configPath;
}

/** Remove a previously written MCP config file (post-run cleanup). */
export function removeMcpConfigFile(configPath: string): void {
  try {
    unlinkSync(configPath);
  } catch {
    // File already removed or doesn't exist — ignore
  }
}

/**
 * Sweep orphaned config files from ~/.openhelm/mcp-configs/.
 * Called at agent startup to clean up after crashes.
 */
export function cleanupOrphanedConfigs(): void {
  try {
    const files = readdirSync(MCP_CONFIG_DIR);
    for (const file of files) {
      if (file.startsWith("run-") && file.endsWith(".json")) {
        try {
          unlinkSync(join(MCP_CONFIG_DIR, file));
        } catch {
          // ignore
        }
      }
    }
    if (files.length > 0) {
      console.error(`[mcp-config] cleaned up ${files.length} orphaned config file(s)`);
    }
  } catch {
    // Directory doesn't exist yet — nothing to clean
  }
}
