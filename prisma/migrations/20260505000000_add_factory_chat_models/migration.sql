-- Migración: persistencia del Factory Chat en Postgres.
--
-- Reemplaza el storage filesystem de data/factory/chat/<accountId>/*.jsonl
-- por dos tablas Postgres para que el chat del operador funcione en
-- serverless (Vercel) sin filesystem persistente.
--
-- Modelos añadidos:
--   FactoryChatConversation — meta de conversación por cuenta de operador.
--   FactoryChatMessage      — mensajes append-only (user/assistant/tool).

-- CreateTable
CREATE TABLE "FactoryChatConversation" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FactoryChatConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FactoryChatMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "toolName" TEXT,
    "toolInput" JSONB,
    "toolUseId" TEXT,
    "attachmentsJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FactoryChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FactoryChatConversation_accountId_updatedAt_idx" ON "FactoryChatConversation"("accountId", "updatedAt");

-- CreateIndex
CREATE INDEX "FactoryChatMessage_conversationId_createdAt_idx" ON "FactoryChatMessage"("conversationId", "createdAt");

-- AddForeignKey
ALTER TABLE "FactoryChatMessage" ADD CONSTRAINT "FactoryChatMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "FactoryChatConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
