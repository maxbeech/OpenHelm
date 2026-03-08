import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { EmptyState } from "./empty-state";
import { Target } from "lucide-react";

describe("EmptyState", () => {
  it("renders title and description", () => {
    render(
      <EmptyState
        icon={Target}
        title="No items"
        description="Nothing to show here."
      />,
    );
    expect(screen.getByText("No items")).toBeInTheDocument();
    expect(screen.getByText("Nothing to show here.")).toBeInTheDocument();
  });

  it("renders action when provided", () => {
    render(
      <EmptyState
        icon={Target}
        title="Empty"
        description="No data"
        action={<button>Add item</button>}
      />,
    );
    expect(screen.getByText("Add item")).toBeInTheDocument();
  });

  it("renders without action", () => {
    const { container } = render(
      <EmptyState icon={Target} title="Empty" description="No data" />,
    );
    expect(container.querySelector("button")).toBeNull();
  });
});
