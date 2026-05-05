import fs from "node:fs";
import type { NextRequest } from "next/server";
import { requireFactoryAdmin } from "@/lib/factory-chat/auth";
import {
  appendMessageAsync,
  readConversationAsync,
  renameConversationAsync,
} from "@/lib/persistence/factory-chat-storage-async";
import { readUploadText, getUploadBinaryPath } from "@/lib/factory-chat/uploads";
import { runAgent, type StreamEvent } from "@/lib/factory-chat/anthropic";
import type { ChatAttachmentRef, ChatMessage } from "@/lib/factory-chat/types";

/**
 * POST /api/factory/chat/send
 * Body: { conversationId, content, attachmentIds? }
 *
 * Devuelve Server-Sent Events con:
 *   event: text           → text delta del modelo
 *   event: tool_use_start → cuando el modelo invoca una tool
 *   event: tool_use_result → cuando se completa la tool (resumen)
 *   event: done           → fin de turno
 *   event: error          → error recuperable
 *
 * El cliente debe parsear SSE y acumular `text` en el mensaje del
 * asistente mientras los `tool_use_*` se muestran como indicadores
 * de actividad.
 */

const SYSTEM_PROMPT = `Eres el asistente interno de Prontara Factory, una plataforma multi-tenant de ERP online para pymes.

Hablas en español claro. Eres operacional, no verboso. Respondes con pasos concretos, no con generalidades. Cuando haya datos reales disponibles vía tools, usas los tools antes de responder — no inventes tenants, verticales, paths ni ficheros.

## Tools disponibles

**Lectura (sin efectos secundarios):**
- list_tenants, read_tenant_detail — tenants provisionados.
- list_verticals, read_vertical — catálogo de sector packs.
- read_factory_health — salud técnica de la Factory.
- search_codebase(query) — busca en el repo por relevancia BM25. **Solo local.** En producción no hay índice del fuente — usa list_github_dir + read_github_file para explorar.
- read_repo_file, list_repo_files — lectura del repo desde el filesystem local. **Solo local** (en producción serverless no hay fuente). En producción usa read_github_file/list_github_dir.
- read_github_file(path, ref?), list_github_dir(path, ref?) — lectura del repo desde GitHub vía API. **Funciona en local y producción.** Por defecto lee de la rama main; pasa el parámetro ref para leer de otra rama (ej. una rama de PR pendiente). Útil cuando vas a iterar sobre un fichero existente con commit_to_github_pr.
- read_audit_log — consulta del historial de invocaciones de tools.
- list_backup_snapshots — solo local.

**Escritura local (solo cuando el chat corre con \`pnpm dev\`):**
- write_repo_file(path, content) — crea o reescribe un fichero dentro de src/, docs/, scripts/ o prisma/schema.prisma. **NO disponible en producción serverless** (filesystem read-only); en ese entorno usa commit_to_github_pr.
- patch_repo_file(path, oldString, newString, replaceAll?) — edición quirúrgica por find-replace. Preferida sobre write cuando sea un cambio puntual. **No disponible en producción.**
- run_tsc_check — valida TypeScript tras escribir. **Solo local.**
- run_lint_check(paths?) — valida con ESLint. **Solo local.**
- restore_backup_snapshot(backupRef) — rollback de un snapshot anterior. **Solo local.**

**Escritura producción (vía GitHub Pull Request):**
- commit_to_github_pr(message, files, ...) — crea rama nueva en el repo, comitea uno o varios ficheros (whitelist src/, docs/, scripts/, prisma/schema.prisma), y abre un PR contra main. Vercel auto-despliega tras merge. **Esta es la tool por defecto para cambios de código en producción.** Devuelve la URL del PR para que el operador la abra y haga merge.

**Operación SaaS (siempre disponible, prod y local):**
- regenerate_tenant(clientId) — cierra el loop tras modificar un vertical: garantiza trial/onboarding del tenant e invalida la caché del dashboard. Úsala cuando el cambio afecta al ERP de un cliente concreto.
- invalidate_factory_cache — invalida solo la caché del dashboard de Factory. Para refrescar el panel admin sin tocar nada más.

## Reglas de operación

1. **Sé quirúrgico con las lecturas**. La cuenta Anthropic tiene un límite de tokens/min ajustado. Antes de leer ficheros:
   - **Usa search_codebase(query) PRIMERO** cuando no sabes dónde está la lógica. Evita leer 5 ficheros para encontrar algo que aparece en 1.
   - Usa list_repo_files si quieres ver la estructura de un directorio.
   - Usa read_vertical en vez de leer los .ts del sector pack si el dato está ahí.
   - Cuando uses read_repo_file, empieza con el byteLimit default (8 KB). Amplía solo si realmente necesitas más.
   - No leas dos ficheros si con uno basta. No leas el mismo fichero dos veces — si ya lo has leído antes en la conversación, recuerda el contenido.
   - Si necesitas localizar una sección concreta de un fichero grande, léelo por trozos con byteOffset en vez de bajarlo entero.
2. **Antes de escribir, lee** lo mínimo necesario. Si te piden tocar un fichero, lee solo la parte relevante, no el fichero completo.
3. **Describe brevemente lo que vas a hacer** antes de llamar a una write tool (una o dos frases), pero no pidas confirmación — el usuario ya sabe que las escrituras se auditan automáticamente.
4. **Usa patch_repo_file para cambios pequeños**; deja write_repo_file para ficheros nuevos o reescrituras completas. oldString debe ser único dentro del fichero (si no, amplía el contexto o usa replaceAll:true).
5. **Valida después de escribir (solo local)**. Tras una o varias escrituras con write_repo_file/patch_repo_file, llama a run_tsc_check. Si hay errores reales, arréglalos o avisa al usuario y revierte con restore_backup_snapshot. En producción (commit_to_github_pr) no se puede correr tsc — el revisor del PR es responsable de la verificación.
6. **Cierra el loop con regenerate_tenant**. Si modificas un vertical (p.ej. añades un módulo al software-factory), identifica qué tenants usan ese vertical con list_tenants + read_tenant_detail, y llama a regenerate_tenant(clientId) para cada uno. Esto SÍ funciona en producción y aplica los cambios runtime sin esperar al deploy de Vercel para los aspectos data-driven.
7. **Alcance de escritura**: solo src/, docs/, scripts/ y prisma/schema.prisma. No intentes tocar .env, data/, .next/, .prontara/, node_modules/ ni .git/ — serán rechazados tanto por write_repo_file como por commit_to_github_pr.
8. **Cómo elegir entre write_repo_file y commit_to_github_pr**: si la tool write_repo_file devuelve error tipo "solo está disponible cuando el chat corre en local con acceso al repo", estás en producción serverless — usa commit_to_github_pr. Si funciona, estás en local — prefiere write_repo_file (más rápido, sin PR review). Cuando uses commit_to_github_pr, comita varios ficheros relacionados en UN solo PR con un message descriptivo, y al final dale al operador la URL del PR para que la abra y mergee.
8b. **ANTES de modificar un fichero existente con commit_to_github_pr en producción**, léelo siempre primero con read_github_file para ver el estado actual. Si invocas commit_to_github_pr pasando un path con el content nuevo, estás SOBRESCRIBIENDO el fichero entero — si no conoces el contenido actual puedes borrar lógica que existía. La sobrescritura ciega es uno de los errores más graves del flujo PR. Excepción: si estás creando un fichero nuevo (no existe en main), puedes saltarte la lectura previa.
9. **Para acciones fuera de lo anterior** (enviar email real, tocar Stripe, ejecutar build/deploy), avisa de que esa automatización aún no está disponible y sugiere el comando manual.

## Estilo

- Cuando muestres código o JSON, usa bloques markdown con el lenguaje correcto.
- Cita siempre el key/clientId exacto al referirte a un tenant o vertical.
- Si un adjunto tiene el contenido en la conversación, no llames a tools para releerlo.
- Si fallas una tool por un error recuperable, vuelve a intentarlo con la corrección; si no es recuperable, explícaselo al usuario y propón alternativa.

## Imágenes

Puedes recibir capturas y fotos que el usuario adjunte (png/jpg/gif/webp). Al describirlas sé concreto: enumera los elementos visibles relevantes (textos, botones, estados, errores) antes de interpretar. Si la imagen es una captura del ERP o del panel Factory y contiene un bug o estado anómalo, intenta correlacionar con los ficheros del repo o con datos reales de tools antes de diagnosticar. Las imágenes solo llegan en el turno actual; si en turnos siguientes necesitas volver a verlas, pídele al usuario que las vuelva a adjuntar.`;

