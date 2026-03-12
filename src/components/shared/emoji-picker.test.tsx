import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { EmojiPicker } from "./emoji-picker";

describe("EmojiPicker", () => {
  it("shows default Flag icon for goal variant when no icon set", () => {
    const { container } = render(
      <EmojiPicker value={null} onChange={vi.fn()} variant="goal" />,
    );
    // Flag icon renders as SVG
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("shows default Briefcase icon for job variant when no icon set", () => {
    const { container } = render(
      <EmojiPicker value={null} onChange={vi.fn()} variant="job" />,
    );
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("shows the emoji when value is set", () => {
    render(
      <EmojiPicker value="🚀" onChange={vi.fn()} variant="goal" />,
    );
    expect(screen.getByText("🚀")).toBeInTheDocument();
  });

  it("opens popover on click and shows emoji grid", () => {
    render(
      <EmojiPicker value={null} onChange={vi.fn()} variant="goal" />,
    );
    fireEvent.click(screen.getByTitle("Change icon"));
    // Should see emoji in the grid
    expect(screen.getByText("🎯")).toBeInTheDocument();
    expect(screen.getByText("🔧")).toBeInTheDocument();
  });

  it("calls onChange when an emoji is selected", () => {
    const onChange = vi.fn();
    render(
      <EmojiPicker value={null} onChange={onChange} variant="goal" />,
    );
    fireEvent.click(screen.getByTitle("Change icon"));
    fireEvent.click(screen.getByText("🎯"));
    expect(onChange).toHaveBeenCalledWith("🎯");
  });

  it("highlights the currently selected emoji", () => {
    render(
      <EmojiPicker value="🎯" onChange={vi.fn()} variant="goal" />,
    );
    fireEvent.click(screen.getByTitle("Change icon"));
    // The selected emoji button in the grid should have ring styling
    const buttons = screen.getAllByText("🎯");
    // One is in the trigger, one in the grid
    const gridButton = buttons.find((b) =>
      b.closest("button")?.className.includes("ring-1"),
    );
    expect(gridButton).toBeTruthy();
  });

  it("shows AI regenerate button when onRegenerate is provided", () => {
    render(
      <EmojiPicker
        value={null}
        onChange={vi.fn()}
        variant="goal"
        onRegenerate={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTitle("Change icon"));
    expect(screen.getByText("Let AI pick")).toBeInTheDocument();
  });

  it("calls onRegenerate when AI button is clicked", () => {
    const onRegenerate = vi.fn();
    render(
      <EmojiPicker
        value={null}
        onChange={vi.fn()}
        variant="goal"
        onRegenerate={onRegenerate}
      />,
    );
    fireEvent.click(screen.getByTitle("Change icon"));
    fireEvent.click(screen.getByText("Let AI pick"));
    expect(onRegenerate).toHaveBeenCalledOnce();
  });
});
