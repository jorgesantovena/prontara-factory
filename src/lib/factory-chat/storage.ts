/**
 * Persistencia del chat de Factory en disco.
 *
 * Layout:
 *   data/factory/chat/<accountId>/index.json          → array de meta
 *   data/factory/chat/<accountId>/<conversationId>.jsonl → un mensaje por línea
 *
 * Cada escritura es atómica vía `writeJsonAtomic` / `writeTextAtomic`. Los
 * mensajes se appendean con `fs.appendFileSync` (JSONL) porque la
 * conversación es append-only y no queremos reescribir el fichero entero
 * en cada turno.
 */

import fs from "node:fs";
import path from "node:path";
import { writeJsonAtomic } from "@/lib/saas/fs-atomic";
import type {
  ChatConversation,
  ChatConversationMeta,
  ChatMessage,
} from "@/lib/factory-chat/types";

function getRoot(): string {
  return path.join(process.cwd(), "data", "factory", "chat");
}

function getAccountDir(accountId: string): string {
  const safe = normalizeId(accountId);
  const dir = path.join(getRoot(), safe);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function normalizeId(value: string): string {
  const trimmed = String(value || "").trim();
  if (!trimmed) throw new Error("ID vacío");
  if (!/^[A-Za-z0-9_-]+$/.test(trimmed)) {
    throw new Error("ID no válido (solo alfanuméricos, guion y guion bajo).");
  }
  return trimmed;
}

function getIndexPath(accountId: string): string {
  return path.join(getAccountDir(accountId), "index.json");
}

function getConversationPath(accountId: string, conversationId: string): string {
  return path.join(getAccountDir(accountId), normalizeId(conversationId) + ".jsonl");
}

function readIndex(accountId: string): ChatConversationMeta[] {
  const filePath = getIndexPath(accountId);
  if (!fs.existsSync(filePath)) return [];
  try {
    const raw = fs.readFileSync(filePath, "utf8").trim();
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ChatConversationMeta[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeIndex(accountId: string, items: ChatConversationMeta[]): void {
  writeJsonAtomic(getIndexPath(accountId), items);
}

function generateId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  return "c-" + ts + "-" + rand;
}

export function listConversations(accountId: string): ChatConversationMeta[] {
  return readIndex(accountId).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

export function createConversation(accountId: string, title?: string): ChatConversationMeta {
  const now = new Date().toISOString();
  const meta: ChatConversationMeta = {
    id: generateId(),
    accountId: normalizeId(accountId),
    title: String(title || "Nueva conversación").slice(0, 120),
    createdAt: now,
    updatedAt: now,
    messageCount: 0,
  };
  const items = readIndex(accountId);
  items.push(meta);
  writeIndex(accountId, items);
  // Crear el fichero JSONL vacío.
  const filePath = getConversationPath(accountId, meta.id);
  fs.writeFileSync(filePath, "");
  return meta;
}

export function appendMessage(
  accountId: string,
  conversationId: string,
  message: ChatMessage,
): void {
  const filePath = getConversationPath(accountId, conversationId);
  fs.appendFileSync(filePath, JSON.stringify(message) + "\n");

  // Actualizar el índice (meta.updatedAt y messageCount).
  const items = readIndex(accountId);
  const idx = items.findIndex((m) => m.id === conversationId);
  if (idx >= 0) {
    items[idx] = {
      ...items[idx],
      updatedAt: new Date().toISOString(),
      messageCount: items[idx].messageCount + 1,
    };
    writeIndex(accountId, items);
  }
}

export function readConversation(
  accountId: string,
  conversationId: string,
): ChatConversation | null {
  const items = readIndex(accountId);
  const meta = items.find((m) => m.id === conversationId);
  if (!meta) return null;

  const filePath = getConversationPath(accountId, conversationId);
  if (!fs.existsSync(filePath)) return { meta, messages: [] };

  const raw = fs.readFileSync(filePath, "utf8");
  const messages: ChatMessage[] = [];
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      messages.push(JSON.parse(trimmed) as ChatMessage);
    } catch {
      // Saltamos líneas corruptas sin romper la conversación.
    }
  }
  return { meta, messages };
}

export function renameConversation(
  accountId: string,
  conversationId: string,
  title: string,
): ChatConversationMeta | null {
  const items = readIndex(accountId);
  const idx = items.findIndex((m) => m.id === conversationId);
  if (idx < 0) return null;
  items[idx] = {
    ...items[idx],
    title: String(title || "").slice(0, 120) || items[idx].title,
    updatedAt: new Date().toISOString(),
  };
  writeIndex(accountId, items);
  return items[idx];
}

export function deleteConversation(accountId: string, conversationId: string): boolean {
  const items = readIndex(accountId);
  const next = items.filter((m) => m.id !== conversationId);
  if (next.length === items.length) return false;
  writeIndex(accountId, next);
  const filePath = getConversationPath(accountId, conversationId);
  if (fs.existsSync(filePath)) {
    try { fs.unlinkSync(filePath); } catch { /* best effort */ }
  }
  return true;
}
