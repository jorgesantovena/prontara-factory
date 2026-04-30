import { NextResponse, type NextRequest } from "next/server";
import { requireFactoryAdmin } from "@/lib/factory-chat/auth";
import {
  getSectorPackByKey,
  getSectorPackBaseByKey,
} from "@/lib/factory/sector-pack-registry";
import {
  readVerticalOverrideAsync,
  writeVerticalOverrideAsync,
  deleteVerticalOverrideAsync,
} from "@/lib/persistence/vertical-overrides-async";
import type { SectorPackOverride } from "@/lib/factory/sector-pack-override-types";
import { invalidateFactoryCaches } from "@/lib/saas/tenant-regeneration";

type RouteContext = { params: Promise<{ key: string }> };

/**
 * GET /api/factory/verticales/[key]
 * Devuelve la definición completa mergeada + la base + el override crudo.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const admin = requireFactoryAdmin(request);
  if (!admin) {
    return NextResponse.json(
      { ok: false, error: "Se requiere sesión con rol admin en la Factory." },
      { status: 401 },
    );
  }

  const { key } = await context.params;
  const merged = getSectorPackByKey(key);
  if (!merged) {
    return NextResponse.json(
      { ok: false, error: "Vertical no encontrado: " + key },
      { status: 404 },
    );
  }

  const base = getSectorPackBaseByKey(key);
  const override = await readVerticalOverrideAsync(merged.key);

  return NextResponse.json({
    ok: true,
    merged,
    base,
    override,
  });
}

/**
 * PUT /api/factory/verticales/[key]
 * Body: SectorPackOverride (sin key, se toma de la URL). Guarda el override
 * y devuelve la definición mergeada resultante.
 */
export async function PUT(request: NextRequest, context: RouteContext) {
  const admin = requireFactoryAdmin(request);
  if (!admin) {
    return NextResponse.json(
      { ok: false, error: "Se requiere sesión con rol admin en la Factory." },
      { status: 401 },
    );
  }

  const { key } = await context.params;
  const base = getSectorPackBaseByKey(key);
  if (!base) {
    return NextResponse.json(
      { ok: false, error: "Vertical no encontrado: " + key },
      { status: 404 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Body JSON inválido." },
      { status: 400 },
    );
  }

  const override: SectorPackOverride = {
    ...(body as SectorPackOverride),
    key: base.key,
  };

  try {
    const saved = await writeVerticalOverrideAsync({
      key: base.key,
      override,
      updatedBy: admin.email,
    });
    invalidateFactoryCaches();
    const merged = getSectorPackByKey(base.key);
    return NextResponse.json({ ok: true, override: saved, merged });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Error guardando override.",
      },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/factory/verticales/[key]
 * Borra el override y deja el vertical en su definición base.
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  const admin = requireFactoryAdmin(request);
  if (!admin) {
    return NextResponse.json(
      { ok: false, error: "Se requiere sesión con rol admin en la Factory." },
      { status: 401 },
    );
  }

  const { key } = await context.params;
  const base = getSectorPackBaseByKey(key);
  if (!base) {
    return NextResponse.json(
      { ok: false, error: "Vertical no encontrado: " + key },
      { status: 404 },
    );
  }

  const removed = await deleteVerticalOverrideAsync(base.key);
  invalidateFactoryCaches();
  return NextResponse.json({
    ok: true,
    removed,
    merged: getSectorPackByKey(base.key),
  });
}
