import { NextRequest, NextResponse } from "next/server";
import { requireTenantSession } from "@/lib/saas/auth-session";
import { checkTenantSubscriptionAsync } from "@/lib/saas/subscription-guard";
import {
  createModuleRecordAsync,
  listModuleRecordsAsync,
} from "@/lib/persistence/active-client-data-store-async";

/**
 * POST /api/erp/proyecto-renovar (SF-05)
 *
 * Renovación 1-clic. Body: { proyectoId: string }
 *
 * Lee el proyecto original, calcula fechas nuevas (inicio = hoy o día
 * siguiente a la caducidad anterior; duración = igual a la del original
 * o 12 meses si no se puede calcular) y crea un proyecto nuevo
 * "continuación" con los mismos parámetros relevantes.
 *
 * Diseño explícito:
 *   - kilometros y notas se reinician (km a "0", notas con referencia
 *     al proyecto padre).
 *   - estado = "activo".
 *   - nombre = original con sufijo " (renovación)".
 *   - El operador puede editar el resultado después si lo necesita.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function unauthorized() {
  return NextResponse.json(
    { ok: false, error: "Sesión no válida o tenant no autorizado." },
    { status: 401 },
  );
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDaysIso(baseIso: string, days: number): string {
  const base = new Date(baseIso + "T00:00:00Z");
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

function diffDays(fromIso: string, toIso: string): number {
  if (!fromIso || !toIso) return 0;
  const a = new Date(fromIso + "T00:00:00Z").getTime();
  const b = new Date(toIso + "T00:00:00Z").getTime();
  return Math.max(0, Math.round((b - a) / (24 * 60 * 60 * 1000)));
}

export async function POST(request: NextRequest) {
  try {
    const session = requireTenantSession(request);
    if (!session) return unauthorized();

    const subscription = await checkTenantSubscriptionAsync(session);
    if (!subscription.allowed) {
      return NextResponse.json(
        {
          ok: false,
          error: subscription.reason,
          code: subscription.code,
        },
        { status: 403 },
      );
    }

    let body: { proyectoId?: string } = {};
    try {
      body = (await request.json()) as { proyectoId?: string };
    } catch {
      // body opcional
    }

    const proyectoId = String(body?.proyectoId || "").trim();
    if (!proyectoId) {
      return NextResponse.json(
        { ok: false, error: "Falta proyectoId en el body." },
        { status: 400 },
      );
    }

    const proyectos = await listModuleRecordsAsync("proyectos", session.clientId);
    const original = proyectos.find((p) => String(p.id) === proyectoId);
    if (!original) {
      return NextResponse.json(
        { ok: false, error: "Proyecto " + proyectoId + " no encontrado." },
        { status: 404 },
      );
    }

    // Calcula fechas del nuevo:
    //   inicio = max(hoy, día siguiente a la caducidad anterior)
    //   caducidad = inicio + duración del original (o 365 días si no calculable)
    const today = todayIso();
    const oldStart = String(original.fechaInicio || "").trim();
    const oldEnd = String(original.fechaCaducidad || "").trim();

    let newStart = today;
    if (oldEnd && /^\d{4}-\d{2}-\d{2}$/.test(oldEnd)) {
      const dayAfter = addDaysIso(oldEnd, 1);
      newStart = dayAfter > today ? dayAfter : today;
    }

    const originalDays = diffDays(oldStart, oldEnd);
    const durationDays = originalDays > 0 ? originalDays : 365;
    const newEnd = addDaysIso(newStart, durationDays);

    const originalName = String(original.nombre || "").trim();
    const newName = originalName
      ? originalName + " (renovación)"
      : "Renovación";

    const renewalNote =
      "Renovación de '" +
      originalName +
      "' (vigencia anterior: " +
      (oldStart || "?") +
      " → " +
      (oldEnd || "?") +
      ").";

    const newPayload: Record<string, unknown> = {
      nombre: newName,
      cliente: String(original.cliente || ""),
      codigoTipo: String(original.codigoTipo || ""),
      responsable: String(original.responsable || ""),
      estado: "activo",
      facturable: String(original.facturable || ""),
      fechaInicio: newStart,
      fechaCaducidad: newEnd,
      kilometros: "0",
      tarifaHoraOverride: String(original.tarifaHoraOverride || ""),
      notas: renewalNote,
      // Trazabilidad: id del padre por si el operador quiere ver el
      // histórico. Se guarda como string en el payload Json.
      proyectoPadreId: proyectoId,
    };

    const created = await createModuleRecordAsync(
      "proyectos",
      newPayload,
      session.clientId,
    );

    return NextResponse.json({
      ok: true,
      proyectoOriginalId: proyectoId,
      proyectoNuevo: created,
      mensaje:
        "Renovado: " +
        newName +
        " (" +
        newStart +
        " → " +
        newEnd +
        ").",
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Error renovando proyecto.",
      },
      { status: 500 },
    );
  }
}
