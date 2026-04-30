/**
 * Cliente directo de la API de Anthropic vía fetch (sin SDK, sin dependencia).
 *
 * Implementa el loop agente: envía mensajes al modelo, si el modelo pide
 * tools, las ejecuta localmente y reenvía el resultado para que el modelo
 * continúe. Termina cuando el modelo devuelve `stop_reason: "end_turn"`.
 *
 * Expone dos modos:
 *   - `runAgentStream`: yields chunks de texto mientras el modelo escribe
 *     (para SSE al cliente).
 *   - `runAgentOnce`: devuelve respuesta completa (útil para debugging).
 *
 * El historial que se envía al modelo es la lista completa de mensajes
 * del hilo, formateados según el esquema Anthropic. Cada turno de
 * tool use añade un mensaje `assistant` con bloques `text` + `tool_use`
 * y un mensaje `user` con bloques `tool_result`.
 */

import { TOOL_SCHEMAS, executeTool } from "@/lib/factory-chat/tools";
import type { ToolContext } from "@/lib/factory-chat/audit";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL = "claude-sonnet-4-6";
const ANTHROPIC_VERSION = "2023-06-01";
const MAX_TOOL_ITERATIONS = 10;

// Tipos mínimos de la API de Anthropic (messages API).
// Exportados para que adapters externos (ARQ-9: ports/llm-provider via
// adapters/llm-anthropic) puedan reusarlos sin redefinirlos.
export type AnthropicTextBlock = { type: "text"; text: string };
export type AnthropicImageBlock = {
  type: "image";
  source: {
    type: "base64";
    media_type: "image/png" | "image/jpeg" | "image/gif" | "image/webp";
    data: string;
  };
};
export type AnthropicToolUseBlock = {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
};
export type AnthropicToolResultBlock = {
  type: "tool_result";
  tool_use_id: string;
  content: string;
  is_error?: boolean;
};
export type AnthropicContentBlock =
  | AnthropicTextBlock
  | AnthropicImageBlock
  | AnthropicToolUseBlock
  | AnthropicToolResultBlock;
export type AnthropicMessage = {
  role: "user" | "assistant";
  content: string | AnthropicContentBlock[];
};

export type StreamEvent =
  | { type: "text"; text: string }
  | { type: "tool_use_start"; name: string; input: Record<string, unknown> }
  | { type: "tool_use_result"; name: string; resultPreview: string }
  | { type: "done"; reason: string; usage?: { inputTokens: number; outputTokens: number } }
  | { type: "error"; message: string };

export type RunAgentOptions = {
  apiKey: string;
  model?: string;
  systemPrompt: string;
  messages: AnthropicMessage[];
  onEvent: (event: StreamEvent) => void;
  /**
   * Contexto del actor (accountId, email, conversationId) — se pasa a las
   * tools de escritura para registrar quién hizo qué en el log de
   * auditoría. Obligatorio para que el modelo pueda usar write tools.
   */
  toolContext?: ToolContext;
};

/**
 * Loop agente completo con streaming. onEvent recibe text chunks, tool
 * invocations y el done final. Persiste nada — eso lo hace el caller.
 */
export async function runAgent(options: RunAgentOptions): Promise<AnthropicMessage[]> {
  const model = options.model || DEFAULT_MODEL;
  const messages: AnthropicMessage[] = [...options.messages];

  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    const response = await postWithRetry(
      {
        apiKey: options.apiKey,
        body: {
          model,
          max_tokens: 4096,
          system: options.systemPrompt,
          messages,
          tools: TOOL_SCHEMAS,
          stream: true,
        },
      },
      options.onEvent,
    );

    if (!response || !response.ok || !response.body) {
      // postWithRetry ya emitió el evento de error apropiado.
      return messages;
    }

    const accumulated = await consumeSseStream(response.body, options.onEvent);

    // Construimos el bloque assistant final (texto + posibles tool_use).
    const assistantBlocks: AnthropicContentBlock[] = [];
    if (accumulated.text) {
      assistantBlocks.push({ type: "text", text: accumulated.text });
    }
    for (const call of accumulated.toolCalls) {
      assistantBlocks.push({
        type: "tool_use",
        id: call.id,
        name: call.name,
        input: call.input,
      });
    }
    messages.push({ role: "assistant", content: assistantBlocks });

    // Si no hay tool_use, terminamos.
    if (accumulated.toolCalls.length === 0 || accumulated.stopReason !== "tool_use") {
      options.onEvent({
        type: "done",
        reason: accumulated.stopReason || "end_turn",
        usage: accumulated.usage,
      });
      return messages;
    }

    // Ejecutamos cada tool_use y devolvemos los resultados como user message.
    const toolResults: AnthropicToolResultBlock[] = [];
    for (const call of accumulated.toolCalls) {
      options.onEvent({ type: "tool_use_start", name: call.name, input: call.input });
      let resultText: string;
      let isError = false;
      try {
        resultText = await executeTool(call.name, call.input, options.toolContext);
      } catch (err) {
        resultText = JSON.stringify({
          error: err instanceof Error ? err.message : "Error ejecutando la tool.",
        });
        isError = true;
      }
      toolResults.push({
        type: "tool_result",
        tool_use_id: call.id,
        content: resultText,
        is_error: isError,
      });
      options.onEvent({
        type: "tool_use_result",
        name: call.name,
        resultPreview: resultText.slice(0, 400),
      });
    }
    messages.push({ role: "user", content: toolResults });
  }

  options.onEvent({
    type: "error",
    message: "Se alcanzó el máximo de iteraciones de tool use (" + MAX_TOOL_ITERATIONS + ").",
  });
  return messages;
}

