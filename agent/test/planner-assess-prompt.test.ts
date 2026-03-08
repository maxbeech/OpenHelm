import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import { setupTestDb } from "./helpers.js";
import { createProject } from "../src/db/queries/projects.js";
import { setSetting } from "../src/db/queries/settings.js";

const createMock = vi.fn();

vi.mock("@anthropic-ai/sdk", () => {
  class MockAnthropic {
    messages = { create: createMock };
    constructor() {}
  }
  MockAnthropic.AuthenticationError = class extends Error {};
  MockAnthropic.RateLimitError = class extends Error {};
  MockAnthropic.BadRequestError = class extends Error {};
  MockAnthropic.APIConnectionError = class extends Error {};
  MockAnthropic.APIConnectionTimeoutError = class extends Error {};
  MockAnthropic.InternalServerError = class extends Error {};
  return { default: MockAnthropic };
});

import { assessPrompt } from "../src/planner/assess-prompt.js";

let cleanup: () => void;
let projectId: string;

beforeAll(() => {
  cleanup = setupTestDb();
  setSetting("anthropic_api_key", "test-key-assess-prompt");
  const project = createProject({
    name: "Test Project",
    description: "A TypeScript web application",
    directoryPath: "/tmp/test-project",
  });
  projectId = project.id;
});

afterAll(() => {
  cleanup();
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("assessPrompt", () => {
  it("should return no clarification for a specific prompt", async () => {
    createMock.mockResolvedValueOnce({
      content: [
        {
          type: "text",
          text: JSON.stringify({ needsClarification: false }),
        },
      ],
      stop_reason: "end_turn",
      usage: { input_tokens: 50, output_tokens: 20 },
    });

    const result = await assessPrompt(
      projectId,
      "Run npm test and fix any failing tests in src/utils/",
    );
    expect(result.needsClarification).toBe(false);
    expect(result.questions).toEqual([]);
  });

  it("should return clarifying questions for a vague prompt", async () => {
    createMock.mockResolvedValueOnce({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            needsClarification: true,
            questions: [
              {
                question: "What specifically should be refactored?",
                options: [
                  "Improve type safety",
                  "Reduce code duplication",
                  "Extract shared utilities",
                ],
              },
            ],
          }),
        },
      ],
      stop_reason: "end_turn",
      usage: { input_tokens: 50, output_tokens: 100 },
    });

    const result = await assessPrompt(projectId, "refactor the code");
    expect(result.needsClarification).toBe(true);
    expect(result.questions).toHaveLength(1);
    expect(result.questions[0].question).toContain("refactored");
    expect(result.questions[0].options.length).toBeGreaterThanOrEqual(2);
  });

  it("should cap questions at 2", async () => {
    createMock.mockResolvedValueOnce({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            needsClarification: true,
            questions: [
              { question: "Q1?", options: ["A", "B"] },
              { question: "Q2?", options: ["C", "D"] },
              { question: "Q3?", options: ["E", "F"] },
            ],
          }),
        },
      ],
      stop_reason: "end_turn",
      usage: { input_tokens: 50, output_tokens: 150 },
    });

    const result = await assessPrompt(projectId, "Vague prompt");
    expect(result.questions.length).toBeLessThanOrEqual(2);
  });

  it("should throw on non-existent project", async () => {
    await expect(
      assessPrompt("non-existent-id", "Some prompt"),
    ).rejects.toThrow("Project not found");
  });

  it("should throw on invalid JSON response", async () => {
    createMock.mockResolvedValueOnce({
      content: [{ type: "text", text: "Not valid JSON" }],
      stop_reason: "end_turn",
      usage: { input_tokens: 10, output_tokens: 10 },
    });

    await expect(
      assessPrompt(projectId, "Some prompt"),
    ).rejects.toThrow("Failed to parse prompt assessment response");
  });

  it("should throw when response missing needsClarification", async () => {
    createMock.mockResolvedValueOnce({
      content: [{ type: "text", text: JSON.stringify({ foo: "bar" }) }],
      stop_reason: "end_turn",
      usage: { input_tokens: 10, output_tokens: 10 },
    });

    await expect(
      assessPrompt(projectId, "Some prompt"),
    ).rejects.toThrow("missing needsClarification");
  });

  it("should use classification model tier", async () => {
    createMock.mockResolvedValueOnce({
      content: [
        { type: "text", text: JSON.stringify({ needsClarification: false }) },
      ],
      stop_reason: "end_turn",
      usage: { input_tokens: 10, output_tokens: 10 },
    });

    await assessPrompt(projectId, "Run all tests");

    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "claude-haiku-4-5-20251001",
        temperature: 0,
      }),
    );
  });

  it("should include project context and prompt in the message", async () => {
    createMock.mockResolvedValueOnce({
      content: [
        { type: "text", text: JSON.stringify({ needsClarification: false }) },
      ],
      stop_reason: "end_turn",
      usage: { input_tokens: 10, output_tokens: 10 },
    });

    await assessPrompt(projectId, "Fix linting errors");

    const callArgs = createMock.mock.calls[0][0];
    const userMessage = callArgs.messages[0].content;
    expect(userMessage).toContain("Test Project");
    expect(userMessage).toContain("TypeScript web application");
    expect(userMessage).toContain("Fix linting errors");
  });

  it("should handle empty questions array gracefully", async () => {
    createMock.mockResolvedValueOnce({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            needsClarification: true,
            questions: [],
          }),
        },
      ],
      stop_reason: "end_turn",
      usage: { input_tokens: 10, output_tokens: 10 },
    });

    const result = await assessPrompt(projectId, "Vague prompt");
    expect(result.needsClarification).toBe(true);
    expect(result.questions).toEqual([]);
  });
});
