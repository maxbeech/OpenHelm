import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PromptClarification } from "./prompt-clarification";

const mockQuestions = [
  {
    question: "What area should be refactored?",
    options: ["Authentication", "Database layer", "API routes"],
  },
  {
    question: "What style guide should be followed?",
    options: ["Airbnb", "Standard", "None"],
  },
];

describe("PromptClarification", () => {
  it("renders all questions and their options", () => {
    render(
      <PromptClarification
        questions={mockQuestions}
        answers={{}}
        onAnswersChange={vi.fn()}
      />,
    );

    expect(screen.getByText("What area should be refactored?")).toBeInTheDocument();
    expect(screen.getByText("Authentication")).toBeInTheDocument();
    expect(screen.getByText("Database layer")).toBeInTheDocument();
    expect(screen.getByText("API routes")).toBeInTheDocument();
    expect(screen.getByText("What style guide should be followed?")).toBeInTheDocument();
  });

  it("calls onAnswersChange when an option is selected", () => {
    const onChange = vi.fn();
    render(
      <PromptClarification
        questions={mockQuestions}
        answers={{}}
        onAnswersChange={onChange}
      />,
    );

    fireEvent.click(screen.getByText("Authentication"));
    expect(onChange).toHaveBeenCalledWith({
      "What area should be refactored?": "Authentication",
    });
  });

  it("shows 'Other' button for each question", () => {
    render(
      <PromptClarification
        questions={mockQuestions}
        answers={{}}
        onAnswersChange={vi.fn()}
      />,
    );

    const otherButtons = screen.getAllByText("Other");
    expect(otherButtons).toHaveLength(2);
  });

  it("highlights the selected option", () => {
    render(
      <PromptClarification
        questions={mockQuestions}
        answers={{ "What area should be refactored?": "Authentication" }}
        onAnswersChange={vi.fn()}
      />,
    );

    const selected = screen.getByText("Authentication");
    expect(selected.className).toContain("border-primary");
  });

  it("shows a helper message", () => {
    render(
      <PromptClarification
        questions={mockQuestions}
        answers={{}}
        onAnswersChange={vi.fn()}
      />,
    );

    expect(
      screen.getByText("A few suggestions to improve this prompt:"),
    ).toBeInTheDocument();
  });
});
