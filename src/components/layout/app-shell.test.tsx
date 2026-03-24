import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render } from "@testing-library/react";

// --- heavy dep mocks ---
vi.mock("./sidebar", () => ({ Sidebar: () => null }));
vi.mock("./scheduler-control", () => ({ SchedulerControl: () => null }));
vi.mock("@/components/chat/chat-panel", () => ({ ChatPanel: () => null }));
vi.mock("@/components/shared/update-banner", () => ({ UpdateBanner: () => null }));
vi.mock("@/components/shared/license-banner", () => ({
  LicenseBanner: () => null,
  shouldShowLicenseBanner: () => false,
}));
vi.mock("@/hooks/use-license", () => ({
  useLicense: () => ({ licenseStatus: null }),
}));
vi.mock("@/hooks/use-claude-health", () => ({
  useClaudeHealth: () => ({ error: null, recheck: vi.fn(), dismiss: vi.fn() }),
}));
vi.mock("@/stores/chat-store", () => ({
  useChatStore: () => ({ panelOpen: false, togglePanel: vi.fn() }),
}));
vi.mock("@/stores/app-store", () => ({
  useAppStore: () => ({ activeProjectId: null }),
}));
vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({ startDragging: vi.fn() }),
}));

// --- updater mocks (the ones under test) ---
const mockCheckForUpdate = vi.fn().mockResolvedValue(undefined);

vi.mock("@/hooks/use-updater", () => ({
  useUpdater: vi.fn(),
}));
vi.mock("@/stores/updater-store", () => ({
  useUpdaterStore: vi.fn(),
}));

import { useUpdater } from "@/hooks/use-updater";
import { useUpdaterStore } from "@/stores/updater-store";
import { AppShell } from "./app-shell";

const baseUpdaterReturn = {
  status: "idle" as const,
  currentVersion: "0.1.16",
  updateVersion: null,
  updateNotes: null,
  downloadProgress: null,
  error: null,
  activeRunCount: 0,
  shouldCheckUpdates: false,
  checkForUpdate: mockCheckForUpdate,
  installUpdate: vi.fn(),
  forceInstallUpdate: vi.fn(),
  waitAndInstall: vi.fn(),
  dismissUpdate: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.mocked(useUpdater).mockReturnValue(baseUpdaterReturn);
  vi.mocked(useUpdaterStore).mockReturnValue({ shouldCheckUpdates: false, setShouldCheckUpdates: vi.fn() });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("AppShell update check interval", () => {
  it("does not call checkForUpdate when shouldCheckUpdates is false", () => {
    vi.mocked(useUpdaterStore).mockReturnValue({ shouldCheckUpdates: false, setShouldCheckUpdates: vi.fn() });
    render(<AppShell onNewJobForGoal={vi.fn()}>content</AppShell>);
    expect(mockCheckForUpdate).not.toHaveBeenCalled();
  });

  it("calls checkForUpdate immediately when shouldCheckUpdates becomes true", () => {
    vi.mocked(useUpdaterStore).mockReturnValue({ shouldCheckUpdates: true, setShouldCheckUpdates: vi.fn() });
    render(<AppShell onNewJobForGoal={vi.fn()}>content</AppShell>);
    expect(mockCheckForUpdate).toHaveBeenCalledTimes(1);
  });

  it("re-checks every hour while shouldCheckUpdates is true", () => {
    vi.mocked(useUpdaterStore).mockReturnValue({ shouldCheckUpdates: true, setShouldCheckUpdates: vi.fn() });
    render(<AppShell onNewJobForGoal={vi.fn()}>content</AppShell>);

    // Initial check on mount
    expect(mockCheckForUpdate).toHaveBeenCalledTimes(1);

    // Advance 1 hour → second check
    vi.advanceTimersByTime(60 * 60 * 1_000);
    expect(mockCheckForUpdate).toHaveBeenCalledTimes(2);

    // Advance another hour → third check
    vi.advanceTimersByTime(60 * 60 * 1_000);
    expect(mockCheckForUpdate).toHaveBeenCalledTimes(3);
  });

  it("clears the interval on unmount", () => {
    vi.mocked(useUpdaterStore).mockReturnValue({ shouldCheckUpdates: true, setShouldCheckUpdates: vi.fn() });
    const { unmount } = render(<AppShell onNewJobForGoal={vi.fn()}>content</AppShell>);
    expect(mockCheckForUpdate).toHaveBeenCalledTimes(1);

    unmount();

    // Interval is cleared — advancing time should not trigger more calls
    vi.advanceTimersByTime(60 * 60 * 1_000);
    expect(mockCheckForUpdate).toHaveBeenCalledTimes(1);
  });
});
