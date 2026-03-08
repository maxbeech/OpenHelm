import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { RunStatusBadge, GoalStatusBadge } from "./status-badge";
import type { RunStatus, GoalStatus } from "@openorchestra/shared";

describe("RunStatusBadge", () => {
  const statuses: RunStatus[] = [
    "queued",
    "running",
    "succeeded",
    "failed",
    "permanent_failure",
    "cancelled",
  ];

  statuses.forEach((status) => {
    it(`renders ${status} badge`, () => {
      render(<RunStatusBadge status={status} />);
      // Badge should be in the document
      const badge = screen.getByText(
        status === "permanent_failure" ? "Permanent Failure" : status.charAt(0).toUpperCase() + status.slice(1),
      );
      expect(badge).toBeInTheDocument();
    });
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
