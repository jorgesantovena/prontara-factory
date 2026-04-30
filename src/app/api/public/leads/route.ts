import { NextResponse, type NextRequest } from "next/server";
import { createLeadAsync } from "@/lib/persistence/leads-store-async";
import { consumeRateLimit, getClientIp } from "@/lib/saas/rate-limiter";

/**
 * POST /api/public/leads
 * Body: { name, email, company?, phone?, message?, sourceVertical? }
 *
 * Endpoint público (sin auth). Rate-limited por IP: 5 submissions / hora
 * para evitar abuso de spam desde la landing. Sin Captcha — mínimo viable.
 * Si hace falta escalar, meter hCaptcha / honeypot en el form.
 */
export async function POST(request: NextRequest) {
  const ip = getClientIp(request.headers);
  const rl = consumeRateLimit({
    key: "public-leads:" + ip,
    limit: 5,
    windowMs: 60 * 60 * 1000,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Demasiados envíos desde esta IP. Prueba otra vez en " +
          rl.retryAfterSeconds +
          " segundos.",
      },
      { status: 429 },
    );
  }

  let body: {
    name?: string;
    email?: string;
    company?: string;
    phone?: string;
    message?: string;
    sourceVertical?: string;
    // honeypot — si llega relleno, descartamos silenciosamente
    website?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Body JSON inválido." },
      { status: 400 },
    );
  }

  // Honeypot: campo `website` oculto. Un usuario humano nunca lo rellena;
  // los bots sí. Si viene, devolvemos OK fake para no dar señal al bot.
  if (body.website && body.website.trim().length > 0) {
    return NextResponse.json({ ok: true, honeypot: true });
  }

  try {
    const lead = await createLeadAsync({
      name: body.name || "",
      email: body.email || "",
      company: body.company,
      phone: body.phone,
      message: body.message,
      sourceVertical: body.sourceVertical,
      userAgent: request.headers.get("user-agent") || "",
      ip,
    });
    return NextResponse.json({
      ok: true,
      id: lead.id,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Error guardando el lead.",
      },
      { status: 400 },
    );
  }
}
