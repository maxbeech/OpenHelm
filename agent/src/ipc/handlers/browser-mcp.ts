/**
 * IPC handlers for the built-in browser MCP server.
 * Exposes status checks, manual setup trigger, and browser focus to the frontend.
 */

import { execFileSync } from "child_process";
import { registerHandler } from "../handler.js";

export function registerBrowserMcpHandlers() {
  /**
   * Check browser MCP readiness and Python availability.
   * Returns { venvReady, pythonAvailable, sourceAvailable }.
   */
  registerHandler("browserMcp.status", async () => {
    const { isVenvReady, isSourceAvailable, detectPython } =
      await import("../../mcp-servers/browser-setup.js");

    return {
      venvReady: isVenvReady(),
      sourceAvailable: isSourceAvailable(),
      pythonAvailable: (await detectPython()) !== null,
    };
  });

  /**
   * Set up the browser MCP venv (create venv + install deps).
   * Idempotent — skips if already ready.
   */
  registerHandler("browserMcp.setup", async () => {
    const { setupBrowserMcpVenv } = await import("../../mcp-servers/browser-setup.js");
    const paths = await setupBrowserMcpVenv();
    return {
      success: true,
      pythonPath: paths.pythonPath,
      serverModule: paths.serverModule,
    };
  });

  /**
   * Bring the Chrome browser window to the foreground.
   * Used when the user needs to manually interact with the browser (e.g. solve a CAPTCHA).
   * Uses execFileSync (not exec) to avoid shell injection — args are static.
   */
  registerHandler("browserMcp.focusBrowser", () => {
    try {
      execFileSync(
        "osascript",
        ["-e", 'tell application "Google Chrome" to activate'],
        { timeout: 5_000 },
      );
      return { success: true };
    } catch {
      // Chrome may not be running or osascript may fail — non-fatal
      return { success: false };
    }
  });
}
