import { describe, it, expect, vi, beforeEach } from "vitest";
import type { InboxItem } from "@openhelm/shared";

const mockSendNotification = vi.fn();
const mockIsPermissionGranted = vi.fn();
const mockRequestPermission = vi.fn();

vi.mock("@tauri-apps/plugin-notification", () => ({
  get sendNotification() { return mockSendNotification; },
  get isPermissionGranted() { return mockIsPermissionGranted; },
  get requestPermission() { return mockRequestPermission; },
}));

vi.mock("./api", () => ({
  getSetting: vi.fn(),
  setSetting: vi.fn(),
}));

import { notifyInboxItem, notifyRunCompleted, ensureNotificationPermission } from "./notifications";
import * as api from "./api";

const baseItem: InboxItem = {
  id: "item-1",
  runId: "run-1",
  jobId: "job-1",
  projectId: "proj-1",
  type: "permanent_failure",
  title: "Something broke",
  message: "Details here",
  status: "open",
  createdAt: new Date().toISOString(),
  resolvedAt: null,
  resolution: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockIsPermissionGranted.mockResolvedValue(true);
  mockRequestPermission.mockResolvedValue("granted");
  vi.mocked(api.setSetting).mockResolvedValue({} as never);
});

describe("notifyInboxItem", () => {
  it("sends notification when level is 'alerts_only'", async () => {
    vi.mocked(api.getSetting).mockResolvedValue({ value: "alerts_only" } as never);
    await notifyInboxItem(baseItem);
    expect(mockSendNotification).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Run Failed Permanently" }),
    );
  });

  it("sends notification when level is 'on_finish'", async () => {
    vi.mocked(api.getSetting).mockResolvedValue({ value: "on_finish" } as never);
    await notifyInboxItem(baseItem);
    expect(mockSendNotification).toHaveBeenCalled();
  });

  it("does not send notification when level is 'never'", async () => {
    vi.mocked(api.getSetting).mockResolvedValue({ value: "never" } as never);
    await notifyInboxItem(baseItem);
    expect(mockSendNotification).not.toHaveBeenCalled();
  });

  it("defaults to 'alerts_only' when setting is not set", async () => {
    vi.mocked(api.getSetting).mockResolvedValue(null as never);
    await notifyInboxItem(baseItem);
    expect(mockSendNotification).toHaveBeenCalled();
  });

  it("uses 'Input Required' title for human_in_loop items", async () => {
    vi.mocked(api.getSetting).mockResolvedValue({ value: "alerts_only" } as never);
    await notifyInboxItem({ ...baseItem, type: "human_in_loop" });
    expect(mockSendNotification).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Input Required" }),
    );
  });
});

describe("notifyRunCompleted", () => {
  it("sends notification when level is 'on_finish'", async () => {
    vi.mocked(api.getSetting).mockResolvedValue({ value: "on_finish" } as never);
    await notifyRunCompleted("succeeded", "My Job");
    expect(mockSendNotification).toHaveBeenCalledWith(
      expect.objectContaining({ title: '"My Job" succeeded' }),
    );
  });

  it("does not send notification when level is 'alerts_only'", async () => {
    vi.mocked(api.getSetting).mockResolvedValue({ value: "alerts_only" } as never);
    await notifyRunCompleted("succeeded", "My Job");
    expect(mockSendNotification).not.toHaveBeenCalled();
  });

  it("does not send notification when level is 'never'", async () => {
    vi.mocked(api.getSetting).mockResolvedValue({ value: "never" } as never);
    await notifyRunCompleted("failed", "My Job");
    expect(mockSendNotification).not.toHaveBeenCalled();
  });

  it("uses failed status in title when run did not succeed", async () => {
    vi.mocked(api.getSetting).mockResolvedValue({ value: "on_finish" } as never);
    await notifyRunCompleted("failed", "Build Job");
    expect(mockSendNotification).toHaveBeenCalledWith(
      expect.objectContaining({ title: '"Build Job" finished (failed)' }),
    );
  });

  it("includes summary in notification body when provided", async () => {
    vi.mocked(api.getSetting).mockResolvedValue({ value: "on_finish" } as never);
    await notifyRunCompleted("succeeded", "My Job", "All tests passed.");
    expect(mockSendNotification).toHaveBeenCalledWith(
      expect.objectContaining({ body: "All tests passed." }),
    );
  });
});

describe("ensureNotificationPermission", () => {
  it("requests permission when not already granted and not previously requested", async () => {
    vi.mocked(api.getSetting).mockResolvedValue(null as never);
    mockIsPermissionGranted.mockResolvedValue(false);
    await ensureNotificationPermission();
    expect(mockRequestPermission).toHaveBeenCalled();
    expect(api.setSetting).toHaveBeenCalledWith({
      key: "notification_permission_requested",
      value: "true",
    });
  });

  it("does not re-request if already requested", async () => {
    vi.mocked(api.getSetting).mockResolvedValue({ value: "true" } as never);
    await ensureNotificationPermission();
    expect(mockRequestPermission).not.toHaveBeenCalled();
  });

  it("skips requestPermission if already granted", async () => {
    vi.mocked(api.getSetting).mockResolvedValue(null as never);
    mockIsPermissionGranted.mockResolvedValue(true);
    await ensureNotificationPermission();
    expect(mockRequestPermission).not.toHaveBeenCalled();
    expect(api.setSetting).toHaveBeenCalled();
  });
});
