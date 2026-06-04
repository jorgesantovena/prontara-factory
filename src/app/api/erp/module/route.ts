import { NextRequest, NextResponse } from "next/server";
import {
  createModuleRecordAsync,
  deleteModuleRecordAsync,
  listModuleRecordsAsync,
  updateModuleRecordAsync,
} from "@/lib/persistence/active-client-data-store-async";
import { requireTenantSession } from "@/lib/saas/auth-session";
import {
  assertCanCreateOne,
  mapModuleToPlanResource,
  PlanLimitError,
} from "@/lib/saas/plan-limits";
import { checkTenantSubscriptionAsync } from "@/lib/saas/subscription-guard";
import { canPerform, type PermissionAction } from "@/lib/saas/permission-checker";
import { captureError } from "@/lib/observability/error-capture";

async function ensurePermission(
  clientId: string,
  role: string,
  moduleKey: string,
  action: PermissionAction,
): Promise<NextResponse | null> {
  const allowed = await canPerform(clientId, role, moduleKey, action);
  if (!allowed) {
    return NextResponse.json(
      {
        ok: false,
        error: "Tu rol no tiene permiso para " + action + " en " + moduleKey + ".",
        code: "PERMISSION_DENIED",
      },
      { status: 403 },
    );
  }
  return null;
}

function unauthorized() {
  return NextResponse.json(
    { ok: false, error: "Sesión no válida o tenant no autorizado." },
    { status: 401 }
  );
}

export async function GET(request: NextRequest) {
  try {
    const session = requireTenantSession(request);
    if (!session) {
      return unauthorized();
    }

    const moduleKey = String(request.nextUrl.searchParams.get("module") || "").trim();

    if (!moduleKey) {
      return NextResponse.json(
        { ok: false, error: "Falta el parámetro module." },
        { status: 400 }
      );
    }

    // H2-PERM: verificar permiso de view
    const permError = await ensurePermission(session.clientId, session.role, moduleKey, "view");
    if (permError) return permError;

    const rows = await listModuleRecordsAsync(moduleKey, session.clientId);

    return NextResponse.json({
      ok: true,
      module: moduleKey,
      rows,
    });
  } catch (error) {
    captureError(error, { scope: "/api/erp/module GET" });
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Error cargando módulo.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = requireTenantSession(request);
    if (!session) {
      return unauthorized();
    }

    const body = await request.json();
    const moduleKey = String(body?.module || "").trim();
    const mode = String(body?.mode || "create").trim();

    if (!moduleKey) {
      return NextResponse.json(
        { ok: false, error: "Falta module." },
        { status: 400 }
      );
    }

    // H2-PERM: verificar permiso correspondiente al modo
    const actionByMode: Record<string, PermissionAction> = {
      create: "create",
      edit: "edit",
      delete: "delete",
    };
    const requiredAction = actionByMode[mode];
    if (requiredAction) {
      const permError = await ensurePermission(session.clientId, session.role, moduleKey, requiredAction);
      if (permError) return permError;
    }

    // Bloqueo de escritura si la suscripción no está activa. Aplica a
    // create/edit/delete; las lecturas siguen funcionando para que el
    // tenant pueda consultar sus datos aunque esté cancelled.
    if (mode === "create" || mode === "edit" || mode === "delete") {
      const subscription = await checkTenantSubscriptionAsync(session);
      if (!subscription.allowed) {
        return NextResponse.json(
          {
            ok: false,
            error: subscription.reason,
            code: subscription.code,
            subscriptionStatus: subscription.record.status,
          },
          { status: 403 }
        );
      }
    }

    const tenant = session.clientId;

    if (mode === "create") {
      const resource = mapModuleToPlanResource(moduleKey);
      if (resource) {
        try {
          await assertCanCreateOne(tenant, resource);
        } catch (error) {
          if (error instanceof PlanLimitError) {
            return NextResponse.json(
              {
                ok: false,
                error: error.message,
                code: "PLAN_LIMIT_REACHED",
                resource: error.resource,
                used: error.used,
                limit: error.limit,
                planKey: error.planKey,
              },
              { status: 402 }
            );
          }
          throw error;
        }
      }

      const created = await createModuleRecordAsync(moduleKey, body?.payload || {}, tenant);
      // Preguntas 1.con / mail 2 punto 9 — Trigger post-create: si se
      // acaba de dar de alta una FACTURA con formaPago que tiene N
      // vencimientos, generamos automáticamente esos N registros en
      // `vencimientos-factura`. Tolera errores: si falla la creación
      // de vencimientos no se cancela la factura.
      if (moduleKey === "facturacion" && created?.id) {
        try {
          await generarVencimientosDesdeFactura(created as Record<string, string>, tenant);
        } catch (e) {
          captureError(e, { scope: "facturacion → generarVencimientos" });
        }
      }
      return NextResponse.json({ ok: true, row: created });
    }

    if (mode === "edit") {
      const recordId = String(body?.recordId || "").trim();
      if (!recordId) {
        return NextResponse.json(
          { ok: false, error: "Falta recordId." },
          { status: 400 }
        );
      }

      const updated = await updateModuleRecordAsync(moduleKey, recordId, body?.payload || {}, tenant);
      // Preguntas 1.con / mail 2 punto 9 — Trigger post-edit: si se
      // marca un vencimiento como cobrado, comprobar si TODOS los
      // vencimientos de la misma factura ya están cobrados; si sí,
      // marcar la factura como Cobrada.
      if (moduleKey === "vencimientos-factura" && updated && String((updated as Record<string, string>).estado || "").toLowerCase() === "cobrado") {
        try {
          await trySetFacturaCobradaSiTodosLosVencimientosCobrados(updated as Record<string, string>, tenant);
        } catch (e) {
          captureError(e, { scope: "vencimientos-factura → factura.cobrada" });
        }
      }
      return NextResponse.json({ ok: true, row: updated });
    }

    if (mode === "delete") {
      const recordId = String(body?.recordId || "").trim();
      if (!recordId) {
        return NextResponse.json(
          { ok: false, error: "Falta recordId." },
          { status: 400 }
        );
      }

      await deleteModuleRecordAsync(moduleKey, recordId, tenant);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json(
      { ok: false, error: "Modo no soportado." },
      { status: 400 }
    );
  } catch (error) {
    captureError(error, { scope: "/api/erp/module POST" });
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Error guardando módulo.",
      },
      { status: 500 }
    );
  }
}