type AnthropicImageBlock = {
  type: "image";
  source: {
    type: "base64";
    media_type: "image/png" | "image/jpeg" | "image/gif" | "image/webp";
    data: string;
  };
};

type AnthropicMessage = {
  role: "user" | "assistant";
  content: string | Array<
    | { type: "text"; text: string }
    | AnthropicImageBlock
    | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
    | { type: "tool_result"; tool_use_id: string; content: string; is_error?: boolean }
  >;
};

export async function POST(request: NextRequest) {
  const admin = requireFactoryAdmin(request);
  if (!admin) {
    return jsonResponse(401, { ok: false, error: "Se requiere sesión con rol admin en la Factory." });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return jsonResponse(503, {
      ok: false,
      error:
        "Falta ANTHROPIC_API_KEY en el entorno. Ver docs/factory-chat-setup.md para configurarlo.",
    });
  }

  let body: {
    conversationId?: string;
    content?: string;
    attachmentIds?: string[];
  };
  try {
    body = await request.json();
  } catch {
    return jsonResponse(400, { ok: false, error: "Body JSON inválido." });
  }

  const conversationId = String(body.conversationId || "").trim();
  const userContent = String(body.content || "").trim();
  if (!conversationId) return jsonResponse(400, { ok: false, error: "Falta conversationId." });
  if (!userContent && !(body.attachmentIds && body.attachmentIds.length > 0)) {
    return jsonResponse(400, { ok: false, error: "Mensaje vacío." });
  }

  const conv = await readConversationAsync(admin.accountId, conversationId);
  if (!conv) {
    return jsonResponse(404, { ok: false, error: "Conversación no encontrada." });
  }

  // Construimos el contenido del mensaje del usuario. Hay dos tipos de
  // adjunto:
  //   - Textuales (pdf, docx, md…): el texto extraído se concatena como
  //     bloque de texto al mensaje.
  //   - Imágenes (png/jpg/gif/webp): se envían al modelo como content
  //     block tipo "image" con source base64.
  //
  // Si el turno no lleva imágenes, construimos un mensaje string para no
  // cambiar el formato existente. Si lleva imágenes, pasamos a content
  // blocks multimodales.
  const attachmentRefs: ChatAttachmentRef[] = [];
  const attachmentTextSections: string[] = [];
  const imageBlocks: AnthropicImageBlock[] = [];

  for (const attId of body.attachmentIds || []) {
    const upload = readUploadText(attId);
    if (!upload) continue;
    attachmentRefs.push({
      id: upload.meta.id,
      name: upload.meta.originalName,
      mimeType: upload.meta.mimeType,
      size: upload.meta.size,
      isImage: upload.meta.isImage,
    });

    if (upload.meta.isImage && upload.meta.imageMediaType) {
      const binaryPath = getUploadBinaryPath(upload.meta.id, upload.meta.extension);
      if (binaryPath) {
        try {
          const buffer = fs.readFileSync(binaryPath);
          imageBlocks.push({
            type: "image",
            source: {
              type: "base64",
              media_type: upload.meta.imageMediaType,
              data: buffer.toString("base64"),
            },
          });
          attachmentTextSections.push(
            "[Imagen adjunta: " + upload.meta.originalName + "]",
          );
          continue;
        } catch {
          // Si falla la lectura del binario, caemos al bloque de texto.
        }
      }
    }

    attachmentTextSections.push(
      "--- Adjunto: " +
        upload.meta.originalName +
        " (" +
        upload.meta.extension +
        ", " +
        upload.meta.extractedChars +
        " caracteres" +
        (upload.meta.truncated ? ", truncado" : "") +
        ") ---\n" +
        upload.text,
    );
  }

  const fullUserText =
    attachmentTextSections.length > 0
      ? userContent + "\n\n" + attachmentTextSections.join("\n\n")
      : userContent;

  // Persistimos el mensaje del usuario antes de arrancar el stream.
  const userMessage: ChatMessage = {
    id: "m-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
    role: "user",
    content: userContent,
    attachments: attachmentRefs,
    createdAt: new Date().toISOString(),
  };
  await appendMessageAsync(admin.accountId, conversationId, userMessage);

  // Si es el primer mensaje real, usamos su texto como título.
  if (conv.meta.title === "Nueva conversación" && userContent) {
    await renameConversationAsync(
      admin.accountId,
      conversationId,
      userContent.slice(0, 80),
    );
  }

  // Construimos el historial para Anthropic con todos los mensajes previos
  // más el nuevo, formateados según el schema de la API.
  const history: AnthropicMessage[] = buildAnthropicHistory(conv.messages);
  if (imageBlocks.length > 0) {
    history.push({
      role: "user",
      content: [
        { type: "text", text: fullUserText || "(sin texto)" },
        ...imageBlocks,
      ],
    });
  } else {
    history.push({ role: "user", content: fullUserText });
  }

  // Stream SSE.
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function send(event: StreamEvent) {
        const payload = "event: " + event.type + "\ndata: " + JSON.stringify(event) + "\n\n";
        controller.enqueue(encoder.encode(payload));
      }

      const assistantTextBuffer: string[] = [];
      const toolInvocations: Array<{
        name: string;
        input: Record<string, unknown>;
        resultPreview?: string;
      }> = [];

      try {
        await runAgent({
          apiKey,
          systemPrompt: SYSTEM_PROMPT,
          messages: history,
          toolContext: {
            accountId: admin.accountId,
            email: admin.email,
            conversationId,
          },
          onEvent: (ev) => {
            if (ev.type === "text") {
              assistantTextBuffer.push(ev.text);
            } else if (ev.type === "tool_use_start") {
              toolInvocations.push({ name: ev.name, input: ev.input });
            } else if (ev.type === "tool_use_result") {
              const last = toolInvocations[toolInvocations.length - 1];
              if (last && last.name === ev.name) last.resultPreview = ev.resultPreview;
            }
            send(ev);
          },
        });
      } catch (err) {
        send({
          type: "error",
          message: err instanceof Error ? err.message : "Error inesperado.",
        });
      }

      // Persistimos el mensaje final del asistente (texto concatenado y
      // resumen de tools usadas como metadato).
      const assistantText = assistantTextBuffer.join("");
      if (assistantText || toolInvocations.length > 0) {
        const assistantMessage: ChatMessage = {
          id: "m-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
          role: "assistant",
          content: assistantText,
          createdAt: new Date().toISOString(),
          toolName: toolInvocations.length > 0 ? toolInvocations.map((t) => t.name).join(", ") : undefined,
        };
        await appendMessageAsync(admin.accountId, conversationId, assistantMessage);
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

function buildAnthropicHistory(messages: ChatMessage[]): AnthropicMessage[] {
  const out: AnthropicMessage[] = [];
  for (const msg of messages) {
    if (msg.role === "user") {
      const content = msg.attachments && msg.attachments.length > 0
        ? msg.content +
          "\n\n" +
          msg.attachments
            .map((a) => "[Adjunto previo: " + a.name + " (" + a.mimeType + ")]")
            .join("\n")
        : msg.content;
      out.push({ role: "user", content });
    } else if (msg.role === "assistant") {
      // Historia simplificada: solo bloque de texto. Los tool_use del pasado
      // no se reenvían al modelo en siguientes turnos porque ya están
      // reflejados en la conversación textualmente.
      if (msg.content) out.push({ role: "assistant", content: msg.content });
    }
    // msg.role === "tool" no se reenvía; ese detalle lo resuelve el loop
    // agente dentro del turno actual.
  }
  return out;
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
