import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import { setupTestDb } from "./helpers.js";
import { setSetting } from "../src/db/queries/settings.js";

// Mock the Anthropic SDK before importing client
vi.mock("@anthropic-ai/sdk", () => {
  class MockAuthenticationError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "AuthenticationError";
    }
  }

  class MockRateLimitError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "RateLimitError";
    }
  }

  class MockBadRequestError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "BadRequestError";
    }
  }

  class MockAPIConnectionError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "APIConnectionError";
    }
  }

  class MockAPIConnectionTimeoutError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "APIConnectionTimeoutError";
    }
  }

  class MockInternalServerError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "InternalServerError";
    }
  }

  const createMock = vi.fn();

  class MockAnthropic {
    messages = { create: createMock };
    constructor() {}
  }

  MockAnthropic.AuthenticationError = MockAuthenticationError;
  MockAnthropic.RateLimitError = MockRateLimitError;
  MockAnthropic.BadRequestError = MockBadRequestError;
  MockAnthropic.APIConnectionError = MockAPIConnectionError;
  MockAnthropic.APIConnectionTimeoutError = MockAPIConnectionTimeoutError;
  MockAnthropic.InternalServerError = MockInternalServerError;

  return {
    default: MockAnthropic,
    __createMock: createMock,
  };
});

// Import after mock
import { callLlm, LlmError } from "../src/llm/client.js";
import Anthropic from "@anthropic-ai/sdk";

const { __createMock: createMock } = await import("@anthropic-ai/sdk") as any;

let cleanup: () => void;

beforeAll(() => {
  cleanup = setupTestDb();
});

afterAll(() => {
  cleanup();
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("callLlm", () => {
  it("should throw missing_api_key when no key is configured", async () => {
    await expect(
      callLlm({
        messages: [{ role: "user", content: "hello" }],
      }),
    ).rejects.toThrow(LlmError);

    try {
      await callLlm({ messages: [{ role: "user", content: "hello" }] });
    } catch (err) {
      expect(err).toBeInstanceOf(LlmError);
      expect((err as LlmError).code).toBe("missing_api_key");
    }
  });

  it("should call the SDK with correct parameters", async () => {
    setSetting("anthropic_api_key", "test-key-123");

    const mockResponse = {
      id: "msg_123",
      type: "message",
      role: "assistant",
      content: [{ type: "text", text: "Hello!" }],
      model: "claude-sonnet-4-6",
      stop_reason: "end_turn",
      usage: { input_tokens: 10, output_tokens: 5 },
    };

    createMock.mockResolvedValueOnce(mockResponse);

    const result = await callLlm({
      model: "planning",
      system: "You are helpful.",
      messages: [{ role: "user", content: "hello" }],
      maxTokens: 1024,
    });

    expect(result).toEqual(mockResponse);
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        system: "You are helpful.",
        messages: [{ role: "user", content: "hello" }],
      }),
    );
  });

  it("should use classification model when specified", async () => {
    setSetting("anthropic_api_key", "test-key-123");

    createMock.mockResolvedValueOnce({
      content: [{ type: "text", text: "response" }],
      usage: { input_tokens: 5, output_tokens: 3 },
    });

    await callLlm({
      model: "classification",
      messages: [{ role: "user", content: "classify" }],
    });

    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "claude-haiku-4-5-20251001",
      }),
    );
  });

  it("should use default max_tokens of 4096", async () => {
    setSetting("anthropic_api_key", "test-key-123");

    createMock.mockResolvedValueOnce({
      content: [{ type: "text", text: "ok" }],
      usage: { input_tokens: 5, output_tokens: 3 },
    });

    await callLlm({
      messages: [{ role: "user", content: "hello" }],
    });

    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        max_tokens: 4096,
      }),
    );
  });

  it("should pass tools and temperature when provided", async () => {
    setSetting("anthropic_api_key", "test-key-123");

    createMock.mockResolvedValueOnce({
      content: [{ type: "text", text: "ok" }],
      usage: { input_tokens: 5, output_tokens: 3 },
    });

    const tools = [
      {
        name: "test_tool",
        description: "A test tool",
        input_schema: { type: "object" as const, properties: {} },
      },
    ];

    await callLlm({
      messages: [{ role: "user", content: "hello" }],
      tools,
      temperature: 0.5,
    });

    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        tools,
        temperature: 0.5,
      }),
    );
  });
});
