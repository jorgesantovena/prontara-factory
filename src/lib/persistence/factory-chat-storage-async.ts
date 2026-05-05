/**
 * Wrapper async sobre el storage del Factory Chat (conversaciones + mensajes).
 *
 * Modo dual:
 *   - PRONTARA_PERSISTENCE=filesystem (default local) → delega en
 *     /lib/factory-chat/storage.ts que usa data/factory/chat/<accountId>/*.jsonl
 *   - PRONTARA_PERSISTENCE=postgres (producción) → usa los modelos
 *     FactoryChatConversation + FactoryChatMessage en Neon Postgres.
 *
 * Mismo patrón que factory-notifications-store-async.ts: las API routes
 * llaman a las funciones *Async, y aquí se decide el backend.
 *
 * Por qué este wrapper y no convertir storage.ts directamente:
 *   - Mantiene el modo filesystem usable en local sin Postgres
 *     (development sin DATABASE_URL configurado).
 *   - Permite testear el chat localmente con jsonl que es trivial de
 *     inspeccionar y debuggear.
 *   - En serverless el filesystem es read-only en Vercel — la rama
 *     filesystem petaría, pero al estar gateada por la flag, en producción
 *     siempre se usa Postgres.
 */
import {
  listConversations as listConversationsFs,
  createConversation as createConversationFs,
  appendMessage as appendMessageFs,
  readConversation as readConversationFs,
  renameConversation as renameConversationFs,
  deleteConversation as deleteConversationFs,
} from "@/lib/factory-chat/storage";
import type {
  ChatConversation,
  ChatConversationMeta,
  ChatMessage,
  ChatAttachmentRef,
} from "@/lib/factory-chat/types";
import { getPersistenceBackend, withPrisma } from "@/lib/persistence/db";

// ---------------------------------------------------------------------------
// Helpers de mapping fila Postgres → tipos del dominio.
// ---------------------------------------------------------------------------

type ConversationRow = {
  id: string;
  accountId: string;
  title: string;
  messageCount: number;
  createdAt: Date;
  updatedAt: Date;
};

type MessageRow = {
  id: string;
  conversationId: string;
  role: string;
  content: string;
  toolName: string | null;
  toolInput: unknown;
  toolUseId: string | null;
  attachmentsJson: unknown;
  createdAt: Date;
};

function rowToMeta(row: ConversationRow): ChatConversationMeta {
  return {
    id: row.id,
    accountId: row.accountId,
    title: row.title,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    messageCount: row.messageCount,
  };
}

function rowToMessage(row: MessageRow): ChatMessage {
  const attachments =
    Array.isArray(row.attachmentsJson)
      ? (row.attachmentsJson as ChatAttachmentRef[])
      : undefined;
  const toolInput =
    row.toolInput && typeof row.toolInput === "object"
      ? (row.toolInput as Record<string, unknown>)
      : undefined;

  return {
    id: row.id,
    role: row.role as ChatMessage["role"],
    content: row.content,
    toolName: row.toolName ?? undefined,
    toolInput,
    toolUseId: row.toolUseId ?? undefined,
    attachments,
    createdAt: row.createdAt.toISOString(),
  };
}

function generateId(prefix = "c"): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  return prefix + "-" + ts + "-" + rand;
}

// ---------------------------------------------------------------------------
// Public API — async, mismas firmas que storage.ts pero Promise.
// ---------------------------------------------------------------------------

export async function listConversationsAsync(
  accountId: string,
): Promise<ChatConversationMeta[]> {
  if (getPersistenceBackend() === "filesystem") {
    return listConversationsFs(accountId);
  }

  const result = await withPrisma(async (prisma) =>
    prisma.factoryChatConversation.findMany({
      where: { accountId },
      orderBy: { updatedAt: "desc" },
    }),
  );
  return ((result as ConversationRow[]) || []).map(rowToMeta);
}

export async function createConversationAsync(
  accountId: string,
  title?: string,
): Promise<ChatConversationMeta> {
  if (getPersistenceBackend() === "filesystem") {
    return createConversationFs(accountId, title);
  }

  const id = generateId();
  const cleanTitle = String(title || "Nueva conversación").slice(0, 120);
  const result = await withPrisma(async (prisma) =>
    prisma.factoryChatConversation.create({
      data: {
        id,
        accountId,
        title: cleanTitle,
        messageCount: 0,
      },
    }),
  );

  if (!result) {
    throw new Error(
      "No se pudo crear la conversación: backend Postgres no disponible.",
    );
  }
  return rowToMeta(result as ConversationRow);
}

