/**
 * Detects when a Claude Code process is waiting for interactive input.
 *
 * Two signals are monitored:
 * 1. Output content: patterns suggesting a question (y/n prompts, question marks)
 * 2. Output silence: no output for a configurable duration (default 60s)
 *
 * When interactive behaviour is detected, the callback is invoked.
 * The run should NOT be killed — it should be held in a `waiting_for_input` status.
 */

/** Patterns that suggest Claude Code is waiting for user input */
const INTERACTIVE_PATTERNS = [
  /\(y\/n\)/i,
  /\(yes\/no\)/i,
  /press enter/i,
  /press any key/i,
  /\[y\/N\]/,
  /\[Y\/n\]/,
  /continue\? /i,
  /proceed\? /i,
  /confirm\? /i,
  /password:/i,
  /token:/i,
  /api key:/i,
];

export interface InteractiveDetectorConfig {
  /** Silence timeout in milliseconds (default: 60000) */
  silenceTimeoutMs?: number;
  /** Called when interactive behaviour is detected */
  onDetected: (reason: string) => void;
}

export class InteractiveDetector {
  private silenceTimeoutMs: number;
  private onDetected: (reason: string) => void;
  private silenceTimer: ReturnType<typeof setTimeout> | null = null;
  private detected = false;
  private recentLines: string[] = [];
  private static readonly MAX_RECENT_LINES = 10;

  constructor(config: InteractiveDetectorConfig) {
    this.silenceTimeoutMs = config.silenceTimeoutMs ?? 60_000;
    this.onDetected = config.onDetected;
  }

  /** Start monitoring for silence */
  start(): void {
    this.resetSilenceTimer();
  }

  /** Stop all monitoring and clear timers */
  stop(): void {
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
  }

  /**
   * Process a line of output from the Claude Code process.
   * Checks for interactive patterns and resets the silence timer.
   */
  processLine(text: string): void {
    // Reset silence timer on any output
    this.resetSilenceTimer();

    // Track recent lines for context
    this.recentLines.push(text);
    if (this.recentLines.length > InteractiveDetector.MAX_RECENT_LINES) {
      this.recentLines.shift();
    }

    // Check for interactive patterns (only trigger once)
    if (this.detected) return;

    for (const pattern of INTERACTIVE_PATTERNS) {
      if (pattern.test(text)) {
        this.detected = true;
        this.onDetected(`Interactive prompt detected: "${text.trim()}"`);
        return;
      }
    }
  }

  /** Reset the silence detection timer */
  private resetSilenceTimer(): void {
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
    }

    this.silenceTimer = setTimeout(() => {
      if (this.detected) return;
      this.detected = true;

      const lastLine =
        this.recentLines.length > 0
          ? this.recentLines[this.recentLines.length - 1].trim()
          : "(no recent output)";

      this.onDetected(
        `No output for ${this.silenceTimeoutMs / 1000}s. Last output: "${lastLine}"`,
      );
    }, this.silenceTimeoutMs);
  }
}
