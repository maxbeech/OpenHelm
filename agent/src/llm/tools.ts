import type { Tool } from "@anthropic-ai/sdk/resources/messages.js";
import { CronExpressionParser } from "cron-parser";

/** Tool definitions available to the planning model */
export const PLANNING_TOOLS: Tool[] = [
  {
    name: "validate_cron_expression",
    description:
      "Validate a cron expression and return the next 3 occurrences in human-readable form. " +
      "Use standard 5-field cron syntax (minute hour day-of-month month day-of-week).",
    input_schema: {
      type: "object" as const,
      properties: {
        expression: {
          type: "string",
          description: "The cron expression to validate (e.g. '0 9 * * 1' for every Monday at 9am)",
        },
      },
      required: ["expression"],
    },
  },
  {
    name: "get_current_datetime",
    description:
      "Get the current date and time in the user's timezone. " +
      "Use this to generate appropriately-timed schedules.",
    input_schema: {
      type: "object" as const,
      properties: {},
    },
  },
];

interface ValidateCronInput {
  expression: string;
}

/** Execute a tool call by name. Returns the result as a string. */
export function executeTool(name: string, input: Record<string, unknown>): string {
  switch (name) {
    case "validate_cron_expression":
      return executeValidateCron(input as unknown as ValidateCronInput);
    case "get_current_datetime":
      return executeGetCurrentDatetime();
    default:
      return JSON.stringify({ error: `Unknown tool: ${name}` });
  }
}

function executeValidateCron(input: ValidateCronInput): string {
  if (!input.expression || input.expression.trim().length === 0) {
    return JSON.stringify({
      valid: false,
      expression: input.expression,
      error: "Cron expression cannot be empty",
    });
  }
  try {
    const expr = CronExpressionParser.parse(input.expression);
    const occurrences: string[] = [];
    for (let i = 0; i < 3; i++) {
      const next = expr.next();
      occurrences.push(next.toDate().toLocaleString());
    }
    return JSON.stringify({
      valid: true,
      expression: input.expression,
      nextOccurrences: occurrences,
    });
  } catch (err) {
    return JSON.stringify({
      valid: false,
      expression: input.expression,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

function executeGetCurrentDatetime(): string {
  const now = new Date();
  return JSON.stringify({
    iso: now.toISOString(),
    local: now.toLocaleString(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    dayOfWeek: now.toLocaleDateString("en-US", { weekday: "long" }),
  });
}
