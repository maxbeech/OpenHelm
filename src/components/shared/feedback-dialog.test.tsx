import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { FeedbackDialog } from "./feedback-dialog";

vi.mock("@/lib/sentry", () => ({
  submitUserFeedback: vi.fn(),
}));

import { submitUserFeedback } from "@/lib/sentry";

afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe("FeedbackDialog", () => {
  it("renders dialog when open", () => {
    render(<FeedbackDialog open={true} onOpenChange={() => {}} />);
    expect(screen.getByText("Share Feedback")).toBeInTheDocument();
  });

  it("does not render content when closed", () => {
    render(<FeedbackDialog open={false} onOpenChange={() => {}} />);
    expect(screen.queryByText("Share Feedback")).not.toBeInTheDocument();
  });

  it("shows Feedback mode by default with required textarea", () => {
    render(<FeedbackDialog open={true} onOpenChange={() => {}} />);
    expect(screen.getByPlaceholderText("What's on your mind?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit" })).toBeDisabled();
  });

  it("enables Submit in Feedback mode once text is entered", () => {
    render(<FeedbackDialog open={true} onOpenChange={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText("What's on your mind?"), {
      target: { value: "Great app!" },
    });
    expect(screen.getByRole("button", { name: "Submit" })).not.toBeDisabled();
  });

  it("switches to Bug Report mode and allows empty submission", () => {
    render(<FeedbackDialog open={true} onOpenChange={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Bug Report" }));
    expect(
      screen.getByPlaceholderText("Describe what happened (optional)"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit" })).not.toBeDisabled();
  });

  it("toggles anonymous data checkbox", () => {
    render(<FeedbackDialog open={true} onOpenChange={() => {}} />);
    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toBeChecked();
    fireEvent.click(checkbox);
    expect(checkbox).not.toBeChecked();
  });

  it("calls submitUserFeedback with correct args on submit", async () => {
    vi.useFakeTimers();
    render(<FeedbackDialog open={true} onOpenChange={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText("What's on your mind?"), {
      target: { value: "Looks great!" },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    });
    expect(submitUserFeedback).toHaveBeenCalledWith("feedback", "Looks great!", true);
  });

  it("calls submitUserFeedback with includeAnonymousData=false when unchecked", async () => {
    vi.useFakeTimers();
    render(<FeedbackDialog open={true} onOpenChange={() => {}} />);
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.change(screen.getByPlaceholderText("What's on your mind?"), {
      target: { value: "A concern" },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    });
    expect(submitUserFeedback).toHaveBeenCalledWith("feedback", "A concern", false);
  });

  it("shows success state and calls onOpenChange after 1.5s", async () => {
    vi.useFakeTimers();
    const onOpenChange = vi.fn();
    render(<FeedbackDialog open={true} onOpenChange={onOpenChange} />);
    fireEvent.change(screen.getByPlaceholderText("What's on your mind?"), {
      target: { value: "Nice work" },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    });
    expect(screen.getByText("Thank you for your feedback!")).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
