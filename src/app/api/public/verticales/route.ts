import { NextResponse } from "next/server";
import { listSectorPacks } from "@/lib/factory/sector-pack-registry";

/**
 * GET /api/public/verticales
 * Lista pública de verticales con solo los campos expuestos hacia fuera:
 * branding, descripción, contadores, primera línea de landing. Sin
 * internals (fields concretos, primaryFields de entidades, demo data).
 * Sin autenticación.
 */
export async function GET() {
  const packs = listSectorPacks();

  const verticals = packs.map((p) => ({
    key: p.key,
    label: p.label,
    sector: p.sector,
    businessType: p.businessType,
    description: p.description,
    branding: {
      displayName: p.branding.displayName,
      accentColor: p.branding.accentColor,
      tone: p.branding.tone,
    },
    landing: {
      headline: p.landing.headline,
      subheadline: p.landing.subheadline,
    },
    moduleCount: p.modules.filter((m) => m.enabled).length,
    entityCount: p.entities.length,
  }));

  return NextResponse.json(
    { ok: true, verticals },
    {
      headers: {
        "Cache-Control": "public, max-age=60, stale-while-revalidate=600",
      },
    },
  );
}
