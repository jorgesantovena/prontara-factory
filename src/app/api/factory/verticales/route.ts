import { NextResponse, type NextRequest } from "next/server";
import { requireFactoryAdmin } from "@/lib/factory-chat/auth";
import {
  listSectorPacks,
  listSectorPacksBase,
} from "@/lib/factory/sector-pack-registry";
import { listVerticalOverridesAsync } from "@/lib/persistence/vertical-overrides-async";

/**
 * GET /api/factory/verticales
 *
 * Devuelve la lista de verticales (sector packs) con:
 *   - datos del vertical ya mergeado (lo que ven los tenants)
 *   - indicador de si tiene override activo y cuándo se editó
 *
 * Solo admins/owners.
 */
export async function GET(request: NextRequest) {
  const admin = requireFactoryAdmin(request);
  if (!admin) {
    return NextResponse.json(
      { ok: false, error: "Se requiere sesión con rol admin en la Factory." },
      { status: 401 },
    );
  }

  try {
    const merged = listSectorPacks();
    const base = listSectorPacksBase();

    // Si la lectura de overrides falla (p.ej. Postgres caído o tabla aún no
    // creada), seguimos sin overrides en lugar de cascar la página entera.
    let overrides: Awaited<ReturnType<typeof listVerticalOverridesAsync>> = [];
    try {
      overrides = await listVerticalOverridesAsync();
    } catch (overrideErr) {
      console.error("[/api/factory/verticales] listVerticalOverridesAsync falló:", overrideErr);
    }
    const overrideByKey = new Map(overrides.map((o) => [o.key, o]));

    const summaries = merged.map((pack, index) => {
      const basePack = base[index];
      const override = overrideByKey.get(pack.key) || null;
      return {
        key: pack.key,
        label: pack.label,
        sector: pack.sector,
        businessType: pack.businessType,
        description: pack.description,
        accentColor: pack.branding.accentColor,
        displayName: pack.branding.displayName,
        moduleCount: pack.modules.length,
        entityCount: pack.entities.length,
        fieldCount: pack.fields.length,
        hasOverride: override !== null,
        overrideUpdatedAt: override?.updatedAt || null,
        overrideUpdatedBy: override?.updatedBy || null,
        baseLabel: basePack?.label ?? pack.label,
      };
    });

    return NextResponse.json({
      ok: true,
      verticals: summaries,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error inesperado al listar verticales.";
    console.error("[/api/factory/verticales] ERROR:", err);
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 },
    );
  }
}
