import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue(false),
}));

vi.mock("@/lib/api", () => ({
  getSetting: vi.fn(),
  setSetting: vi.fn(),
}));

vi.mock("@/lib/notifications", () => ({
  ensureNotificationPermission: vi.fn().mockResolvedValue(undefined),
}));

// @/lib/sentry is globally mocked in test-setup.ts

import { ApplicationSection } from "./application-section";
import * as api from "@/lib/api";
import { ensureNotificationPermission } from "@/lib/notifications";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.getSetting).mockResolvedValue(null as never);
  vi.mocked(api.setSetting).mockResolvedValue({} as never);
});

describe("ApplicationSection — notification level", () => {
  it("renders notification radio group with 'alerts_only' as default when no setting stored", async () => {
    render(<ApplicationSection />);
    await waitFor(() => {
      const alertsRadio = screen.getByRole("radio", { name: /alerts only/i });
      expect(alertsRadio).toBeChecked();
    });
  });

  it("reads stored notification_level and reflects it in the UI", async () => {
    vi.mocked(api.getSetting).mockImplementation((key: string) => {
      if (key === "notification_level")
        return Promise.resolve({ value: "on_finish" } as never);
      return Promise.resolve(null as never);
    });
    render(<ApplicationSection />);
    await waitFor(() => {
      const finishRadio = screen.getByRole("radio", { name: /when any job finishes/i });
      expect(finishRadio).toBeChecked();
    });
  });

  it("persists notification_level when radio changes", async () => {
    render(<ApplicationSection />);
    await waitFor(() => screen.getByRole("radio", { name: /never/i }));
    fireEvent.click(screen.getByRole("radio", { name: /never/i }));
    expect(api.setSetting).toHaveBeenCalledWith({
      key: "notification_level",
      value: "never",
    });
  });

  it("calls ensureNotificationPermission when selecting non-never level", async () => {
    render(<ApplicationSection />);
    await waitFor(() => screen.getByRole("radio", { name: /when any job finishes/i }));
    fireEvent.click(screen.getByRole("radio", { name: /when any job finishes/i }));
    await waitFor(() => {
      expect(ensureNotificationPermission).toHaveBeenCalled();
    });
  });

  it("does not call ensureNotificationPermission when selecting 'never'", async () => {
    render(<ApplicationSection />);
    await waitFor(() => screen.getByRole("radio", { name: /never/i }));
    fireEvent.click(screen.getByRole("radio", { name: /never/i }));
    // Wait a tick for any async handlers to complete
    await waitFor(() => {
      expect(api.setSetting).toHaveBeenCalled();
    });
    expect(ensureNotificationPermission).not.toHaveBeenCalled();
  });
});
