/**
 * IPC handlers for the built-in browser MCP server.
 * Exposes status checks and manual setup trigger to the frontend.
 */

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
}
