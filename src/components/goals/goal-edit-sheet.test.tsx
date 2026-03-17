import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { GoalEditSheet } from "./goal-edit-sheet";
import { useGoalStore } from "@/stores/goal-store";
import type { Goal } from "@openhelm/shared";

const mockUpdateGoal = vi.fn();

vi.mock("@/lib/api", () => ({
  updateGoal: vi.fn().mockResolvedValue({}),
  listGoals: vi.fn().mockResolvedValue([]),
}));

const mockGoal: Goal = {
  id: "g1",
  projectId: "p1",
  name: "Improve test coverage",
  description: "Get to 80% coverage",
  icon: null,
  status: "active",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

const defaultProps = {
  goal: mockGoal,
  open: true,
  onOpenChange: vi.fn(),
  onComplete: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  useGoalStore.setState({
    goals: [mockGoal],
    loading: false,
    error: null,
    updateGoal: mockUpdateGoal.mockResolvedValue(mockGoal),
    updateGoalStatus: vi.fn(),
    archiveGoal: vi.fn(),
    deleteGoal: vi.fn(),
    createGoal: vi.fn(),
    fetchGoals: vi.fn(),
  });
});

describe("GoalEditSheet", () => {
  it("renders with goal fields pre-filled", () => {
    render(<GoalEditSheet {...defaultProps} />);
    expect(screen.getByText("Edit Goal")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Improve test coverage")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Get to 80% coverage")).toBeInTheDocument();
  });

  it("shows validation error when name is cleared", async () => {
    render(<GoalEditSheet {...defaultProps} />);
    const nameInput = screen.getByLabelText(/Name/);
    fireEvent.change(nameInput, { target: { value: "" } });
    fireEvent.blur(nameInput);
    expect(await screen.findByText("Name is required")).toBeInTheDocument();
  });

  it("disables Save Changes button when name is empty", () => {
    render(<GoalEditSheet {...defaultProps} />);
    const nameInput = screen.getByLabelText(/Name/);
    fireEvent.change(nameInput, { target: { value: "" } });
    const saveBtn = screen.getByRole("button", { name: /save changes/i });
    expect(saveBtn).toBeDisabled();
  });

  it("calls updateGoal with updated values on submit", async () => {
    render(<GoalEditSheet {...defaultProps} />);
    const nameInput = screen.getByLabelText(/Name/);
    fireEvent.change(nameInput, { target: { value: "New Name" } });
    const saveBtn = screen.getByRole("button", { name: /save changes/i });
    fireEvent.click(saveBtn);
    await waitFor(() => {
      expect(mockUpdateGoal).toHaveBeenCalledWith(
        expect.objectContaining({ id: "g1", name: "New Name" })
      );
    });
  });

  it("does not call updateGoal when name is unchanged but form is valid", async () => {
    render(<GoalEditSheet {...defaultProps} />);
    const saveBtn = screen.getByRole("button", { name: /save changes/i });
    fireEvent.click(saveBtn);
    await waitFor(() => {
      expect(mockUpdateGoal).toHaveBeenCalledWith(
        expect.objectContaining({ id: "g1", name: "Improve test coverage" })
      );
    });
  });
});
