/**
 * Tipos del chat interno de la Factory.
 *
 * El chat es un agente conversacional que vive en /factory/chat. Conecta
 * con Anthropic Claude vía API HTTP directa (sin SDK — usamos fetch para
 * no añadir dependencia). Soporta adjuntos (md, txt, csv, json, pdf,
 * docx), tool use iterativo para consultar y operar la Factory, y
 * persistencia de conversaciones por usuario en disco.
 *
 * Las conversaciones se guardan en `data/factory/chat/<accountId>/<id>.jsonl`
 * (un mensaje por línea) + un índice `index.json` con el metadata visible
 * en la sidebar (título, fecha, conteo).
 */

export type ChatRole = "user" | "assistant" | "tool";

export type ChatAttachmentRef = {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  /** Marcado si el adjunto es imagen enviable como content block al modelo. */
  isImage?: boolean;
};

export type ChatMessage = {
  id: string;
  role: ChatRole;
  /** Texto del mensaje. En mensajes de tipo "tool" es el resultado JSON. */
  content: string;
  /** Cuando role==="assistant" y el modelo pidió tools, aquí va el nombre. */
  toolName?: string;
  /** Input JSON que el modelo pasó a la tool. */
  toolInput?: Record<string, unknown>;
  /** ID del tool_use al que responde este mensaje (cuando role==="tool"). */
  toolUseId?: string;
  attachments?: ChatAttachmentRef[];
  createdAt: string;
};

export type ChatConversationMeta = {
  id: string;
  accountId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
};

export type ChatConversation = {
  meta: ChatConversationMeta;
  messages: ChatMessage[];
};
