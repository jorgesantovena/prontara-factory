import { NextResponse, type NextRequest } from "next/server";
import { requireTenantSession } from "@/lib/saas/auth-session";
import { captureError } from "@/lib/observability/error-capture";

/**
 * POST /api/runtime/ocr/extract-invoice (H6-OCR)
 * Body: { imageBase64: string, mediaType?: "image/jpeg"|"image/png", tipo?: "factura"|"ticket" }
 *
 * OCR de facturas/tickets vía Anthropic Vision. Devuelve JSON
 * estructurado con los campos extraídos:
 *   { proveedor, fecha, numero, importeTotal, baseImponible, iva, concepto }
 *
 * Requiere ANTHROPIC_API_KEY. Sin ella, devuelve { ok: false, reason: "not_configured" }.
 *
 * Modelo: claude haiku 4.5 (rápido + barato + multimodal).
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

const PROMPT_FACTURA = `Eres un asistente de extracción de datos de facturas españolas.

Analiza la imagen de la factura/ticket y devuelve EXCLUSIVAMENTE un JSON con esta estructura (sin texto adicional, sin markdown, sin explicaciones):

{
  "proveedor": "nombre fiscal del emisor",
  "cif": "CIF/NIF del emisor",
  "numero": "número de factura/ticket",
  "fecha": "YYYY-MM-DD",
  "concepto": "descripción breve",
  "baseImponible": número (sin €),
  "iva": número (sin €),
  "importeTotal": número (sin €),
  "categoria": "una de: comida | transporte | suministros | material | servicios | otros"
}

Si algún campo no aparece o no estás seguro, usa null. NO inventes datos.`;

export async function POST(request: NextRequest) {
  try {
    const session = requireTenantSession(request);
    if (!session) return NextResponse.json({ ok: false, error: "Sesión inválida." }, { status: 401 });

    const apiKey = String(process.env.ANTHROPIC_API_KEY || "").trim();
    if (!apiKey) {
      return NextResponse.json({ ok: false, error: "OCR no disponible (falta ANTHROPIC_API_KEY)." }, { status: 503 });
    }

    const body = await request.json();
    const imageBase64 = String(body?.imageBase64 || "").trim();
    const mediaType = String(body?.mediaType || "image/jpeg").trim();
    if (!imageBase64) {
      return NextResponse.json({ ok: false, error: "Falta imageBase64." }, { status: 400 });
    }
    if (imageBase64.length > 8_000_000) {
      return NextResponse.json({ ok: false, error: "Imagen demasiado grande (>6MB)." }, { status: 400 });
    }

    // Limpiar prefijo data:image si viene
    const cleanB64 = imageBase64.replace(/^data:image\/[a-z]+;base64,/, "");

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 25000);
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "base64", media_type: mediaType, data: cleanB64 },
              },
              { type: "text", text: PROMPT_FACTURA },
            ],
          },
        ],
      }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);

    const data = await r.json();
    if (!r.ok) {
      return NextResponse.json({ ok: false, error: "OCR API: " + (data?.error?.message || r.status) }, { status: 500 });
    }

    const text = String(data?.content?.[0]?.text || "").trim();
    // Parsear JSON — tolerar markdown ```json ... ```
    const jsonText = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      return NextResponse.json({
        ok: false,
        error: "OCR devolvió texto no JSON. Reintenta con foto más clara.",
        raw: text.slice(0, 500),
      }, { status: 500 });
    }

    return NextResponse.json({ ok: true, data: parsed });
  } catch (e) {
    captureError(e, { scope: "/api/runtime/ocr/extract-invoice" });
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}
