import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { InteractiveDetector } from "../src/claude-code/interactive-detector.js";

describe("InteractiveDetector", () => {
  let detector: InteractiveDetector;
  let onDetected: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    onDetected = vi.fn();
  });

  afterEach(() => {
    detector?.stop();
    vi.useRealTimers();
  });

  it("detects (y/n) prompt patterns", () => {
    detector = new InteractiveDetector({ onDetected });
    detector.start();

    detector.processLine("Do you want to continue? (y/n)");
    expect(onDetected).toHaveBeenCalledOnce();
    expect(onDetected.mock.calls[0][0]).toContain("Interactive prompt detected");
  });

  it("detects (yes/no) prompt patterns", () => {
    detector = new InteractiveDetector({ onDetected });
    detector.start();

    detector.processLine("Are you sure? (yes/no)");
    expect(onDetected).toHaveBeenCalledOnce();
  });

  it("detects press enter prompts", () => {
    detector = new InteractiveDetector({ onDetected });
    detector.start();

    detector.processLine("Press enter to continue...");
    expect(onDetected).toHaveBeenCalledOnce();
  });

  it("detects password prompts", () => {
    detector = new InteractiveDetector({ onDetected });
    detector.start();

    detector.processLine("Enter password:");
    expect(onDetected).toHaveBeenCalledOnce();
  });

  it("detects [Y/n] bracket patterns", () => {
    detector = new InteractiveDetector({ onDetected });
    detector.start();

    detector.processLine("Install dependencies? [Y/n]");
    expect(onDetected).toHaveBeenCalledOnce();
  });

  it("does not trigger on normal output", () => {
    detector = new InteractiveDetector({ onDetected });
    detector.start();

    detector.processLine("Compiling source files...");
    detector.processLine("Build successful in 2.3s");
    detector.processLine("All tests passed");
    expect(onDetected).not.toHaveBeenCalled();
  });

  it("only triggers once for multiple interactive patterns", () => {
    detector = new InteractiveDetector({ onDetected });
    detector.start();

    detector.processLine("Continue? (y/n)");
    detector.processLine("Really? (yes/no)");
    expect(onDetected).toHaveBeenCalledOnce();
  });

  it("triggers on silence timeout", () => {
    detector = new InteractiveDetector({
      silenceTimeoutMs: 5000,
      onDetected,
    });
    detector.start();

    detector.processLine("Starting process...");

    // Advance time past the silence threshold
    vi.advanceTimersByTime(6000);

    expect(onDetected).toHaveBeenCalledOnce();
    expect(onDetected.mock.calls[0][0]).toContain("No output for 5s");
    expect(onDetected.mock.calls[0][0]).toContain("Starting process...");
  });

  it("resets silence timer on new output", () => {
    detector = new InteractiveDetector({
      silenceTimeoutMs: 5000,
      onDetected,
    });
    detector.start();

    detector.processLine("Line 1");
    vi.advanceTimersByTime(3000);

    detector.processLine("Line 2");
    vi.advanceTimersByTime(3000);

    detector.processLine("Line 3");
    vi.advanceTimersByTime(3000);

    // Should not have triggered — each line resets the timer
    expect(onDetected).not.toHaveBeenCalled();
  });

  it("uses default 60s silence timeout", () => {
    detector = new InteractiveDetector({ onDetected });
    detector.start();

    detector.processLine("Starting...");

    // 59 seconds — should not trigger
    vi.advanceTimersByTime(59_000);
    expect(onDetected).not.toHaveBeenCalled();

    // 61 seconds total — should trigger
    vi.advanceTimersByTime(2000);
    expect(onDetected).toHaveBeenCalledOnce();
  });

  it("reports last output line in silence message", () => {
    detector = new InteractiveDetector({
      silenceTimeoutMs: 5000,
      onDetected,
    });
    detector.start();

    detector.processLine("Processing file A...");
    detector.processLine("Processing file B...");

    vi.advanceTimersByTime(6000);

    expect(onDetected.mock.calls[0][0]).toContain("Processing file B...");
  });

  it("stop() clears all timers", () => {
    detector = new InteractiveDetector({
      silenceTimeoutMs: 5000,
      onDetected,
    });
    detector.start();
    detector.processLine("Starting...");

    detector.stop();
    vi.advanceTimersByTime(10_000);

    expect(onDetected).not.toHaveBeenCalled();
  });
});
