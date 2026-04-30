/**
 * Adapter Anthropic → LLMProvider.
 *
 * Implementa el puerto envolviendo `runAgent` de factory-chat/anthropic.ts.
 * El runAgent existente usa un patrón callback (`onEvent`); el puerto
 * expone AsyncIterable. El adapter convierte uno en el otro con un
 * canal interno (cola en memoria + Promise resolver).
 *
 * NOTA importante (estado del adapter):
 *   - Soporta streaming de texto y tool_use básicos.
 *   - NO soporta tools auténticos del puerto LLMToolDefinition todavía
 *     (el `runAgent` actual recibe tools del catálogo Prontara, no
 *     definidos por el caller). Si se necesita pasar tools arbitrarios,
 *     se debe refactorizar `runAgent` o crear un fork del adapter.
 *   - Los partial JSON deltas se omiten — el adapter solo emite
 *     tool_use_complete con el input ya parseado.
 *
 * Suficiente para empezar a probar el patrón hexagonal en código nuevo;
 * NO sustituye al uso directo de `runAgent` en el Factory Chat actual.
 */
import type {
  LLMProvider,
  LLMStreamRequest,
  LLMStreamEvent,
  LLMMessage,
} from "@/lib/ports/llm-provider";
import {
  runAgent,
  type AnthropicMessage,
  type StreamEvent as AnthropicStreamEvent,
} from "@/lib/factory-chat/anthropic";

function toAnthropicMessages(messages: LLMMessage[]): AnthropicMessage[] {
  // Anthropic NO acepta role="system" en mensajes (va en system_prompt
  // separado). Filtramos y dejamos al caller que lo pase como systemPrompt.
  return messages
    .filter((m) => m.role !== "system")
    .map((m) => {
      // Si el content es array de bloques, lo asumimos compatible con
      // AnthropicContentBlock (tipos similares). Casteamos para evitar
      // duplicar el mapeo aquí — runAgent valida internamente.
      return {
        role: m.role as "user" | "assistant",
        content: m.content,
      } as AnthropicMessage;
    });
}

function pumpEvents(
  request: LLMStreamRequest,
): AsyncIterable<LLMStreamEvent> {
  const queue: LLMStreamEvent[] = [];
  let resolveNext: (() => void) | null = null;
  let done = false;

  const apiKey = String(process.env.ANTHROPIC_API_KEY || "").trim();

  // Helper que reasigna a null ANTES de llamar para que TS no pierda
  // el narrowing entre el if y la llamada (el closure del Promise lo
  // confunde y hace `resolveNext` parecer `never` en strict mode).
  const fireResolveNext = () => {
    const fn = resolveNext;
    if (fn) {
      resolveNext = null;
      fn();
    }
  };

  const pushEvent = (event: LLMStreamEvent) => {
    queue.push(event);
    fireResolveNext();
  };

  const onAnthropicEvent = (e: AnthropicStreamEvent): void => {
    if (e.type === "text") {
      pushEvent({ type: "text_delta", delta: e.text });
    } else if (e.type === "tool_use_start") {
      // Generamos un id sintético: el runAgent actual no expone ids
      // estables. Suficiente para el pattern hexagonal en pruebas.
      const id = "tool_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
      pushEvent({ type: "tool_use_start", id, name: e.name });
      pushEvent({ type: "tool_use_complete", id, input: e.input });
    } else if (e.type === "done") {
      pushEvent({
        type: "message_stop",
        stopReason: "end_turn",
        usage: e.usage,
      });
    } else if (e.type === "error") {
      pushEvent({ type: "error", error: e.message });
    }
    // tool_use_result se ignora en el adapter — es un evento de
    // observabilidad del runAgent actual, no parte del puerto.
  };

  // Disparamos runAgent en background.
  void (async () => {
    try {
      await runAgent({
        apiKey,
        model: request.model,
        systemPrompt: request.systemPrompt || "",
        messages: toAnthropicMessages(request.messages),
        onEvent: onAnthropicEvent,
      });
    } catch (err) {
      pushEvent({
        type: "error",
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      done = true;
      fireResolveNext();
    }
  })();

  return {
    [Symbol.asyncIterator]() {
      return {
        async next(): Promise<IteratorResult<LLMStreamEvent>> {
          while (queue.length === 0 && !done) {
            await new Promise<void>((resolve) => {
              resolveNext = resolve;
            });
          }
          if (queue.length > 0) {
            return { value: queue.shift()!, done: false };
          }
          // done && queue empty
          return { value: undefined as unknown as LLMStreamEvent, done: true };
        },
      };
    },
  };
}

export const anthropicLlmProvider: LLMProvider = {
  name: "anthropic",
  stream(request: LLMStreamRequest): AsyncIterable<LLMStreamEvent> {
    return pumpEvents(request);
  },
};
