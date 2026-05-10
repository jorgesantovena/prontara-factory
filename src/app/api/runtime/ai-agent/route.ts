import { NextResponse, type NextRequest } from "next/server";
import { requireTenantSession } from "@/lib/saas/auth-session";
import {
  createModuleRecordAsync,
  listModuleRecordsAsync,
} from "@/lib/persistence/active-client-data-store-async";
import { enqueueJob } from "@/lib/jobs/queue";
import { captureError } from "@/lib/observability/error-capture";

/**
 * POST /api/runtime/ai-agent (H6-AI-AGENT)
 * Body: { prompt: string }
 *
 * Asistente conversacional que EJECUTA acciones reales en el ERP del
 * tenant usando tool-use de Claude.
 *
 * Herramientas disponibles:
 *   - createRecord(moduleKey, payload)
 *   - listRecords(moduleKey, filterText?, limit?)
 *   - sendEmail(to, subject, html)
 *
 * Ejemplos:
 *   "Crea factura para Construcciones Levante por 1500€ concepto consultoría"
 *   "¿Cuántos clientes activos tengo?"
 *   "Manda email a juan@x.com confirmando la cita"
 *
 * Modelo: claude sonnet 4.6 (decisiones, tool-use, resúmenes coherentes).
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const TOOLS = [
  {
    name: "createRecord",
    description:
      "Crea un nuevo registro en un módulo del ERP del tenant. Útil para crear facturas, presupuestos, clientes, tareas, etc. " +
      "El payload debe incluir los campos relevantes del módulo (numero, cliente, importe, concepto, estado, etc.).",
    input_schema: {
      type: "object",
      properties: {
        moduleKey: { type: "string", description: "ej: facturacion, clientes, tareas, presupuestos, productos, proyectos" },
        payload: { type: "object", description: "Campos del registro como pares clave-valor" },
      },
      required: ["moduleKey", "payload"],
    },
  },
  {
    name: "listRecords",
    description: "Lista registros existentes en un módulo. Opcionalmente filtra por texto en cualquier campo.",
    input_schema: {
      type: "object",
      properties: {
        moduleKey: { type: "string" },
        filterText: { type: "string", description: "Texto opcional para filtrar" },
        limit: { type: "number", description: "Máx 50, default 20" },
      },
      required: ["moduleKey"],
    },
  },
  {
    name: "sendEmail",
    description: "Envía un email al destinatario indicado (vía cola de jobs).",
    input_schema: {
      type: "object",
      properties: {
        to: { type: "string", description: "Email destinatario" },
        subject: { type: "string" },
        html: { type: "string", description: "Cuerpo HTML del email" },
      },
      required: ["to", "subject", "html"],
    },
  },
];

const SYSTEM_PROMPT =
  "Eres el asistente IA de Prontara, un ERP para PYMES españolas pequeñas (4-20 empleados). " +
  "Tu trabajo es interpretar lo que el usuario pide y EJECUTAR las acciones necesarias usando las herramientas disponibles. " +
  "Después de cada acción, confirma al usuario en lenguaje claro y natural lo que has hecho. " +
  "Si te falta algún dato esencial (ej. el cliente para una factura, o el importe), pregúntalo brevemente antes de actuar. " +
  "Usa el idioma del usuario. Sé conciso. Nunca inventes IDs ni datos.";

type ToolUse = { type: "tool_use"; id: string; name: string; input: Record<string, unknown> };
type TextBlock = { type: "text"; text: string };
type ContentBlock = TextBlock | ToolUse | { type: string; [k: string]: unknown };

export async function POST(request: NextRequest) {
  try {
    const session = requireTenantSession(request);
    if (!session) return NextResponse.json({ ok: false, error: "Sesión inválida." }, { status: 401 });

    const apiKey = String(process.env.ANTHROPIC_API_KEY || "").trim();
    if (!apiKey) {
      return NextResponse.json({ ok: false, error: "Asistente IA no disponible (falta ANTHROPIC_API_KEY)." }, { status: 503 });
    }

    const body = await request.json();
    const prompt = String(body?.prompt || "").trim();
    if (!prompt) return NextResponse.json({ ok: false, error: "Falta prompt." }, { status: 400 });
    if (prompt.length > 4000) return NextResponse.json({ ok: false, error: "Prompt demasiado largo." }, { status: 400 });

    type Message = { role: "user" | "assistant"; content: string | ContentBlock[] };
    const messages: Message[] = [{ role: "user", content: prompt }];

    const actionsLog: Array<{ tool: string; input: unknown; output: unknown }> = [];

    // Loop tool-use, máx 5 iteraciones
    for (let iter = 0; iter < 5; iter++) {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 2048,
          system: SYSTEM_PROMPT,
          tools: TOOLS,
          messages,
        }),
      });
      const data = await r.json();
      if (!r.ok) {
        return NextResponse.json({ ok: false, error: "AI: " + (data?.error?.message || r.status) }, { status: 500 });
      }

      const content = (data.content || []) as ContentBlock[];
      const toolUses = content.filter((c): c is ToolUse => c.type === "tool_use");

      if (toolUses.length === 0) {
        // No más tools — respuesta final
        const textParts = content.filter((c): c is TextBlock => c.type === "text");
        const finalText = textParts.map((t) => t.text).join("\n");
        return NextResponse.json({
          ok: true,
          response: finalText,
          actions: actionsLog,
        });
      }

      // Ejecutar cada tool y volver a llamar al modelo
      messages.push({ role: "assistant", content });
      const toolResults: ContentBlock[] = [];
      for (const tu of toolUses) {
        let result: unknown;
        try {
          if (tu.name === "createRecord") {
            const moduleKey = String(tu.input.moduleKey || "");
            const payload = tu.input.payload as Record<string, unknown>;
            await createModuleRecordAsync(moduleKey, payload as Record<string, string>, session.clientId);
            result = { ok: true, message: "Registro creado en " + moduleKey };
          } else if (tu.name === "listRecords") {
            const moduleKey = String(tu.input.moduleKey || "");
            const filterText = String(tu.input.filterText || "").toLowerCase();
            const limit = Math.min(50, Number(tu.input.limit) || 20);
            let rows = await listModuleRecordsAsync(moduleKey, session.clientId);
            if (filterText) {
              rows = rows.filter((r) => JSON.stringify(r).toLowerCase().includes(filterText));
            }
            result = { count: rows.length, rows: rows.slice(0, limit) };
          } else if (tu.name === "sendEmail") {
            await enqueueJob({
              kind: "email",
              clientId: session.clientId,
              payload: { to: tu.input.to, subject: tu.input.subject, html: tu.input.html },
            });
            result = { ok: true, message: "Email encolado" };
          } else {
            result = { ok: false, error: "Herramienta desconocida" };
          }
        } catch (err) {
          result = { ok: false, error: err instanceof Error ? err.message : String(err) };
        }
        actionsLog.push({ tool: tu.name, input: tu.input, output: result });
        toolResults.push({
          type: "tool_result",
          tool_use_id: tu.id,
          content: JSON.stringify(result),
        });
      }
      messages.push({ role: "user", content: toolResults });
    }

    return NextResponse.json({
      ok: true,
      response: "Demasiados pasos — reformula la petición.",
      actions: actionsLog,
    });
  } catch (e) {
    captureError(e, { scope: "/api/runtime/ai-agent" });
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}
