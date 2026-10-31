/**
 * Provider-agnostic LLM adapter used by the AgentRunner.
 * Each provider (OpenAI, Anthropic, etc.) implements this interface
 * so the runner code stays LLM-agnostic.
 */

export interface LlmToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON schema
}

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | LlmMessageContent[];
  toolCallId?: string; // for role='tool'
  toolCalls?: LlmToolCall[]; // for role='assistant'
}

export type LlmMessageContent =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; toolUseId: string; content: string; isError?: boolean };

export interface LlmToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface LlmChatRequest {
  model: string;
  systemPrompt?: string;
  messages: LlmMessage[];
  tools?: LlmToolDefinition[];
  temperature?: number;
  maxTokens?: number;
}

export interface LlmChatResponse {
  text: string;
  toolCalls: LlmToolCall[];
  stopReason: 'end_turn' | 'tool_use' | 'max_tokens' | 'stop_sequence';
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
}

/**
 * Streaming events emitted during a chat turn.
 * The `text_delta` events carry incremental token content; the final
 * `completed` event carries the aggregated response.
 */
export type LlmStreamEvent =
  | { type: 'text_delta'; delta: string }
  | { type: 'completed'; response: LlmChatResponse };

export interface LlmProvider {
  readonly name: 'openai' | 'anthropic';
  chat(request: LlmChatRequest): Promise<LlmChatResponse>;
  /**
   * Optional streaming API. Providers should aggregate the response and
   * always emit a final `completed` event with the full LlmChatResponse.
   */
  chatStream?(request: LlmChatRequest, onEvent: (ev: LlmStreamEvent) => void): Promise<LlmChatResponse>;
}

/** Pick provider based on the model string. */
export function providerForModel(model: string): 'openai' | 'anthropic' {
  const lower = model.toLowerCase();
  if (
    lower.startsWith('gpt-') ||
    lower.startsWith('gpt.') ||
    lower.startsWith('o1-') ||
    lower.startsWith('o3-') ||
    lower.startsWith('o4-') ||
    lower.startsWith('text-') ||
    lower === 'gpt-4' ||
    lower === 'gpt-4o' ||
    lower === 'gpt-4.1'
  ) {
    return 'openai';
  }
  if (lower.startsWith('claude-')) {
    return 'anthropic';
  }
  // Default fallback
  return 'openai';
}
