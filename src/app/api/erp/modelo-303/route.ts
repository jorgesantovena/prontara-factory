import { NextResponse, type NextRequest } from "next/server";
import { requireTenantSession } from "@/lib/saas/auth-session";
import { listModuleRecordsAsync } from "@/lib/persistence/active-client-data-store-async";
import { captureError } from "@/lib/observability/error-capture";

/**
 * GET /api/erp/modelo-303?ejercicio=2026&trimestre=Q1 (H6-CONTAB-303)
 *
 * Calcula el modelo 303 IVA del trimestre indicado y devuelve:
 *   - resumen: { ivaRepercutido, ivaSoportado, aIngresar, aCompensar }
 *   - desglose por tipo (4%, 10%, 21%)
 *   - lista de facturas emitidas y recibidas computadas
 *   - PDF generable con casillas pre-rellenadas
 *
 * Nota: la presentación REAL en AEAT requiere certificado y firma —
 * usar /api/runtime/verifactu/sign-and-send para eso. Este endpoint es
 * el cálculo + ayuda al usuario para presentar manualmente o entregar
 * a su gestoría.
 *
 * Asume que las facturas tienen campos: importe (con o sin IVA),
 * tipoIva (4 / 10 / 21), fechaEmision (YYYY-MM-DD).
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TRIMESTRES: Record<string, [number, number]> = {
  "Q1": [0, 2],
  "Q2": [3, 5],
  "Q3": [6, 8],
  "Q4": [9, 11],
};

function parseImporte(s: string): number {
  if (!s) return 0;
  const cleaned = String(s).replace(/[^\d,.-]/g, "").replace(",", ".");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function tipoIvaFromValue(v: unknown): number {
  const s = String(v || "").trim();
  if (s.includes("4")) return 4;
  if (s.includes("10")) return 10;
  if (s.includes("21")) return 21;
  if (s.includes("0")) return 0;
  return 21; // default
}

export async function GET(request: NextRequest) {
  try {
    const session = requireTenantSession(request);
    if (!session) return NextResponse.json({ ok: false, error: "Sesión inválida." }, { status: 401 });

    const sp = request.nextUrl.searchParams;
    const ejercicio = Number(sp.get("ejercicio")) || new Date().getFullYear();
    const trimestre = String(sp.get("trimestre") || "Q1").toUpperCase();
    if (!TRIMESTRES[trimestre]) {
      return NextResponse.json({ ok: false, error: "trimestre debe ser Q1/Q2/Q3/Q4." }, { status: 400 });
    }

    const [mesIni, mesFin] = TRIMESTRES[trimestre];
    const desde = new Date(ejercicio, mesIni, 1);
    const hasta = new Date(ejercicio, mesFin + 1, 0);
    const desdeStr = desde.toISOString().slice(0, 10);
    const hastaStr = hasta.toISOString().slice(0, 10);

    const [emitidas, recibidas] = await Promise.all([
      listModuleRecordsAsync("facturacion", session.clientId),
      listModuleRecordsAsync("compras", session.clientId).catch(() => []),
    ]);

    type Linea = { numero: string; fecha: string; base: number; tipoIva: number; cuota: number };

    function compute(rows: Array<Record<string, unknown>>, isEmitida: boolean): { lineas: Linea[]; totalBase: Record<string, number>; totalCuota: Record<string, number> } {
      const lineas: Linea[] = [];
      const totalBase: Record<string, number> = { "4": 0, "10": 0, "21": 0 };
      const totalCuota: Record<string, number> = { "4": 0, "10": 0, "21": 0 };
      for (const r of rows) {
        const fecha = String(r.fechaEmision || r.fecha || "").slice(0, 10);
        if (fecha < desdeStr || fecha > hastaStr) continue;
        if (isEmitida) {
          const estado = String(r.estado || "");
          if (estado === "anulada" || estado === "borrador") continue;
        }
        const importeTotal = parseImporte(String(r.importe || ""));
        const tipoIva = tipoIvaFromValue(r.tipoIva);
        // Si el importe es total con IVA → desglosamos
        // Si tiene baseImponible explícita, la usamos
        const baseExplicita = parseImporte(String(r.baseImponible || ""));
        const base = baseExplicita > 0 ? baseExplicita : importeTotal / (1 + tipoIva / 100);
        const cuota = importeTotal - base;
        lineas.push({ numero: String(r.numero || r.id || ""), fecha, base, tipoIva, cuota });
        const k = String(tipoIva);
        if (totalBase[k] !== undefined) {
          totalBase[k] += base;
          totalCuota[k] += cuota;
        }
      }
      return { lineas, totalBase, totalCuota };
    }

    const out = compute(emitidas, true);
    const inn = compute(recibidas, false);

    const ivaRepercutido = Object.values(out.totalCuota).reduce((a, b) => a + b, 0);
    const ivaSoportado = Object.values(inn.totalCuota).reduce((a, b) => a + b, 0);
    const resultado = ivaRepercutido - ivaSoportado;

    // Casillas modelo 303 (las más usadas)
    const casillas = {
      "01-base-21": Math.round(out.totalBase["21"] * 100) / 100,
      "03-cuota-21": Math.round(out.totalCuota["21"] * 100) / 100,
      "04-base-10": Math.round(out.totalBase["10"] * 100) / 100,
      "06-cuota-10": Math.round(out.totalCuota["10"] * 100) / 100,
      "07-base-4": Math.round(out.totalBase["4"] * 100) / 100,
      "09-cuota-4": Math.round(out.totalCuota["4"] * 100) / 100,
      "27-iva-devengado": Math.round(ivaRepercutido * 100) / 100,
      "28-iva-deducible-corrientes": Math.round(ivaSoportado * 100) / 100,
      "46-resultado-regimen-general": Math.round(resultado * 100) / 100,
      "69-resultado": Math.round(resultado * 100) / 100,
      "71-a-ingresar-o-devolver": Math.round(resultado * 100) / 100,
    };

    return NextResponse.json({
      ok: true,
      ejercicio,
      trimestre,
      periodo: { desde: desdeStr, hasta: hastaStr },
      resumen: {
        ivaRepercutido: Math.round(ivaRepercutido * 100) / 100,
        ivaSoportado: Math.round(ivaSoportado * 100) / 100,
        resultado: Math.round(resultado * 100) / 100,
        accion: resultado > 0 ? "ingresar" : resultado < 0 ? "compensar/devolver" : "neutro",
      },
      casillas,
      desgloseEmitidas: out,
      desgloseRecibidas: inn,
      facturasComputadas: out.lineas.length + inn.lineas.length,
    });
  } catch (e) {
    captureError(e, { scope: "/api/erp/modelo-303" });
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}
