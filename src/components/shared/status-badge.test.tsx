import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { RunStatusBadge, GoalStatusBadge } from "./status-badge";
import type { RunStatus, GoalStatus } from "@openhelm/shared";

describe("RunStatusBadge", () => {
  const statuses: RunStatus[] = [
    "deferred",
    "queued",
    "running",
    "succeeded",
    "failed",
    "permanent_failure",
    "cancelled",
  ];

  const labelFor = (status: RunStatus): string => {
    if (status === "permanent_failure") return "Permanent Failure";
    if (status === "deferred") return "Scheduled";
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  statuses.forEach((status) => {
    it(`renders ${status} badge`, () => {
      render(<RunStatusBadge status={status} />);
      const badge = screen.getByText(labelFor(status));
      expect(badge).toBeInTheDocument();
    });
  });

  it("renders deferred status with 'Scheduled' label", () => {
    render(<RunStatusBadge status="deferred" />);
    expect(screen.getByText("Scheduled")).toBeInTheDocument();
  });
});

describe("GoalStatusBadge", () => {
  const statuses: GoalStatus[] = ["active", "paused", "archived"];

  statuses.forEach((status) => {
    it(`renders ${status} badge`, () => {
      render(<GoalStatusBadge status={status} />);
      const badge = screen.getByText(
        status.charAt(0).toUpperCase() + status.slice(1),
      );
      expect(badge).toBeInTheDocument();
    });
  });
});
