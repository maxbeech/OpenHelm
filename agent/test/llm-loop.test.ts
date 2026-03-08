import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import { setupTestDb } from "./helpers.js";
import { setSetting } from "../src/db/queries/settings.js";

// Track call count for multi-turn responses
let callCount = 0;
const createMock = vi.fn();

vi.mock("@anthropic-ai/sdk", () => {
  class MockAnthropic {
    messages = { create: createMock };
    constructor() {}
  }
  // Add error classes that client.ts checks with instanceof
  MockAnthropic.AuthenticationError = class extends Error {};
  MockAnthropic.RateLimitError = class extends Error {};
  MockAnthropic.BadRequestError = class extends Error {};
  MockAnthropic.APIConnectionError = class extends Error {};
  MockAnthropic.APIConnectionTimeoutError = class extends Error {};
  MockAnthropic.InternalServerError = class extends Error {};
  return { default: MockAnthropic };
});

import { runAgentLoop } from "../src/llm/loop.js";
import { LlmError } from "../src/llm/client.js";

let cleanup: () => void;

beforeAll(() => {
  cleanup = setupTestDb();
  setSetting("anthropic_api_key", "test-key-loop");
});

afterAll(() => {
  cleanup();
});

beforeEach(() => {
  vi.clearAllMocks();
  callCount = 0;
});

