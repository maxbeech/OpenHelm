import Anthropic from "@anthropic-ai/sdk";
import type { MessageParam, Tool, ToolChoice } from "@anthropic-ai/sdk/resources/messages.js";
import { getSetting } from "../db/queries/settings.js";

// Current model IDs — update here if Anthropic changes them
const PLANNING_MODEL = "claude-sonnet-4-6";
const CLASSIFICATION_MODEL = "claude-haiku-4-5-20251001";

const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_MAX_TOKENS = 4096;

export class LlmError extends Error {
  constructor(
    message: string,
    public readonly code: LlmErrorCode,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "LlmError";
  }
}

export type LlmErrorCode =
  | "missing_api_key"
  | "authentication_failed"
  | "rate_limited"
  | "overloaded"
  | "invalid_request"
  | "network_error"
  | "timeout"
  | "unknown";

export type ModelTier = "planning" | "classification";

export interface LlmCallOptions {
  model?: ModelTier;
  system?: string;
  messages: MessageParam[];
  maxTokens?: number;
  tools?: Tool[];
  toolChoice?: ToolChoice;
  temperature?: number;
}

function resolveModel(tier: ModelTier): string {
  return tier === "planning" ? PLANNING_MODEL : CLASSIFICATION_MODEL;
}

function getApiKey(): string {
  const setting = getSetting("anthropic_api_key");
  if (!setting?.value) {
    throw new LlmError(
      "Anthropic API key not configured. Set it in Settings.",
      "missing_api_key",
    );
  }
  return setting.value;
}

function mapSdkError(err: unknown): LlmError {
  if (err instanceof LlmError) return err;

  if (err instanceof Anthropic.AuthenticationError) {
    return new LlmError("Invalid Anthropic API key.", "authentication_failed", err);
  }
  if (err instanceof Anthropic.RateLimitError) {
    return new LlmError("Anthropic rate limit exceeded. Try again shortly.", "rate_limited", err);
  }
  if (err instanceof Anthropic.InternalServerError) {
    return new LlmError("Anthropic API is overloaded. Try again later.", "overloaded", err);
  }
  if (err instanceof Anthropic.BadRequestError) {
    return new LlmError(`Invalid request: ${(err as Error).message}`, "invalid_request", err);
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return new LlmError("Network error connecting to Anthropic.", "network_error", err);
  }
  if (err instanceof Anthropic.APIConnectionTimeoutError) {
    return new LlmError("Request to Anthropic timed out.", "timeout", err);
  }

  const message = err instanceof Error ? err.message : String(err);
  return new LlmError(`LLM call failed: ${message}`, "unknown", err);
}

/** Send a single messages.create call to the Anthropic API */
export async function callLlm(options: LlmCallOptions): Promise<Anthropic.Message> {
  const apiKey = getApiKey();
  const client = new Anthropic({ apiKey, timeout: DEFAULT_TIMEOUT_MS });
  const model = resolveModel(options.model ?? "planning");

  try {
    const response = await client.messages.create({
      model,
      max_tokens: options.maxTokens ?? DEFAULT_MAX_TOKENS,
      system: options.system,
      messages: options.messages,
      tools: options.tools,
      tool_choice: options.toolChoice,
      temperature: options.temperature,
    });
    return response;
  } catch (err) {
    throw mapSdkError(err);
  }
}

export { PLANNING_MODEL, CLASSIFICATION_MODEL };
