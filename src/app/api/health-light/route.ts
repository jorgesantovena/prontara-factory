import { NextResponse } from "next/server";

/**
 * GET /api/health-light (H5-SCALE-02)
 *
 * Health check ligero ejecutado en Edge Runtime — latencia muy baja
 * desde cualquier región. NO toca la BD ni hace pings externos. Solo
 * confirma que el lambda responde y devuelve la región.
 *
 * Útil para uptime checks externos (StatusCake, BetterStack) que
 * solo quieren saber si el servicio responde.
 *
 * Para el health check completo (BD + Stripe + Resend + Anthropic),
 * usar /api/health.
 */
export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "prontara-factory",
    region: process.env.VERCEL_REGION || "unknown",
    edgeRuntime: true,
    at: new Date().toISOString(),
  });
}
