import { NextResponse, type NextRequest } from "next/server";
import { buildAuthorizationUrl, type OAuthProvider } from "@/lib/saas/oauth-providers";

/**
 * GET /api/runtime/oauth/{google|microsoft}/start?tenant=slug (H2-SSO)
 *
 * Redirige al usuario a la URL de autorización del proveedor. Tras
 * autorizar, el proveedor llamará a /callback.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider: providerRaw } = await params;
  const provider = providerRaw as OAuthProvider;
  if (provider !== "google" && provider !== "microsoft") {
    return NextResponse.json(
      { ok: false, error: "Proveedor no soportado." },
      { status: 400 },
    );
  }

  const tenantSlug = String(request.nextUrl.searchParams.get("tenant") || "").trim();
  if (!tenantSlug) {
    return NextResponse.json(
      { ok: false, error: "Falta el parámetro tenant." },
      { status: 400 },
    );
  }

  const result = buildAuthorizationUrl({ provider, tenantSlug });
  if ("error" in result) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
  }

  // Guardamos el state en cookie (signed via PRONTARA_SESSION_SECRET sería más
  // seguro; para MVP usamos la state en URL que ya es no-replay-able)
  return NextResponse.redirect(result.url);
}
