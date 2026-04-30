import { NextResponse, type NextRequest } from "next/server";
import { getSectorPackByKey } from "@/lib/factory/sector-pack-registry";

type RouteContext = { params: Promise<{ key: string }> };

/**
 * GET /api/public/verticales/[key]
 * Detalle público del vertical. Devuelve landing completa, lista de módulos
 * con labels, descripciones de entidades. NO expone fields, tableColumns,
 * demoData, ni assistantCopy.
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  const { key } = await context.params;
  const pack = getSectorPackByKey(key);
  if (!pack) {
    return NextResponse.json(
      { ok: false, error: "Vertical no encontrado: " + key },
      { status: 404 },
    );
  }

  const publicView = {
    key: pack.key,
    label: pack.label,
    sector: pack.sector,
    businessType: pack.businessType,
    description: pack.description,
    branding: {
      displayName: pack.branding.displayName,
      accentColor: pack.branding.accentColor,
      tone: pack.branding.tone,
    },
    labels: pack.labels,
    modules: pack.modules
      .filter((m) => m.enabled)
      .map((m) => ({
        moduleKey: m.moduleKey,
        label: m.label,
        navigationLabel: m.navigationLabel,
      })),
    entities: pack.entities.map((e) => ({
      key: e.key,
      label: e.label,
      description: e.description,
      moduleKey: e.moduleKey,
    })),
    landing: {
      headline: pack.landing.headline,
      subheadline: pack.landing.subheadline,
      bullets: pack.landing.bullets,
      cta: pack.landing.cta,
    },
    dashboardPriorities: pack.dashboardPriorities.map((p) => ({
      key: p.key,
      label: p.label,
      description: p.description,
    })),
  };

  return NextResponse.json(
    { ok: true, vertical: publicView },
    {
      headers: {
        "Cache-Control": "public, max-age=60, stale-while-revalidate=600",
      },
    },
  );
}