export async function appendMessageAsync(
  accountId: string,
  conversationId: string,
  message: ChatMessage,
): Promise<void> {
  if (getPersistenceBackend() === "filesystem") {
    appendMessageFs(accountId, conversationId, message);
    return;
  }

  await withPrisma(async (prisma) => {
    // Verificamos que la conversación pertenece al accountId — el chat
    // siempre llama por (accountId, conversationId), así que un usuario
    // no puede escribir en conversaciones de otro.
    const conv = await prisma.factoryChatConversation.findFirst({
      where: { id: conversationId, accountId },
      select: { id: true, messageCount: true },
    });
    if (!conv) {
      throw new Error(
        "Conversación no encontrada o no pertenece al operador.",
      );
    }

    // Insertamos el mensaje y actualizamos el contador en una transacción
    // para que el messageCount no diverja del COUNT(*) real.
    await prisma.$transaction([
      prisma.factoryChatMessage.create({
        data: {
          id: message.id,
          conversationId,
          role: message.role,
          content: message.content,
          toolName: message.toolName ?? null,
          toolInput:
            message.toolInput === undefined
              ? undefined
              : (message.toolInput as object),
          toolUseId: message.toolUseId ?? null,
          attachmentsJson:
            message.attachments === undefined
              ? undefined
              : (message.attachments as unknown as object),
          createdAt: new Date(message.createdAt),
        },
      }),
      prisma.factoryChatConversation.update({
        where: { id: conversationId },
        data: {
          messageCount: { increment: 1 },
          updatedAt: new Date(),
        },
      }),
    ]);
  });
}

export async function readConversationAsync(
  accountId: string,
  conversationId: string,
): Promise<ChatConversation | null> {
  if (getPersistenceBackend() === "filesystem") {
    return readConversationFs(accountId, conversationId);
  }

  const result = await withPrisma(async (prisma) => {
    const meta = await prisma.factoryChatConversation.findFirst({
      where: { id: conversationId, accountId },
    });
    if (!meta) return null;
    const messages = await prisma.factoryChatMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: "asc" },
    });
    return { meta, messages };
  });

  if (!result) return null;
  return {
    meta: rowToMeta(result.meta as ConversationRow),
    messages: (result.messages as MessageRow[]).map(rowToMessage),
  };
}

export async function renameConversationAsync(
  accountId: string,
  conversationId: string,
  title: string,
): Promise<ChatConversationMeta | null> {
  if (getPersistenceBackend() === "filesystem") {
    return renameConversationFs(accountId, conversationId, title);
  }

  const cleanTitle = String(title || "").slice(0, 120);
  if (!cleanTitle) {
    // Si el título queda vacío no actualizamos — devolvemos meta actual.
    const result = await withPrisma(async (prisma) =>
      prisma.factoryChatConversation.findFirst({
        where: { id: conversationId, accountId },
      }),
    );
    return result ? rowToMeta(result as ConversationRow) : null;
  }

  const result = await withPrisma(async (prisma) => {
    const existing = await prisma.factoryChatConversation.findFirst({
      where: { id: conversationId, accountId },
      select: { id: true },
    });
    if (!existing) return null;
    return prisma.factoryChatConversation.update({
      where: { id: conversationId },
      data: { title: cleanTitle },
    });
  });

  return result ? rowToMeta(result as ConversationRow) : null;
}

export async function deleteConversationAsync(
  accountId: string,
  conversationId: string,
): Promise<boolean> {
  if (getPersistenceBackend() === "filesystem") {
    return deleteConversationFs(accountId, conversationId);
  }

  const result = await withPrisma(async (prisma) => {
    const existing = await prisma.factoryChatConversation.findFirst({
      where: { id: conversationId, accountId },
      select: { id: true },
    });
    if (!existing) return false;
    // FK con ON DELETE CASCADE elimina los mensajes automáticamente.
    await prisma.factoryChatConversation.delete({
      where: { id: conversationId },
    });
    return true;
  });
  return Boolean(result);
}
