/**
 * Extract a JSON object from text that may contain surrounding prose/markdown.
 *
 * Claude CLI responses in --output-format text often include explanation
 * text around the JSON. This helper finds and extracts the JSON portion.
 */
export function extractJson(text: string): string {
  const trimmed = text.trim();

  // 1. Try direct parse first (ideal case — response is pure JSON)
  try {
    JSON.parse(trimmed);
    return trimmed;
  } catch {
    // continue
  }

  // 2. Strip markdown code fences
  const fenceMatch = trimmed.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);
  if (fenceMatch) {
    return fenceMatch[1].trim();
  }

  // 3. Extract first top-level JSON object by brace matching
  const start = trimmed.indexOf("{");
  if (start !== -1) {
    let depth = 0;
    let inString = false;
    let escape = false;
    for (let i = start; i < trimmed.length; i++) {
      const ch = trimmed[i];
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === "\\") {
        escape = true;
        continue;
      }
      if (ch === '"') {
        inString = !inString;
        continue;
      }
      if (inString) continue;
      if (ch === "{") depth++;
      if (ch === "}") {
        depth--;
        if (depth === 0) {
          return trimmed.slice(start, i + 1);
        }
      }
    }
  }

  // 4. Give up — return original text (caller will get a JSON.parse error)
  return trimmed;
}