/**
 * Preguntas 1.con / mail 2 punto 9 — Generación automática de
 * vencimientos al crear una factura.
 *
 * Resuelve la forma de pago referenciada (por código o id) y crea N
 * registros en `vencimientos-factura` repartiendo el importe e
 * incrementando la fecha según `diasAplazamiento` y `numVencimientos`.
 * Si la factura no tiene forma de pago, crea un único vencimiento con
 * fecha = fechaEmision e importe completo.
 */
async function generarVencimientosDesdeFactura(factura: Record<string, string>, tenant: string): Promise<void> {
  const formaPagoRef = String(factura.formaPago || "").trim();
  const importeTotal = parseFloat(String(factura.importe || "0").replace(",", ".")) || 0;
  const fechaEmision = String(factura.fechaEmision || factura.fecha || new Date().toISOString().slice(0, 10));

  // Cargar formas-pago para resolver diasAplazamiento + numVencimientos.
  let dias = 0;
  let n = 1;
  if (formaPagoRef) {
    try {
      const formas = await listModuleRecordsAsync("formas-pago", tenant);
      const arr = (Array.isArray(formas) ? formas : []) as Array<Record<string, string>>;
      const fp = arr.find((r) => String(r.codigo || "") === formaPagoRef || String(r.id || "") === formaPagoRef || String(r.nombre || "") === formaPagoRef);
      if (fp) {
        dias = parseInt(String(fp.diasAplazamiento || "0"), 10) || 0;
        n = Math.max(1, parseInt(String(fp.numVencimientos || "1"), 10) || 1);
      }
    } catch { /* tolerar — fallback al venc. único */ }
  }
  const importeUnit = n > 0 ? (importeTotal / n) : importeTotal;

  for (let i = 0; i < n; i++) {
    const fecha = nuevaFechaPlus(fechaEmision, dias * (i + 1));
    await createModuleRecordAsync("vencimientos-factura", {
      factura: String(factura.numero || factura.id || ""),
      nVencimiento: String(i + 1),
      fecha,
      importe: importeUnit.toFixed(2).replace(".", ","),
      formaPago: formaPagoRef,
      estado: "pendiente",
    }, tenant);
  }
}

function nuevaFechaPlus(baseIso: string, dias: number): string {
  const d = new Date(baseIso);
  if (Number.isNaN(d.getTime())) return baseIso;
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

/**
 * Preguntas 1.con / mail 2 punto 9 — Si todos los vencimientos de
 * una factura están en estado "cobrado", la factura pasa a "cobrada".
 */
async function trySetFacturaCobradaSiTodosLosVencimientosCobrados(venc: Record<string, string>, tenant: string): Promise<void> {
  const facturaRef = String(venc.factura || "").trim();
  if (!facturaRef) return;
  const vencs = await listModuleRecordsAsync("vencimientos-factura", tenant);
  const hermanos = (Array.isArray(vencs) ? vencs : []).filter((v) => String((v as Record<string, string>).factura || "") === facturaRef) as Array<Record<string, string>>;
  if (hermanos.length === 0) return;
  const todosCobrados = hermanos.every((v) => String(v.estado || "").toLowerCase() === "cobrado");
  if (!todosCobrados) return;
  // Buscar la factura y marcarla como cobrada.
  const facturas = await listModuleRecordsAsync("facturacion", tenant);
  const f = (Array.isArray(facturas) ? facturas : []).find((row) => String((row as Record<string, string>).numero || "") === facturaRef || String((row as Record<string, string>).id || "") === facturaRef) as Record<string, string> | undefined;
  if (!f) return;
  if (String(f.estado || "").toLowerCase() === "cobrada") return; // ya está
  await updateModuleRecordAsync("facturacion", String(f.id || ""), { ...f, estado: "cobrada" }, tenant);
}