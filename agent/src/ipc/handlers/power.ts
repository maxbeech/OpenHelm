import { registerHandler } from "../handler.js";
import {
  installSudoersEntry,
  removeSudoersEntry,
  checkWakeAuthorization,
} from "../../power/wake-scheduler.js";
import { getPowerStatus } from "../../power/index.js";

export function registerPowerHandlers() {
  /**
   * Install the sudoers entry for passwordless pmset.
   * Shows ONE macOS admin dialog. Called when user toggles wake scheduling ON.
   */
  registerHandler("power.checkAuth", async () => {
    return await installSudoersEntry();
  });

  /**
   * Check whether the sudoers entry is installed (no dialog).
   */
  registerHandler("power.isAuthorized", async () => {
    return await checkWakeAuthorization();
  });

  /**
   * Remove the sudoers entry. Shows one admin dialog.
   * Called when user toggles wake scheduling OFF.
   */
  registerHandler("power.removeAuth", async () => {
    await removeSudoersEntry();
    return { removed: true };
  });

  /** Current power management status snapshot. */
  registerHandler("power.status", () => {
    return getPowerStatus();
  });
}
