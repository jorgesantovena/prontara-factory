import { NextResponse, type NextRequest } from "next/server";
import { requireTenantSession } from "@/lib/saas/auth-session";
import { listModuleRecordsAsync } from "@/lib/persistence/active-client-data-store-async";
import {
  buildSepaDirectDebit,
  isValidIban,
  type SepaCobro,
  type SepaSecuencia,
  type SepaTipo,
} from "@/lib/saas/sepa-direct-debit";
import { resolveTenantEmisorAsync } from "@/lib/saas/tenant-emisor-resolver";
import { resolveRequestTenantRuntimeAsync } from "@/lib/saas/request-tenant-runtime-async";
import { captureError } from "@/lib/observability/error-capture";

/**
 * POST /api/erp/sepa-direct-debit (H8.5-SEPA)
 * Body: {
 *   remesaId: string,
 *   fechaCobro: string (YYYY-MM-DD),
 *   tipo: "CORE" | "B2B",
 *   secuencia: "FRST" | "RCUR" | "OOFF" | "FNAL",
 *   vencimientoIds: string[]   // IDs de vencimientos-factura a remesar
 * }
 *
 * Devuelve el XML pain.008.001.02 listo para subir al banco.
 *
 * Idempotente sólo respecto al fichero generado — si lo generas dos
 * veces y subes ambos, el banco cobrará dos veces. Cuídese.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function parseImporte(v: unknown): number {
  if (typeof v === "number") return v;
  const n = parseFloat(String(v ?? "0").replace(/[^\d,.-]/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export async function POST(request: NextRequest) {
  try {
    const session = requireTenantSession(request);
    if (!session) return new Response("Unauthorized", { status: 401 });

    const body = await request.json();
    const remesaId = String(body?.remesaId || "REM-" + Date.now()).trim();
    const fechaCobro = String(body?.fechaCobro || "").trim();
    const tipo = (String(body?.tipo || "CORE").toUpperCase() as SepaTipo);
    const secuencia = (String(body?.secuencia || "RCUR").toUpperCase() as SepaSecuencia);
    const vencimientoIds: string[] = Array.isArray(body?.vencimientoIds) ? body.vencimientoIds.map(String) : [];

    if (!fechaCobro || !/^\d{4}-\d{2}-\d{2}$/.test(fechaCobro)) {
      return NextResponse.json({ ok: false, error: "fechaCobro debe ser YYYY-MM-DD." }, { status: 400 });
    }
    if (vencimientoIds.length === 0) {
      return NextResponse.json({ ok: false, error: "Sin vencimientos seleccionados." }, { status: 400 });
    }

    // Resolver emisor + IBAN/BIC del propio tenant (vienen del módulo
    // ajustes con claves "iban" / "bic", igual que CIF).
    const runtime = await resolveRequestTenantRuntimeAsync(request);
    const emisor = await resolveTenantEmisorAsync({
      clientId: session.clientId,
      brandingDisplayName: runtime?.config?.branding?.displayName,
      brandingAccentColor: runtime?.config?.branding?.accentColor,
    });
    if (!emisor.cif || emisor.cif === "—") {
      return NextResponse.json({ ok: false, error: "Falta CIF del emisor en /ajustes." }, { status: 400 });
    }

    // Cargar vencimientos + facturas + cuentas bancarias + ajustes del tenant
    const [vencimientos, facturas, cuentas, ajustes] = await Promise.all([
      listModuleRecordsAsync("vencimientos-factura", session.clientId),
      listModuleRecordsAsync("facturacion", session.clientId),
      listModuleRecordsAsync("cuentas-bancarias", session.clientId),
      listModuleRecordsAsync("ajustes", session.clientId).catch(() => []),
    ]);

    // IBAN/BIC del emisor: del módulo ajustes (key=iban / key=bic)
    function findAjuste(key: string): string {
      const row = ajustes.find((a) => String(a.clave || a.key || "").toLowerCase() === key.toLowerCase());
      return row ? String(row.valor || row.value || "").trim() : "";
    }
    const emisorIban = findAjuste("iban");
    const emisorBic = findAjuste("bic");
    if (!emisorIban) {
      return NextResponse.json({ ok: false, error: "Falta IBAN del emisor en /ajustes (clave 'iban')." }, { status: 400 });
    }

    const facturasMap = new Map(facturas.map((f) => [String(f.id), f]));
    // Para cada cuenta bancaria, indexamos por cliente y esPrincipal
    const cuentaPorCliente = new Map<string, Record<string, unknown>>();
    for (const c of cuentas) {
      const cliente = String(c.cliente || c.titular || "");
      if (!cliente) continue;
      if (String(c.esPrincipal) === "si" || !cuentaPorCliente.has(cliente)) {
        cuentaPorCliente.set(cliente, c);
      }
    }

    const cobros: SepaCobro[] = [];
    const errores: string[] = [];

    for (const id of vencimientoIds) {
      const v = vencimientos.find((x) => String(x.id) === id);
      if (!v) { errores.push("Vencimiento " + id + " no encontrado."); continue; }
      if (String(v.estado) === "cobrado") { errores.push("Vencimiento " + id + " ya cobrado."); continue; }

      const facturaRef = String(v.factura || "");
      const factura = facturasMap.get(facturaRef);
      const clienteName = String(factura?.cliente || "");
      const cuenta = cuentaPorCliente.get(clienteName);
      if (!cuenta) {
        errores.push("Cliente '" + clienteName + "' sin cuenta bancaria registrada.");
        continue;
      }
      const iban = String(cuenta.iban || "");
      if (!isValidIban(iban)) {
        errores.push("IBAN inválido para " + clienteName + ": " + iban);
        continue;
      }

      cobros.push({
        deudor: clienteName,
        iban,
        bic: cuenta.bic ? String(cuenta.bic) : undefined,
        mandatoRef: String(cuenta.mandatoSepaRef || ("MAN-" + clienteName.slice(0, 10))).slice(0, 35),
        mandatoFecha: String(cuenta.mandatoSepaFecha || fechaCobro).slice(0, 10),
        importe: parseImporte(v.importe),
        concepto: "Factura " + (factura?.numero || facturaRef) + " - vto " + (v.nVencimiento || "1"),
        refInterna: id,
      });
    }

    if (cobros.length === 0) {
      return NextResponse.json({
        ok: false,
        error: "Sin cobros válidos para remesar.",
        errores,
      }, { status: 400 });
    }

    if (!isValidIban(emisorIban)) {
      return NextResponse.json({ ok: false, error: "IBAN del emisor inválido: " + emisorIban }, { status: 400 });
    }

    const xml = buildSepaDirectDebit({
      emisor: {
        nombre: emisor.razonSocial || "Emisor",
        nif: emisor.cif,
        iban: emisorIban,
        bic: emisorBic || undefined,
      },
      remesaId,
      fechaCobro,
      tipo,
      secuencia,
      cobros,
    });

    return new Response(xml, {
      status: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Content-Disposition": "attachment; filename=\"" + remesaId + ".xml\"",
        "X-Cobros-Incluidos": String(cobros.length),
        "X-Cobros-Rechazados": String(errores.length),
      },
    });
  } catch (e) {
    captureError(e, { scope: "/api/erp/sepa-direct-debit" });
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}
