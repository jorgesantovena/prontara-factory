/**
 * LLMProvider · puerto.
 *
 * Lo que el dominio necesita de un LLM con tool calling. Pensado para
 * Anthropic Claude pero podría servir para OpenAI / Gemini / local
 * adaptando el adapter.
 *
 * Foco actual: streaming SSE para el Factory Chat. La pieza no-streaming
 * (single completion) la dejamos abstracta para añadir cuando aparezca.
 */
export type LLMRole = "user" | "assistant" | "system";

export type LLMTextBlock = { type: "text"; text: string };
export type LLMImageBlock = {
  type: "image";
  source: { type: "base64"; mediaType: string; data: string };
};
export type LLMToolUseBlock = {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
};
export type LLMToolResultBlock = {
  type: "tool_result";
  toolUseId: string;
  content: string;
  isError?: boolean;
};

export type LLMContentBlock =
  | LLMTextBlock
  | LLMImageBlock
  | LLMToolUseBlock
  | LLMToolResultBlock;

export type LLMMessage = {
  role: LLMRole;
  content: string | LLMContentBlock[];
};

export type LLMToolDefinition = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

export type LLMStreamRequest = {
  model: string;
  systemPrompt?: string;
  messages: LLMMessage[];
  tools?: LLMToolDefinition[];
  maxTokens?: number;
  temperature?: number;
};

/**
 * Eventos que el adapter emite al stream del caller. La forma intenta
 * ser proveedor-agnóstica: el caller no sabe si es Anthropic SSE o
 * OpenAI SSE.
 */
export type LLMStreamEvent =
  | { type: "text_delta"; delta: string }
  | { type: "tool_use_start"; id: string; name: string }
  | { type: "tool_use_input_delta"; id: string; partialJson: string }
  | { type: "tool_use_complete"; id: string; input: Record<string, unknown> }
  | {
      type: "message_stop";
      stopReason?: "end_turn" | "tool_use" | "max_tokens" | "stop_sequence";
      usage?: { inputTokens: number; outputTokens: number };
    }
  | { type: "error"; error: string };

export interface LLMProvider {
  readonly name: string;

  /**
   * Streaming de tokens y eventos del LLM. Devuelve un AsyncIterable
   * para que el caller (típicamente una API route que reenvía SSE al
   * cliente) pueda iterar sin cargar todo en memoria.
   */
  stream(request: LLMStreamRequest): AsyncIterable<LLMStreamEvent>;
}
