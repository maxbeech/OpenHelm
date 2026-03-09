/**
 * Run Summarisation — generates a plain-English summary of a completed run.
 *
 * Uses a single CLI call to Haiku via --print mode. Invoked by the executor
 * after a run reaches a terminal state, before the statusChanged event is emitted.
 *
 * Summarisation failures must never affect run status or system stability.
 */

import { listRunLogs } from "../db/queries/run-logs.js";
import { callLlmViaCli } from "./llm-via-cli.js";
import { PrintError } from "../claude-code/print.js";
import type { RunStatus } from "@openorchestra/shared";

const MAX_LOG_CHARS = 8_000;

const SUMMARIZE_SYSTEM_PROMPT = `You summarise the output of automated coding runs for a desktop app called OpenOrchestra.

Given the run status and the run's log output, write a 2–3 sentence plain-English summary:
- Whether the run succeeded or failed
- What was accomplished or what went wrong
- Any important action items for the user

Rules:
- Never include raw error codes, stack traces, or file paths verbatim — those are available in the log viewer.
- Be concise and helpful — a busy developer should understand the outcome at a glance.
- Respond with ONLY the summary text. No prefixes like "Summary:" or markdown formatting.`;

/** Truncate log text to the last MAX_LOG_CHARS, keeping the end (where results and errors appear) */
export function truncateLogs(fullText: string): string {
  if (fullText.length <= MAX_LOG_CHARS) return fullText;
  return (
    "[Earlier output was truncated — showing the final portion of the run output]\n" +
    fullText.slice(-MAX_LOG_CHARS)
  );
}

/** Collect all log chunks for a run into a single string */
export function collectRunLogs(runId: string): string {
  const logs = listRunLogs({ runId });
  return logs.map((l) => l.text).join("");
}

/**
 * Generate a plain-English summary for a completed run.
 * Returns null if summarisation fails for any reason.
 */
export async function generateRunSummary(
  runId: string,
  status: RunStatus,
): Promise<string | null> {
  try {
    const fullText = collectRunLogs(runId);
    if (!fullText.trim()) {
      return status === "succeeded"
        ? "Run completed successfully with no output."
        : "Run ended with no output captured.";
    }

    const truncated = truncateLogs(fullText);
    const userMessage = `Run status: ${status}\n\nRun output:\n${truncated}`;

    const text = await callLlmViaCli({
      model: "classification",
      systemPrompt: SUMMARIZE_SYSTEM_PROMPT,
      userMessage,
    });

    return text.trim() || null;
  } catch (err) {
    // Log the failure but never propagate — summarisation is best-effort
    const message = err instanceof PrintError ? err.message : String(err);
    console.error(`[summariser] failed for run ${runId}: ${message}`);
    return null;
  }
}
