/**
 * Adapter that planner modules call instead of the old Anthropic SDK client.
 * Translates planner needs into runClaudeCodePrint calls.
 */

import { runClaudeCodePrint } from "../claude-code/print.js";
import { getSetting } from "../db/queries/settings.js";

export type ModelTier = "planning" | "classification";

export interface LlmCallConfig {
  model?: ModelTier;
  systemPrompt: string;
  userMessage: string;
  timeoutMs?: number;
  jsonSchema?: object;
}

const MODEL_MAP: Record<ModelTier, string> = {
  planning: "sonnet",
  classification: "claude-haiku-4-5-20251001",
};

// Tier-specific timeouts: planning (sonnet) is much slower than classification (haiku).
const TIMEOUT_MAP: Record<ModelTier, number> = {
  planning: 180_000,      // 3 minutes — sonnet plan generation can take 60-90s
  classification: 60_000, // 1 minute — haiku assess/summarise is fast but allow headroom
};

/**
 * Call the LLM via the Claude Code CLI in --print mode.
 * All internal LLM calls (planning, assessment, summarisation) route through here.
 */
export async function callLlmViaCli(config: LlmCallConfig): Promise<string> {
  const binaryPath = getClaudeCodePath();

  const tier = config.model ?? "planning";
  const model = MODEL_MAP[tier];
  const timeoutMs = config.timeoutMs ?? TIMEOUT_MAP[tier];

  const result = await runClaudeCodePrint({
    binaryPath,
    prompt: config.userMessage,
    systemPrompt: config.systemPrompt,
    model,
    disableTools: true,
    timeoutMs,
    jsonSchema: config.jsonSchema,
  });

  return result.text;
}

function getClaudeCodePath(): string {
  const setting = getSetting("claude_code_path");
  if (!setting?.value) {
    throw new Error(
      "Claude Code CLI not configured. Complete setup in Settings.",
    );
  }
  return setting.value;
}
