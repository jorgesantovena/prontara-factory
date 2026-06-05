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
        // TEST-20 F.3 bis — Recalcular Facturado del cliente.
        try {
          await recalcularFacturadoCliente(String((created as Record<string, string>).cliente || ""), tenant);
        } catch (e) {
          captureError(e, { scope: "facturacion → recalcularFacturadoCliente" });
        }
      }
      // TEST-20 F.3 — Trigger post-create Tarea: recalcula Consumo del
      // cliente del proyecto al que se imputa, sumando horas de tareas
      // de proyectos facturables. Tolerante a fallos: si el cliente o
      // el proyecto no existen aún, lo deja como estaba.
      if (moduleKey === "actividades" && created?.id) {
        try {
          await recalcularConsumoClienteDesdeTarea(created as Record<string, string>, tenant);
        } catch (e) {
          captureError(e, { scope: "actividades → recalcularConsumoCliente" });
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
      // TEST-20 F.3 — Trigger post-edit Tarea: las horas/proyecto pueden
      // haber cambiado, recalculamos Consumo del cliente correspondiente.
      if (moduleKey === "actividades" && updated) {
        try {
          await recalcularConsumoClienteDesdeTarea(updated as Record<string, string>, tenant);
        } catch (e) {
          captureError(e, { scope: "actividades edit → recalcularConsumoCliente" });
        }
      }
      // TEST-20 F.3 — Trigger post-edit Proyecto: si cambia el flag
      // facturable, el Consumo del cliente del proyecto debe
      // recalcularse (las tareas de este proyecto entran o salen del
      // sumatorio).
      if (moduleKey === "proyectos" && updated) {
        try {
          const proy = updated as Record<string, string>;
          const clienteRef = String(proy.cliente || "");
          if (clienteRef) {
            // Reutilizamos la helper pasando una tarea sintética con el
            // cliente apuntando al proyecto modificado; el bucle interno
            // releerá tareas y proyectos del tenant.
            await recalcularConsumoClienteDesdeTarea({ cliente: clienteRef, proyecto: String(proy.nombre || proy.id || "") }, tenant);
          }
        } catch (e) {
          captureError(e, { scope: "proyectos edit → recalcularConsumoCliente" });
        }
      }
      // TEST-20 F.3 bis — Trigger post-edit Factura: el importe o el
      // cliente puede haber cambiado, recalculamos Facturado.
      if (moduleKey === "facturacion" && updated) {
        try {
          await recalcularFacturadoCliente(String((updated as Record<string, string>).cliente || ""), tenant);
        } catch (e) {
          captureError(e, { scope: "facturacion edit → recalcularFacturadoCliente" });
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

// TEST-20 F.3 — Recalcula `cliente.consumoHoras` sumando el tiempo de
// todas las Tareas del cliente cuyo Proyecto sea facturable=Sí.
// La key del cliente puede venir como nombre (value de /api/erp/options)
// o como id si así se ha guardado; intentamos ambos.
function parseHorasNumber(v: unknown): number {
  if (typeof v === "number") return v;
  const s = String(v ?? "0").trim();
  if (s.includes(":")) {
    const [hh = "0", mm = "0"] = s.split(":");
    const h = parseInt(hh, 10);
    const m = parseInt(mm, 10);
    if (Number.isFinite(h) && Number.isFinite(m)) return h + m / 60;
    return 0;
  }
  const n = parseFloat(s.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

async function recalcularConsumoClienteDesdeTarea(tarea: Record<string, string>, tenant: string): Promise<void> {
  // 1) Localizar al cliente afectado. La tarea suele tener el campo
  //    `cliente` heredado desde proyecto.cliente (cascada TEST-18 bis 4).
  //    Si está vacío, intentamos resolver desde el proyecto.
  let clienteRef = String(tarea.cliente || "").trim();
  if (!clienteRef) {
    const proyectoRef = String(tarea.proyecto || "").trim();
    if (!proyectoRef) return;
    const proyectos = await listModuleRecordsAsync("proyectos", tenant);
    const proy = (Array.isArray(proyectos) ? proyectos : []).find((p) => {
      const r = p as Record<string, string>;
      return String(r.nombre || "") === proyectoRef || String(r.id || "") === proyectoRef;
    }) as Record<string, string> | undefined;
    if (!proy) return;
    clienteRef = String(proy.cliente || "");
  }
  if (!clienteRef) return;

  // 2) Cargar todas las tareas + proyectos del tenant. Sumamos
  //    `tiempoHoras` solo de aquellas tareas cuyo proyecto exista y
  //    tenga `facturable === "si"`.
  const [tareas, proyectos] = await Promise.all([
    listModuleRecordsAsync("actividades", tenant),
    listModuleRecordsAsync("proyectos", tenant),
  ]);
  const proyectoFacturablePorRef = new Map<string, boolean>();
  for (const p of (Array.isArray(proyectos) ? proyectos : []) as Array<Record<string, string>>) {
    const facturable = String(p.facturable || "").toLowerCase() === "si";
    if (p.nombre) proyectoFacturablePorRef.set(String(p.nombre), facturable);
    if (p.id) proyectoFacturablePorRef.set(String(p.id), facturable);
  }
  let consumo = 0;
  for (const t of (Array.isArray(tareas) ? tareas : []) as Array<Record<string, string>>) {
    if (String(t.cliente || "") !== clienteRef) continue;
    const proyRef = String(t.proyecto || "");
    if (!proyectoFacturablePorRef.get(proyRef)) continue;
    consumo += parseHorasNumber(t.tiempoHoras || t.horas);
  }

  // 3) Localizar al cliente y guardar `consumoHoras` con 2 decimales y
  //    separador coma (formato español, coherente con `tiempoHoras`).
  const clientes = await listModuleRecordsAsync("clientes", tenant);
  const cli = (Array.isArray(clientes) ? clientes : []).find((c) => {
    const r = c as Record<string, string>;
    return String(r.nombre || "") === clienteRef || String(r.id || "") === clienteRef;
  }) as Record<string, string> | undefined;
  if (!cli) return;
  const next = consumo.toFixed(2).replace(".", ",");
  if (String(cli.consumoHoras || "") === next) return; // sin cambios
  await updateModuleRecordAsync("clientes", String(cli.id || ""), { ...cli, consumoHoras: next }, tenant);
}

// TEST-20 F.3 bis — Recalcula `cliente.facturadoHoras` sumando el
// importe de todas las Facturas del cliente. Guardamos en € con 2
// decimales y coma. El nombre del campo conserva "Horas" por simetría
// con `consumoHoras`, pero contiene un importe (Pedro tiene Unidad
// para diferenciar h vs €; aquí mostramos siempre el agregado de €
// cobrados, que es el dato útil para Cuenta de cliente).
async function recalcularFacturadoCliente(clienteRef: string, tenant: string): Promise<void> {
  if (!clienteRef) return;
  const facturas = await listModuleRecordsAsync("facturacion", tenant);
  let total = 0;
  for (const f of (Array.isArray(facturas) ? facturas : []) as Array<Record<string, string>>) {
    if (String(f.cliente || "") !== clienteRef) continue;
    const estado = String(f.estado || "").toLowerCase();
    if (estado === "anulada") continue;
    total += parseHorasNumber(f.importe);
  }
  const clientes = await listModuleRecordsAsync("clientes", tenant);
  const cli = (Array.isArray(clientes) ? clientes : []).find((c) => {
    const r = c as Record<string, string>;
    return String(r.nombre || "") === clienteRef || String(r.id || "") === clienteRef;
  }) as Record<string, string> | undefined;
  if (!cli) return;
  const next = total.toFixed(2).replace(".", ",");
  if (String(cli.facturadoHoras || "") === next) return;
  await updateModuleRecordAsync("clientes", String(cli.id || ""), { ...cli, facturadoHoras: next }, tenant);
}