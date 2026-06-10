import { NextResponse, type NextRequest } from "next/server";
import { requireTenantSession } from "@/lib/saas/auth-session";
import { listModuleRecordsAsync } from "@/lib/persistence/active-client-data-store-async";
import {
  prefacturar,
  type Contrato,
  type Nivel,
  type LineaPrefactura,
} from "@/lib/verticals/software-factory/prefacturacion-engine";
import { captureError } from "@/lib/observability/error-capture";
import { ensureTest19Seed } from "@/lib/verticals/software-factory/ensure-test19-seed";

/**
 * GET /api/erp/prefacturacion?modelo=cuota|horas&periodo=mensual|trimestral|semestral|anual|discreto
 *
 * TEST 19 (Pedro) — Diálogo previo con dos parámetros (Modelo + Periodo).
 * Devuelve una línea por contrato que cumple los filtros:
 *   - Caso A (modelo=cuota): selecciona contratos con el periodo
 *     indicado. Importe = Bolsa × Precio del Nivel (Tipo+Subtipo+Cuota).
 *   - Caso B (modelo=horas): solo Tipo M, periodo Mensual.
 *     Importe = max(0, Consumo − Bolsa − Facturadas) × Precio del
 *     Nivel (M, Subtipo, Horas).
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function parseNum(v: unknown): number {
  if (typeof v === "number") return v;
  const s = String(v ?? "0").trim();
  const n = parseFloat(s.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export async function GET(request: NextRequest) {
  try {
    const session = requireTenantSession(request);
    if (!session) return NextResponse.json({ ok: false, error: "Sesión inválida." }, { status: 401 });

    const modeloRaw = String(request.nextUrl.searchParams.get("modelo") || "cuota").toLowerCase();
    const modelo: "cuota" | "horas" = modeloRaw === "horas" ? "horas" : "cuota";

    const periodoRaw = String(request.nextUrl.searchParams.get("periodo") || "mensual").toLowerCase();
    const PERIODOS = ["mensual", "trimestral", "semestral", "anual", "discreto"] as const;
    const periodo: typeof PERIODOS[number] = (PERIODOS as readonly string[]).includes(periodoRaw)
      ? (periodoRaw as typeof PERIODOS[number])
      : "mensual";

    let [contratosRaw, nivelesRaw] = await Promise.all([
      listModuleRecordsAsync("contratos", session.clientId),
      listModuleRecordsAsync("niveles", session.clientId),
    ]);

    // TEST 19 — Auto-seed self-healing: si el tenant aún no tiene Niveles
    // ni Contratos (tenant anterior a TEST 19), los sembramos aquí mismo
    // para que la Pre-facturación funcione aunque Pedro entre directo sin
    // pasar antes por las tablas. Idempotente.
    if (
      (contratosRaw as unknown[]).length === 0 &&
      (nivelesRaw as unknown[]).length === 0
    ) {
      try {
        await ensureTest19Seed(session.clientId);
        [contratosRaw, nivelesRaw] = await Promise.all([
          listModuleRecordsAsync("contratos", session.clientId),
          listModuleRecordsAsync("niveles", session.clientId),
        ]);
      } catch (e) {
        captureError(e, { scope: "/api/erp/prefacturacion → ensureTest19Seed" });
      }
    }

    const contratos: Contrato[] = (contratosRaw as Array<Record<string, string>>).map((c) => ({
      id: String(c.id || ""),
      codigo: String(c.codigo || c.numero || c.id || ""),
      cliente: String(c.cliente || ""),
      periodo: String(c.periodo || "mensual"),
      tipoNivel: String(c.tipoNivel || "M"),
      subtipo: String(c.subtipo || ""),
      consumo: parseNum(c.consumo),
      facturadas: parseNum(c.facturadas),
      referenciaPropuesta: String(c.referenciaPropuesta || ""),
      estado: String(c.estado || "activo"),
      fechaInicio: String(c.fechaInicio || ""),
      fechaFin: String(c.fechaFin || ""),
    }));

    const niveles: Nivel[] = (nivelesRaw as Array<Record<string, string>>).map((n) => ({
      tipoNivel: String(n.tipoNivel || ""),
      subtipo: String(n.subtipo || ""),
      modelo: String(n.modelo || "cuota"),
      bolsa: parseNum(n.bolsa),
      precio: parseNum(n.precio),
      descripcion: String(n.descripcion || ""),
    }));

    const lineas: LineaPrefactura[] = prefacturar(contratos, niveles, modelo, periodo);
    const totalImporte = lineas.reduce((s, l) => s + l.importe, 0);
    const totalHoras = lineas.reduce((s, l) => s + l.horasAFacturar, 0);

    return NextResponse.json({
      ok: true,
      modelo,
      periodo,
      lineas,
      totales: {
        contratos: lineas.length,
        clientes: new Set(lineas.map((l) => l.cliente)).size,
        horasAFacturar: Math.round(totalHoras * 100) / 100,
        importe: Math.round(totalImporte * 100) / 100,
      },
      contratosEvaluados: contratos.length,
      nivelesDisponibles: niveles.length,
    });
  } catch (e) {
    captureError(e, { scope: "/api/erp/prefacturacion" });
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}
