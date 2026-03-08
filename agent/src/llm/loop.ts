import type Anthropic from "@anthropic-ai/sdk";
import type { MessageParam, Tool, ToolChoice } from "@anthropic-ai/sdk/resources/messages.js";
import { callLlm, LlmError, type ModelTier } from "./client.js";
import { executeTool } from "./tools.js";

const DEFAULT_MAX_ITERATIONS = 3;

export interface AgentLoopOptions {
  model?: ModelTier;
  system: string;
  messages: MessageParam[];
  tools?: Tool[];
  toolChoice?: ToolChoice;
  maxTokens?: number;
  maxIterations?: number;
  temperature?: number;
}

export interface AgentLoopResult {
  /** Final text output from the model */
  text: string;
  /** Number of iterations (tool-calling rounds) performed */
  iterations: number;
  /** Total tokens used across all iterations */
  totalTokens: { input: number; output: number };
}

/**
 * Run the agent loop: send a message, handle tool calls, repeat until
 * the model produces a final text response or max iterations reached.
 */
export async function runAgentLoop(options: AgentLoopOptions): Promise<AgentLoopResult> {
  const maxIterations = options.maxIterations ?? DEFAULT_MAX_ITERATIONS;
  const messages: MessageParam[] = [...options.messages];
  let iterations = 0;
  const totalTokens = { input: 0, output: 0 };

  while (iterations < maxIterations) {
    iterations++;

    const response = await callLlm({
      model: options.model,
      system: options.system,
      messages,
      tools: options.tools,
      toolChoice: options.toolChoice,
      maxTokens: options.maxTokens,
      temperature: options.temperature,
    });

    totalTokens.input += response.usage.input_tokens;
    totalTokens.output += response.usage.output_tokens;

    // If no tool use, extract final text and return
    if (response.stop_reason !== "tool_use") {
      const text = extractText(response);
      return { text, iterations, totalTokens };
    }

    // Process tool calls
    const toolUseBlocks = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
    );

    if (toolUseBlocks.length === 0) {
      const text = extractText(response);
      return { text, iterations, totalTokens };
    }

    // Add assistant message with the full content (including tool_use blocks)
    messages.push({ role: "assistant", content: response.content });

    // Execute each tool and build the tool_result message
    const toolResults: Anthropic.ToolResultBlockParam[] = toolUseBlocks.map((block) => {
      const result = executeTool(block.name, block.input as Record<string, unknown>);
      return {
        type: "tool_result" as const,
        tool_use_id: block.id,
        content: result,
      };
    });

    messages.push({ role: "user", content: toolResults });
  }

  throw new LlmError(
    `Agent loop exceeded maximum iterations (${maxIterations})`,
    "unknown",
  );
}

function extractText(response: Anthropic.Message): string {
  const textBlocks = response.content.filter(
    (b): b is Anthropic.TextBlock => b.type === "text",
  );
  return textBlocks.map((b) => b.text).join("\n");
}
