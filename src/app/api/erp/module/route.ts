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
import { ensureTest19Seed } from "@/lib/verticals/software-factory/ensure-test19-seed";

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

    let rows = await listModuleRecordsAsync(moduleKey, session.clientId);

    // TEST 19 — Auto-seed self-healing. Si un tenant abre Niveles o
    // Contratos y están vacíos (tenant anterior a TEST 19, cuyos seeds del
    // pack solo se aplicaron al provisionar tenants nuevos), los sembramos
    // AQUÍ, en la misma petición que carga la página, y devolvemos ya con
    // datos. Es el punto más fiable: corre en el request exacto que dispara
    // el usuario (a diferencia de un seed en el render del layout, que en
    // producción no siempre se ejecuta/persiste). Idempotente. Gateado por
    // moduleKey porque `niveles`/`contratos` solo existen en software-factory.
    if (rows.length === 0 && (moduleKey === "niveles" || moduleKey === "contratos")) {
      try {
        await ensureTest19Seed(session.clientId);
        rows = await listModuleRecordsAsync(moduleKey, session.clientId);
      } catch (e) {
        captureError(e, { scope: "/api/erp/module GET → ensureTest19Seed" });
      }
    }

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
        // Facturación.pptx — Recalcular Facturado del Contrato (si la
        // factura referencia uno).
        try {
          await recalcularFacturadoContrato(String((created as Record<string, string>).contrato || ""), tenant);
        } catch (e) {
          captureError(e, { scope: "facturacion → recalcularFacturadoContrato" });
        }
      }
      // Facturación.pptx — Trigger post-create Tarea: recalcula
      // Consumo del Contrato heredado del proyecto. Tolerante a fallos
      // (proyecto/contrato no existentes → no-op).
      if (moduleKey === "actividades" && created?.id) {
        try {
          await recalcularConsumoContratoDesdeTarea(created as Record<string, string>, tenant);
        } catch (e) {
          captureError(e, { scope: "actividades → recalcularConsumoContrato" });
        }
        // Test 25 — Si la Tarea es un Desplazamiento, generar el registro
        // de Desplazamiento con los valores heredados.
        try {
          await crearDesplazamientoDesdeTarea(created as Record<string, string>, tenant);
        } catch (e) {
          captureError(e, { scope: "actividades → crearDesplazamiento" });
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
      // Facturación.pptx — Trigger post-edit Tarea: recalcula Consumo
      // del Contrato heredado del proyecto.
      if (moduleKey === "actividades" && updated) {
        try {
          await recalcularConsumoContratoDesdeTarea(updated as Record<string, string>, tenant);
        } catch (e) {
          captureError(e, { scope: "actividades edit → recalcularConsumoContrato" });
        }
      }
      // Facturación.pptx — Trigger post-edit Proyecto: si cambia el
      // flag facturable o el contrato del proyecto, los consumos del
      // contrato afectado pueden moverse. Disparamos un recalcular
      // basado en proyecto.contrato (si existe).
      if (moduleKey === "proyectos" && updated) {
        try {
          const proy = updated as Record<string, string>;
          const contratoRef = String(proy.contrato || "");
          if (contratoRef) {
            await recalcularConsumoContratoDirecto(contratoRef, tenant);
          }
        } catch (e) {
          captureError(e, { scope: "proyectos edit → recalcularConsumoContrato" });
        }
      }
      // Facturación.pptx — Trigger post-edit Factura: el importe o el
      // contrato puede haber cambiado.
      if (moduleKey === "facturacion" && updated) {
        try {
          await recalcularFacturadoContrato(String((updated as Record<string, string>).contrato || ""), tenant);
        } catch (e) {
          captureError(e, { scope: "facturacion edit → recalcularFacturadoContrato" });
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

      // Facturación.pptx / TEST 19 — Capturamos el registro ANTES de
      // borrar para recalcular después el consumo/facturadas del contrato
      // afectado. Sin esto, al borrar una tarea o una factura el acumulado
      // del contrato quedaba inflado para siempre y el Caso B sobre-
      // facturaba el exceso (consumo − bolsa − facturadas).
      let deletedRow: Record<string, string> | null = null;
      if (moduleKey === "actividades" || moduleKey === "facturacion" || moduleKey === "proyectos") {
        try {
          const rows = await listModuleRecordsAsync(moduleKey, tenant);
          deletedRow = ((Array.isArray(rows) ? rows : []) as Array<Record<string, string>>)
            .find((r) => String(r.id || "") === recordId) || null;
        } catch { /* tolerar */ }
      }

      await deleteModuleRecordAsync(moduleKey, recordId, tenant);

      if (deletedRow) {
        try {
          if (moduleKey === "actividades") {
            await recalcularConsumoContratoDesdeTarea(deletedRow, tenant);
          } else if (moduleKey === "facturacion") {
            await recalcularFacturadoContrato(String(deletedRow.contrato || ""), tenant);
          } else if (moduleKey === "proyectos") {
            await recalcularConsumoContratoDirecto(String(deletedRow.contrato || ""), tenant);
          }
        } catch (e) {
          captureError(e, { scope: "module delete → recalcular contrato" });
        }
      }
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

// Facturación.pptx (Pedro) — Helpers de recálculo a nivel de
// CONTRATO. El método de facturación (Cuota/Horas/Bono) y la bolsa
// viven en Contrato, así que el consumo y el facturado también se
// agregan ahí. La key del contrato puede venir como numero o id.
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

// Recalcula `contrato.consumo` desde una tarea (mira el contrato
// heredado en la tarea; si está vacío, sube por proyecto.contrato).
async function recalcularConsumoContratoDesdeTarea(tarea: Record<string, string>, tenant: string): Promise<void> {
  let contratoRef = String(tarea.contrato || "").trim();
  if (!contratoRef) {
    const proyectoRef = String(tarea.proyecto || "").trim();
    if (!proyectoRef) return;
    const proyectos = await listModuleRecordsAsync("proyectos", tenant);
    const proy = (Array.isArray(proyectos) ? proyectos : []).find((p) => {
      const r = p as Record<string, string>;
      return String(r.nombre || "") === proyectoRef || String(r.id || "") === proyectoRef;
    }) as Record<string, string> | undefined;
    if (!proy) return;
    contratoRef = String(proy.contrato || "");
  }
  if (!contratoRef) return;
  await recalcularConsumoContratoDirecto(contratoRef, tenant);
}

// TEST 19 (Pedro) — Recalcula `contrato.consumo` con horas del AÑO EN
// CURSO únicamente (reset automático cada 1 de enero). Solo cuenta
// tareas cuyo proyecto sea facturable=si.
async function recalcularConsumoContratoDirecto(contratoRef: string, tenant: string): Promise<void> {
  if (!contratoRef) return;
  const [tareas, proyectos, contratos] = await Promise.all([
    listModuleRecordsAsync("actividades", tenant),
    listModuleRecordsAsync("proyectos", tenant),
    listModuleRecordsAsync("contratos", tenant),
  ]);
  const anioActual = new Date().getFullYear();
  const proyectoFacturablePorRef = new Map<string, boolean>();
  const proyectoContratoPorRef = new Map<string, string>();
  for (const p of (Array.isArray(proyectos) ? proyectos : []) as Array<Record<string, string>>) {
    const facturable = String(p.facturable || "").toLowerCase() === "si";
    const c = String(p.contrato || "");
    if (p.nombre) { proyectoFacturablePorRef.set(String(p.nombre), facturable); proyectoContratoPorRef.set(String(p.nombre), c); }
    if (p.id)     { proyectoFacturablePorRef.set(String(p.id),     facturable); proyectoContratoPorRef.set(String(p.id),     c); }
  }
  let consumo = 0;
  for (const t of (Array.isArray(tareas) ? tareas : []) as Array<Record<string, string>>) {
    const proyRef = String(t.proyecto || "");
    const cRef = String(t.contrato || "") || proyectoContratoPorRef.get(proyRef) || "";
    if (cRef !== contratoRef) continue;
    if (!proyectoFacturablePorRef.get(proyRef)) continue;
    // Reset anual: descartar tareas de años anteriores.
    const anio = parseInt(String(t.fecha || "").slice(0, 4), 10);
    if (Number.isFinite(anio) && anio !== anioActual) continue;
    consumo += parseHorasNumber(t.tiempoHoras || t.horas);
  }
  const con = (Array.isArray(contratos) ? contratos : []).find((c) => {
    const r = c as Record<string, string>;
    return String(r.codigo || "") === contratoRef || String(r.numero || "") === contratoRef || String(r.id || "") === contratoRef;
  }) as Record<string, string> | undefined;
  if (!con) return;
  const next = consumo.toFixed(2).replace(".", ",");
  if (String(con.consumo || "") === next) return;
  await updateModuleRecordAsync("contratos", String(con.id || ""), { ...con, consumo: next }, tenant);
}

// TEST 19 (Pedro) — Recalcula `contrato.facturadas` con HORAS facturadas
// del año en curso. Una factura aporta sus horas (campo `horas` si
// existe; si no, deriva de importe/precio... pero el caso simple es
// sumar `horas` directos). Reset anual igual que consumo.
async function recalcularFacturadoContrato(contratoRef: string, tenant: string): Promise<void> {
  if (!contratoRef) return;
  const [facturas, contratos] = await Promise.all([
    listModuleRecordsAsync("facturacion", tenant),
    listModuleRecordsAsync("contratos", tenant),
  ]);
  const anioActual = new Date().getFullYear();
  let totalHoras = 0;
  for (const f of (Array.isArray(facturas) ? facturas : []) as Array<Record<string, string>>) {
    if (String(f.contrato || "") !== contratoRef) continue;
    if (String(f.estado || "").toLowerCase() === "anulada") continue;
    const fechaIso = String(f.fechaEmision || f.fecha || "");
    const anio = parseInt(fechaIso.slice(0, 4), 10);
    if (Number.isFinite(anio) && anio !== anioActual) continue;
    // Pedro: Facturadas se mide en HORAS. Si la factura tiene un campo
    // `horas`, lo sumamos. Si no, fallback a 0 (la factura aporta €
    // pero no horas — pendiente de definir si la factura debe llevar
    // horas explícitas siempre).
    totalHoras += parseHorasNumber(f.horas);
  }
  const con = (Array.isArray(contratos) ? contratos : []).find((c) => {
    const r = c as Record<string, string>;
    return String(r.codigo || "") === contratoRef || String(r.numero || "") === contratoRef || String(r.id || "") === contratoRef;
  }) as Record<string, string> | undefined;
  if (!con) return;
  const next = totalHoras.toFixed(2).replace(".", ",");
  if (String(con.facturadas || "") === next) return;
  await updateModuleRecordAsync("contratos", String(con.id || ""), { ...con, facturadas: next }, tenant);
}

// Test 25 — Trigger: al dar de alta una Tarea con Lugar = Desplazamiento,
// crea el registro de Desplazamiento heredando Tarea, Fecha, Empleado,
// Punto (cliente), Km (del cliente), Facturable, Estado=Borrador, Precio
// Venta (del Nivel Kilómetros del contrato del proyecto), Total Venta,
// Dieta (del empleado) y Total Dietas.
async function crearDesplazamientoDesdeTarea(tarea: Record<string, string>, tenant: string): Promise<void> {
  if (String(tarea.lugar || "").toLowerCase() !== "desplazamiento") return;
  const [clientes, empleados, proyectos, contratos, niveles] = await Promise.all([
    listModuleRecordsAsync("clientes", tenant),
    listModuleRecordsAsync("empleados", tenant),
    listModuleRecordsAsync("proyectos", tenant),
    listModuleRecordsAsync("contratos", tenant),
    listModuleRecordsAsync("niveles", tenant),
  ]);
  const arr = (x: unknown) => (Array.isArray(x) ? x : []) as Array<Record<string, string>>;
  const clienteName = String(tarea.cliente || "");
  const cli = arr(clientes).find((c) => String(c.nombre || "") === clienteName);
  const km = parseHorasNumber(cli?.kilometrosBase || "0");
  const empName = String(tarea.empleado || "");
  const emp = arr(empleados).find((e) => String(e.nombre || "") === empName);
  const dieta = parseHorasNumber(emp?.dieta || "0");
  // Nivel Kilómetros del Contrato del Proyecto de la Tarea.
  let contratoRef = String(tarea.contrato || "").trim();
  if (!contratoRef) {
    const proy = arr(proyectos).find((p) => String(p.nombre || "") === String(tarea.proyecto || "") || String(p.id || "") === String(tarea.proyecto || ""));
    contratoRef = String(proy?.contrato || "");
  }
  const con = arr(contratos).find((c) => String(c.codigo || "") === contratoRef || String(c.id || "") === contratoRef);
  let precioKm = 0;
  if (con) {
    const niv = arr(niveles).find((n) =>
      String(n.tipoNivel).toUpperCase() === String(con.tipoNivel).toUpperCase() &&
      String(n.subtipo) === String(con.subtipo) &&
      String(n.modelo).toLowerCase() === "kilometros");
    precioKm = parseHorasNumber(niv?.precio || "0");
  }
  const num = (n: number) => (Math.round(n * 100) / 100).toString();
  const base: Record<string, string> = {
    tarea: String(tarea.id || ""),
    fecha: String(tarea.fecha || ""),
    empleado: empName,
    puntoVenta: clienteName,
    kilometros: num(km),
    precioKm: num(precioKm),
    importeTotal: num(km * precioKm),
    dieta: num(dieta),
    totalDietas: num(km * dieta),
    facturable: String(tarea.facturable || ""),
    estado: "borrador",
  };
  // Test 26 — Cada Tarea con Lugar = Desplazamiento genera SIEMPRE dos
  // registros: Ida y Vuelta (mismo Km, importes y dietas por trayecto). La
  // Ida arranca a la Hora desde de la tarea; la Vuelta a la Hora hasta (fin
  // de la última tarea introducida). El usuario puede anular manualmente
  // cualquiera de los dos desde el listado de Desplazamientos.
  await createModuleRecordAsync("desplazamientos", {
    ...base, sentido: "ida", hora: String(tarea.horaDesde || ""),
  }, tenant);
  await createModuleRecordAsync("desplazamientos", {
    ...base, sentido: "vuelta", hora: String(tarea.horaHasta || ""),
  }, tenant);
}