// ---------------------------------------------------------------------------
// Internal SSE consumer for Anthropic streaming responses.
// ---------------------------------------------------------------------------

type AccumulatedTurn = {
  text: string;
  toolCalls: Array<{ id: string; name: string; input: Record<string, unknown> }>;
  stopReason: string;
  usage?: { inputTokens: number; outputTokens: number };
};

async function consumeSseStream(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: StreamEvent) => void,
): Promise<AccumulatedTurn> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const acc: AccumulatedTurn = { text: "", toolCalls: [], stopReason: "" };
  // Building partial tool_use blocks by index as they stream.
  const pendingToolUse: Record<number, { id: string; name: string; inputBuffer: string }> = {};

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // SSE events separated by blank lines.
    let idx: number;
    while ((idx = buffer.indexOf("\n\n")) !== -1) {
      const block = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      if (!block.trim()) continue;

      let eventName = "";
      let dataPayload = "";
      for (const line of block.split("\n")) {
        if (line.startsWith("event:")) eventName = line.slice(6).trim();
        else if (line.startsWith("data:")) dataPayload += line.slice(5).trim();
      }
      if (!eventName || !dataPayload) continue;

      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(dataPayload);
      } catch {
        continue;
      }

      if (eventName === "content_block_start") {
        const block = parsed.content_block as { type: string; id?: string; name?: string };
        const index = parsed.index as number;
        if (block?.type === "tool_use") {
          pendingToolUse[index] = {
            id: String(block.id || ""),
            name: String(block.name || ""),
            inputBuffer: "",
          };
        }
      } else if (eventName === "content_block_delta") {
        const delta = parsed.delta as { type: string; text?: string; partial_json?: string };
        const index = parsed.index as number;
        if (delta?.type === "text_delta" && delta.text) {
          acc.text += delta.text;
          onEvent({ type: "text", text: delta.text });
        } else if (delta?.type === "input_json_delta" && pendingToolUse[index]) {
          pendingToolUse[index].inputBuffer += String(delta.partial_json || "");
        }
      } else if (eventName === "content_block_stop") {
        const index = parsed.index as number;
        const pending = pendingToolUse[index];
        if (pending) {
          let input: Record<string, unknown> = {};
          try {
            input = pending.inputBuffer ? (JSON.parse(pending.inputBuffer) as Record<string, unknown>) : {};
          } catch {
            input = { __rawInput: pending.inputBuffer };
          }
          acc.toolCalls.push({ id: pending.id, name: pending.name, input });
          delete pendingToolUse[index];
        }
      } else if (eventName === "message_delta") {
        const delta = parsed.delta as { stop_reason?: string };
        if (delta?.stop_reason) acc.stopReason = delta.stop_reason;
        const usage = parsed.usage as { input_tokens?: number; output_tokens?: number } | undefined;
        if (usage) {
          acc.usage = {
            inputTokens: usage.input_tokens || 0,
            outputTokens: usage.output_tokens || 0,
          };
        }
      }
    }
  }

  return acc;
}

// ---------------------------------------------------------------------------
// POST con reintento ante 429 / 529 (rate limit / overloaded).
// ---------------------------------------------------------------------------

const MAX_RETRIES = 3;

/**
 * Llama a /v1/messages con reintentos automáticos cuando Anthropic devuelve
 * 429 (rate limit) o 529 (overloaded). Usa el header `retry-after` si viene,
 * con cap de 60 s. Si se agotan reintentos o es otro error, emite `error`
 * y devuelve la respuesta final (ok=false) para que el caller aborte.
 */
async function postWithRetry(
  options: {
    apiKey: string;
    body: Record<string, unknown>;
  },
  onEvent: (event: StreamEvent) => void,
): Promise<Response | null> {
  let attempt = 0;
  while (attempt <= MAX_RETRIES) {
    const response = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": options.apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify(options.body),
    });

    if (response.ok && response.body) {
      return response;
    }

    const retryable = response.status === 429 || response.status === 529;
    if (!retryable || attempt === MAX_RETRIES) {
      const errorText = await response.text().catch(() => "");
      onEvent({
        type: "error",
        message:
          "Error " +
          response.status +
          " llamando a Anthropic: " +
          (errorText || response.statusText),
      });
      return response;
    }

    // Calcula espera: header retry-after (en segundos) o backoff exponencial.
    const retryAfterHeader = response.headers.get("retry-after");
    const retryAfterSeconds = retryAfterHeader
      ? Math.min(60, Math.max(1, Number(retryAfterHeader) || 10))
      : Math.min(60, 5 * Math.pow(2, attempt));

    onEvent({
      type: "text",
      text:
        "\n\n_(límite de tokens/min alcanzado — esperando " +
        retryAfterSeconds +
        " s y reintentando)_\n\n",
    });

    await new Promise((r) => setTimeout(r, retryAfterSeconds * 1000));
    attempt++;
  }
  return null;
}
