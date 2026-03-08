import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAutoScroll } from "./use-auto-scroll";

describe("useAutoScroll", () => {
  it("returns a container ref", () => {
    const { result } = renderHook(() => useAutoScroll([0]));
    expect(result.current.containerRef).toBeDefined();
  });

  it("starts at bottom by default", () => {
    const { result } = renderHook(() => useAutoScroll([0]));
    expect(result.current.isAtBottom).toBe(true);
  });

  it("provides a scrollToBottom function", () => {
    const { result } = renderHook(() => useAutoScroll([0]));
    expect(typeof result.current.scrollToBottom).toBe("function");
  });
});