describe("runAgentLoop", () => {
  it("should return text on a single-turn response (no tool use)", async () => {
    createMock.mockResolvedValueOnce({
      content: [{ type: "text", text: "Final answer" }],
      stop_reason: "end_turn",
      usage: { input_tokens: 10, output_tokens: 5 },
    });

    const result = await runAgentLoop({
      system: "You are helpful.",
      messages: [{ role: "user", content: "hello" }],
    });

    expect(result.text).toBe("Final answer");
    expect(result.iterations).toBe(1);
    expect(result.totalTokens.input).toBe(10);
    expect(result.totalTokens.output).toBe(5);
    expect(createMock).toHaveBeenCalledTimes(1);
  });

  it("should handle a tool-use turn followed by a final response", async () => {
    // First call: model wants to use a tool
    createMock.mockResolvedValueOnce({
      content: [
        {
          type: "tool_use",
          id: "toolu_123",
          name: "get_current_datetime",
          input: {},
        },
      ],
      stop_reason: "tool_use",
      usage: { input_tokens: 15, output_tokens: 20 },
    });

    // Second call: model gives final answer
    createMock.mockResolvedValueOnce({
      content: [{ type: "text", text: "The time is 2026-03-08T12:00:00Z" }],
      stop_reason: "end_turn",
      usage: { input_tokens: 30, output_tokens: 10 },
    });

    const result = await runAgentLoop({
      system: "Use tools.",
      messages: [{ role: "user", content: "What time is it?" }],
      tools: [
        {
          name: "get_current_datetime",
          description: "Get current time",
          input_schema: { type: "object" as const, properties: {} },
        },
      ],
    });

    expect(result.text).toBe("The time is 2026-03-08T12:00:00Z");
    expect(result.iterations).toBe(2);
    expect(result.totalTokens.input).toBe(45);
    expect(result.totalTokens.output).toBe(30);
    expect(createMock).toHaveBeenCalledTimes(2);

    // Verify tool result was sent back
    const secondCallArgs = createMock.mock.calls[1][0];
    const lastMessage = secondCallArgs.messages[secondCallArgs.messages.length - 1];
    expect(lastMessage.role).toBe("user");
    expect(lastMessage.content[0].type).toBe("tool_result");
    expect(lastMessage.content[0].tool_use_id).toBe("toolu_123");

    // Verify tool result contains datetime JSON
    const toolResult = JSON.parse(lastMessage.content[0].content);
    expect(toolResult.iso).toBeDefined();
    expect(toolResult.timezone).toBeDefined();
  });

  it("should handle validate_cron_expression tool call", async () => {
    createMock.mockResolvedValueOnce({
      content: [
        {
          type: "tool_use",
          id: "toolu_456",
          name: "validate_cron_expression",
          input: { expression: "0 9 * * 1" },
        },
      ],
      stop_reason: "tool_use",
      usage: { input_tokens: 10, output_tokens: 15 },
    });

    createMock.mockResolvedValueOnce({
      content: [{ type: "text", text: "The cron is valid" }],
      stop_reason: "end_turn",
      usage: { input_tokens: 20, output_tokens: 5 },
    });

    const result = await runAgentLoop({
      system: "Validate crons.",
      messages: [{ role: "user", content: "Check this cron" }],
      tools: [
        {
          name: "validate_cron_expression",
          description: "Validate cron",
          input_schema: {
            type: "object" as const,
            properties: { expression: { type: "string" } },
            required: ["expression"],
          },
        },
      ],
    });

    expect(result.text).toBe("The cron is valid");

    // Verify cron validation result was sent
    const secondCallArgs = createMock.mock.calls[1][0];
    const lastMessage = secondCallArgs.messages[secondCallArgs.messages.length - 1];
    const toolResult = JSON.parse(lastMessage.content[0].content);
    expect(toolResult.valid).toBe(true);
    expect(toolResult.nextOccurrences).toHaveLength(3);
  });

  it("should throw when max iterations exceeded", async () => {
    // Always return tool_use to force infinite loop
    createMock.mockResolvedValue({
      content: [
        {
          type: "tool_use",
          id: "toolu_loop",
          name: "get_current_datetime",
          input: {},
        },
      ],
      stop_reason: "tool_use",
      usage: { input_tokens: 5, output_tokens: 5 },
    });

    await expect(
      runAgentLoop({
        system: "Loop forever.",
        messages: [{ role: "user", content: "loop" }],
        tools: [
          {
            name: "get_current_datetime",
            description: "Get time",
            input_schema: { type: "object" as const, properties: {} },
          },
        ],
        maxIterations: 2,
      }),
    ).rejects.toThrow("exceeded maximum iterations");
  });

  it("should accumulate tokens across iterations", async () => {
    createMock.mockResolvedValueOnce({
      content: [
        { type: "tool_use", id: "t1", name: "get_current_datetime", input: {} },
      ],
      stop_reason: "tool_use",
      usage: { input_tokens: 100, output_tokens: 50 },
    });

    createMock.mockResolvedValueOnce({
      content: [{ type: "text", text: "done" }],
      stop_reason: "end_turn",
      usage: { input_tokens: 200, output_tokens: 30 },
    });

    const result = await runAgentLoop({
      system: "test",
      messages: [{ role: "user", content: "test" }],
    });

    expect(result.totalTokens.input).toBe(300);
    expect(result.totalTokens.output).toBe(80);
  });

  it("should handle multiple tool uses in a single response", async () => {
    createMock.mockResolvedValueOnce({
      content: [
        { type: "tool_use", id: "t1", name: "get_current_datetime", input: {} },
        {
          type: "tool_use",
          id: "t2",
          name: "validate_cron_expression",
          input: { expression: "0 9 * * 1" },
        },
      ],
      stop_reason: "tool_use",
      usage: { input_tokens: 20, output_tokens: 30 },
    });

    createMock.mockResolvedValueOnce({
      content: [{ type: "text", text: "Both tools executed" }],
      stop_reason: "end_turn",
      usage: { input_tokens: 40, output_tokens: 10 },
    });

    const result = await runAgentLoop({
      system: "test",
      messages: [{ role: "user", content: "use both tools" }],
    });

    expect(result.text).toBe("Both tools executed");

    // Verify both tool results sent
    const secondCallArgs = createMock.mock.calls[1][0];
    const lastMessage = secondCallArgs.messages[secondCallArgs.messages.length - 1];
    expect(lastMessage.content).toHaveLength(2);
    expect(lastMessage.content[0].tool_use_id).toBe("t1");
    expect(lastMessage.content[1].tool_use_id).toBe("t2");
  });

  it("should use default maxIterations of 3", async () => {
    // Return tool_use 3 times, then it should throw
    createMock.mockResolvedValue({
      content: [
        { type: "tool_use", id: "t", name: "get_current_datetime", input: {} },
      ],
      stop_reason: "tool_use",
      usage: { input_tokens: 5, output_tokens: 5 },
    });

    await expect(
      runAgentLoop({
        system: "test",
        messages: [{ role: "user", content: "loop" }],
      }),
    ).rejects.toThrow("exceeded maximum iterations (3)");

    expect(createMock).toHaveBeenCalledTimes(3);
  });
});
