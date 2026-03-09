import { callLlmViaCli } from "./llm-via-cli.js";
import { validateCronExpression } from "./cron-validator.js";
import { extractJson } from "./extract-json.js";
import { getProject } from "../db/queries/projects.js";
import { PLAN_GENERATION_SYSTEM_PROMPT } from "./prompts.js";
import type {
  GeneratedPlan,
  PlannedJob,
  ScheduleType,
} from "@openorchestra/shared";

const MIN_JOBS = 2;
const MAX_JOBS = 6;
const VALID_SCHEDULE_TYPES: ScheduleType[] = ["once", "interval", "cron"];
const JSON_PARSE_MAX_RETRIES = 1;

/**
 * Generate a plan of Claude Code jobs for a given goal.
 * Uses a single-turn CLI call with post-generation cron validation.
 * Retries once automatically on JSON parse failures (malformed LLM output).
 */
export async function generatePlan(
  projectId: string,
  goalDescription: string,
  clarificationAnswers?: Record<string, string>,
): Promise<GeneratedPlan> {
  const project = getProject(projectId);
  if (!project) {
    throw new Error(`Project not found: ${projectId}`);
  }

  const userMessage = buildGenerationMessage(
    project.name,
    project.description,
    project.directoryPath,
    goalDescription,
    clarificationAnswers,
  );

  let lastError: unknown;

  for (let attempt = 0; attempt <= JSON_PARSE_MAX_RETRIES; attempt++) {
    const text = await callLlmViaCli({
      model: "planning",
      systemPrompt: PLAN_GENERATION_SYSTEM_PROMPT,
      userMessage,
    });

    try {
      const plan = parsePlanResponse(text);
      validatePlanCronExpressions(plan);
      return plan;
    } catch (err) {
      lastError = err;
      if (attempt < JSON_PARSE_MAX_RETRIES) {
        console.error(
          `[planner] plan generation failed (attempt ${attempt + 1}), retrying`,
        );
      }
    }
  }

  throw lastError;
}

function buildGenerationMessage(
  projectName: string,
  projectDescription: string | null,
  directoryPath: string,
  goalDescription: string,
  clarificationAnswers?: Record<string, string>,
): string {
  // Inline datetime context (replaces get_current_datetime tool)
  const now = new Date();
  const datetimeContext = [
    `Current datetime: ${now.toISOString()}`,
    `Timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`,
    `Day of week: ${now.toLocaleDateString("en-US", { weekday: "long" })}`,
  ].join("\n");

  const parts = [
    datetimeContext,
    "",
    `Project: ${projectName}`,
    `Directory: ${directoryPath}`,
    projectDescription ? `Description: ${projectDescription}` : null,
    `\nGoal: ${goalDescription}`,
  ];

  if (clarificationAnswers && Object.keys(clarificationAnswers).length > 0) {
    parts.push("\nAdditional context from user:");
    for (const [question, answer] of Object.entries(clarificationAnswers)) {
      parts.push(`Q: ${question}\nA: ${answer}`);
    }
  }

  return parts.filter(Boolean).join("\n");
}

/** Validate all cron expressions in a generated plan */
function validatePlanCronExpressions(plan: GeneratedPlan): void {
  for (let i = 0; i < plan.jobs.length; i++) {
    const job = plan.jobs[i];
    if (job.scheduleType === "cron") {
      const config = job.scheduleConfig as { expression?: string };
      if (config.expression) {
        try {
          validateCronExpression(config.expression);
        } catch {
          throw new Error(
            `Job at index ${i} has invalid cron expression: ${config.expression}`,
          );
        }
      }
    }
  }
}

function parsePlanResponse(text: string): GeneratedPlan {
  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJson(text));
  } catch {
    throw new Error(
      `Failed to parse plan response as JSON: ${text.slice(0, 300)}`,
    );
  }

  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("Plan response is not a JSON object");
  }

  const obj = parsed as Record<string, unknown>;
  if (!Array.isArray(obj.jobs)) {
    throw new Error("Plan response missing jobs array");
  }

  if (obj.jobs.length < MIN_JOBS || obj.jobs.length > MAX_JOBS) {
    throw new Error(
      `Plan must contain ${MIN_JOBS}-${MAX_JOBS} jobs, got ${obj.jobs.length}`,
    );
  }

  const jobs = obj.jobs.map(validatePlannedJob);
  return { jobs };
}

function validatePlannedJob(raw: unknown, index: number): PlannedJob {
  if (typeof raw !== "object" || raw === null) {
    throw new Error(`Job at index ${index} is not an object`);
  }

  const obj = raw as Record<string, unknown>;
  const required = ["name", "description", "prompt", "rationale", "scheduleType", "scheduleConfig"];

  for (const field of required) {
    if (!obj[field] && obj[field] !== 0) {
      throw new Error(`Job at index ${index} missing required field: ${field}`);
    }
  }

  if (typeof obj.name !== "string" || obj.name.trim().length === 0) {
    throw new Error(`Job at index ${index} has empty name`);
  }
  if (typeof obj.description !== "string" || obj.description.trim().length === 0) {
    throw new Error(`Job at index ${index} has empty description`);
  }
  if (typeof obj.prompt !== "string" || obj.prompt.trim().length === 0) {
    throw new Error(`Job at index ${index} has empty prompt`);
  }
  if (typeof obj.rationale !== "string" || obj.rationale.trim().length === 0) {
    throw new Error(`Job at index ${index} has empty rationale`);
  }

  if (!VALID_SCHEDULE_TYPES.includes(obj.scheduleType as ScheduleType)) {
    throw new Error(
      `Job at index ${index} has invalid scheduleType: ${obj.scheduleType}`,
    );
  }

  if (typeof obj.scheduleConfig !== "object" || obj.scheduleConfig === null) {
    throw new Error(`Job at index ${index} has invalid scheduleConfig`);
  }

  return {
    name: (obj.name as string).trim(),
    description: (obj.description as string).trim(),
    prompt: (obj.prompt as string).trim(),
    rationale: (obj.rationale as string).trim(),
    scheduleType: obj.scheduleType as ScheduleType,
    scheduleConfig: obj.scheduleConfig as PlannedJob["scheduleConfig"],
  };
}
