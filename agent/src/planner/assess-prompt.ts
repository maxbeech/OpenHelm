import { callLlmViaCli } from "./llm-via-cli.js";
import { extractJson } from "./extract-json.js";
import { getProject } from "../db/queries/projects.js";
import { PROMPT_ASSESSMENT_SYSTEM_PROMPT } from "./prompts.js";
import type {
  PromptAssessmentResult,
  ClarifyingQuestion,
} from "@openorchestra/shared";

const MAX_QUESTIONS = 2;

/**
 * Assess whether a manual job prompt is specific enough to produce useful
 * results when sent to Claude Code, or whether clarifying questions are needed.
 *
 * This is a softer check than goal assessment — manual job creation implies
 * more intentionality from the user.
 */
export async function assessPrompt(
  projectId: string,
  prompt: string,
): Promise<PromptAssessmentResult> {
  const project = getProject(projectId);
  if (!project) {
    throw new Error(`Project not found: ${projectId}`);
  }

  const userMessage = buildPromptAssessmentMessage(
    project.name,
    project.description,
    prompt,
  );

  const text = await callLlmViaCli({
    model: "classification",
    systemPrompt: PROMPT_ASSESSMENT_SYSTEM_PROMPT,
    userMessage,
  });

  return parsePromptAssessmentResponse(text);
}

function buildPromptAssessmentMessage(
  projectName: string,
  projectDescription: string | null,
  prompt: string,
): string {
  const parts = [
    `Project: ${projectName}`,
    projectDescription ? `Description: ${projectDescription}` : null,
    `\nClaude Code prompt:\n${prompt}`,
  ];
  return parts.filter(Boolean).join("\n");
}

function parsePromptAssessmentResponse(
  text: string,
): PromptAssessmentResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJson(text));
  } catch {
    throw new Error(
      `Failed to parse prompt assessment response as JSON: ${text.slice(0, 200)}`,
    );
  }

  if (typeof parsed !== "object" || parsed === null) {
    throw new Error(
      "Prompt assessment response is not a JSON object",
    );
  }

  const obj = parsed as Record<string, unknown>;

  if (typeof obj.needsClarification !== "boolean") {
    throw new Error(
      "Prompt assessment response missing needsClarification boolean",
    );
  }

  if (!obj.needsClarification) {
    return { needsClarification: false, questions: [] };
  }

  const questions = validateQuestions(obj.questions);
  return { needsClarification: true, questions };
}

function validateQuestions(raw: unknown): ClarifyingQuestion[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return [];
  }

  const questions: ClarifyingQuestion[] = [];
  for (const item of raw.slice(0, MAX_QUESTIONS)) {
    if (
      typeof item === "object" &&
      item !== null &&
      typeof (item as Record<string, unknown>).question === "string" &&
      Array.isArray((item as Record<string, unknown>).options)
    ) {
      questions.push({
        question: (item as Record<string, unknown>).question as string,
        options: ((item as Record<string, unknown>).options as unknown[])
          .filter((o) => typeof o === "string")
          .slice(0, 5) as string[],
      });
    }
  }
  return questions;
}
