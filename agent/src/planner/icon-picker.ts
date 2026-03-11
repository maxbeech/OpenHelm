/**
 * icon-picker.ts — Uses the LLM (haiku) to pick a suitable emoji icon
 * for a goal or job based on its name and description.
 *
 * Runs in the background after creation — never blocks the create response.
 */

import { callLlmViaCli } from "./llm-via-cli.js";

const SYSTEM_PROMPT = `You are an icon selector. Given a name and optional description for a task or goal, respond with a single emoji that best represents it. Rules:
- Return ONLY the emoji character, nothing else
- Pick an emoji that visually represents the concept, not generic ones
- Prefer distinctive, recognizable emoji
- Never return text, punctuation, or explanations`;

/**
 * Ask the LLM to pick a single emoji icon for the given name/description.
 * Returns the emoji string, or null if the call fails.
 */
export async function pickIcon(
  name: string,
  description?: string | null,
): Promise<string | null> {
  try {
    const userMessage = description
      ? `Name: ${name}\nDescription: ${description}`
      : `Name: ${name}`;

    const result = await callLlmViaCli({
      model: "classification",
      systemPrompt: SYSTEM_PROMPT,
      userMessage,
      timeoutMs: 30_000,
    });

    const emoji = result.trim();
    // Validate: should be 1-2 chars (emoji can be multi-codepoint)
    if (emoji.length > 0 && emoji.length <= 8) {
      return emoji;
    }
    console.error(`[icon-picker] unexpected response: "${emoji}"`);
    return null;
  } catch (err) {
    console.error(
      `[icon-picker] failed:`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}
