import { registerHandler } from "../handler.js";
import { assessGoal } from "../../planner/assess.js";
import { assessPrompt } from "../../planner/assess-prompt.js";
import { generatePlan } from "../../planner/generate.js";
import { commitPlan } from "../../planner/commit.js";
import type {
  AssessGoalParams,
  AssessPromptParams,
  GeneratePlanParams,
  CommitPlanParams,
} from "@openorchestra/shared";

export function registerPlannerHandlers() {
  registerHandler("planner.assess", async (params) => {
    const { projectId, goalDescription } = params as AssessGoalParams;
    if (!projectId || !goalDescription) {
      throw new Error("projectId and goalDescription are required");
    }
    return assessGoal(projectId, goalDescription);
  });

  registerHandler("planner.assessPrompt", async (params) => {
    const { projectId, prompt } = params as AssessPromptParams;
    if (!projectId || !prompt) {
      throw new Error("projectId and prompt are required");
    }
    return assessPrompt(projectId, prompt);
  });

  registerHandler("planner.generate", async (params) => {
    const { projectId, goalDescription, clarificationAnswers } =
      params as GeneratePlanParams;
    if (!projectId || !goalDescription) {
      throw new Error("projectId and goalDescription are required");
    }
    return generatePlan(projectId, goalDescription, clarificationAnswers);
  });

  registerHandler("planner.commit", (params) => {
    const { projectId, goalDescription, jobs } = params as CommitPlanParams;
    if (!projectId || !goalDescription || !jobs) {
      throw new Error("projectId, goalDescription, and jobs are required");
    }
    if (!Array.isArray(jobs) || jobs.length === 0) {
      throw new Error("jobs must be a non-empty array");
    }
    return commitPlan(projectId, goalDescription, jobs);
  });
}
