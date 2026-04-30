import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireTenantSession } from "@/lib/saas/auth-session";
import { answerErpAssistant } from "@/lib/erp/assistant-core";
import { getTenantRuntimeConfigFromRequest } from "@/lib/saas/tenant-runtime-config";
import {
  answerSoftwareFactoryIntent,
  softwareFactorySuggestions,
} from "@/lib/verticals/software-factory/assistant-intents";

/**
 * POST /api/runtime/assistant
 *
 * Responde a una consulta del asistente conversacional usando:
 *   - la sesión firmada para resolver el tenant (F-01)
 *   - el TenantRuntimeConfig del tenant para cargar labels, welcome y
 *     suggestion por sector (resueltos desde el pack sectorial + overrides)
 *   - un router de intents por vertical que intercepta consultas específicas
 *     ("proyectos en riesgo", "pipeline por fase", etc.) antes de pasarlas
 *     al router genérico `answerErpAssistant`
 *
 * Body: { prompt: string }
 * Devuelve: { ok, answer, suggestions }
 */
export async function POST(request: NextRequest) {
  const session = requireTenantSession(request);
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "Sesión no válida o tenant no autorizado." },
      { status: 401 }
    );
  }

  try {
    const body = (await request.json().catch(() => ({}))) as { prompt?: unknown };
    const prompt = typeof body.prompt === "string" ? body.prompt : "";

    const result = getTenantRuntimeConfigFromRequest(request);
    const config = result.ok ? result.config : null;

    const businessType = String(config?.businessType || "").trim().toLowerCase();
    const displayName = config?.displayName || "Tu entorno";

    // Router por vertical: si el tenant es software-factory intentamos
    // responder con los intents específicos. Si null → cae al genérico.
    let answer = null as ReturnType<typeof answerErpAssistant> | null;
    if (businessType === "software-factory") {
      answer = answerSoftwareFactoryIntent(prompt, session.clientId, displayName);
    }

    if (!answer) {
      answer = answerErpAssistant(prompt, session.clientId, {
        labels: config?.labels,
        assistantWelcome: config?.texts?.assistantWelcome,
        assistantSuggestion: config?.texts?.assistantSuggestion,
      });
    }

    return NextResponse.json({
      ok: true,
      answer,
      suggestions: buildSuggestions(config, businessType),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Error en el asistente.",
      },
      { status: 500 }
    );
  }
}

type RuntimeConfigResult = ReturnType<typeof getTenantRuntimeConfigFromRequest>;
type RuntimeConfig = NonNullable<RuntimeConfigResult["config"]>;

function buildSuggestions(config: RuntimeConfig | null, businessType: string): string[] {
  const labels = config?.labels || {};

  // Chips específicos del vertical (si aplica). Se muestran primero.
  const verticalChips = businessType === "software-factory" ? softwareFactorySuggestions() : [];

  const base = [
    "Resume la actividad reciente",
    "Enséñame las " + (labels.facturacion || "facturas").toLowerCase() + " pendientes",
    "Dame una visión de un " + (labels.clientes || "cliente").toLowerCase(),
  ];

  if (config?.texts?.assistantSuggestion) {
    base.unshift(config.texts.assistantSuggestion);
  }

  const combined = [...verticalChips, ...base];

  // Dedupe manteniendo orden.
  const seen = new Set<string>();
  return combined.filter((item) => {
    const k = item.trim().toLowerCase();
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
