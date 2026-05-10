import { NextResponse, type NextRequest } from "next/server";
import { requireTenantSession } from "@/lib/saas/auth-session";
import { listModuleRecordsAsync } from "@/lib/persistence/active-client-data-store-async";
import { captureError } from "@/lib/observability/error-capture";

/**
 * GET /api/erp/estadistica-ventas (H8-C8)
 *
 * Querystring:
 *   periodo=YYYY-MM (mensual) o YYYY (anual)
 *   groupBy=cliente | zona | agente | grupo (default cliente)
 *
 * Devuelve agregados de facturación con desglose por la dimensión
 * pedida + ranking ABC (top 80% / siguiente 15% / cola 5%).
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function parseImporte(s: unknown): number {
  if (typeof s === "number") return s;
  const v = parseFloat(String(s ?? "0").replace(/[^\d,.-]/g, "").replace(",", "."));
  return Number.isFinite(v) ? v : 0;
}

export async function GET(request: NextRequest) {
  try {
    const session = requireTenantSession(request);
    if (!session) return NextResponse.json({ ok: false, error: "Sesión inválida." }, { status: 401 });

    const sp = request.nextUrl.searchParams;
    const periodo = String(sp.get("periodo") || new Date().toISOString().slice(0, 7));
    const groupBy = String(sp.get("groupBy") || "cliente");

    const [facturas, clientes, zonas] = await Promise.all([
      listModuleRecordsAsync("facturacion", session.clientId),
      listModuleRecordsAsync("clientes", session.clientId).catch(() => []),
      listModuleRecordsAsync("zonas-comerciales", session.clientId).catch(() => []),
    ]);

    // Mapas auxiliares para resolver dimensiones
    const zonaPorCliente = new Map<string, string>();
    const grupoPorCliente = new Map<string, string>();
    const agentePorCliente = new Map<string, string>();
    for (const c of clientes) {
      const nombre = String(c.nombre || c.empresa || "");
      if (c.zona) zonaPorCliente.set(nombre, String(c.zona));
      if (c.grupo) grupoPorCliente.set(nombre, String(c.grupo));
      if (c.agente) agentePorCliente.set(nombre, String(c.agente));
    }
    const agentePorZona = new Map<string, string>();
    for (const z of zonas) {
      if (z.nombre && z.agenteResponsable) agentePorZona.set(String(z.nombre), String(z.agenteResponsable));
    }

    // Filtrar facturas del periodo + estado cobrada/emitida
    const periodoLen = periodo.length; // 7 = mensual, 4 = anual
    const filtered = facturas.filter((f) => {
      const fe = String(f.fechaEmision || f.fecha || "").slice(0, periodoLen);
      const estado = String(f.estado || "");
      return fe === periodo && estado !== "anulada" && estado !== "borrador";
    });

    // Agrupar
    const buckets = new Map<string, { dimension: string; importe: number; facturas: number }>();
    for (const f of filtered) {
      const cliente = String(f.cliente || "");
      let dim = cliente;
      if (groupBy === "zona") dim = zonaPorCliente.get(cliente) || "(sin zona)";
      else if (groupBy === "agente") {
        const z = zonaPorCliente.get(cliente) || "";
        dim = agentePorZona.get(z) || agentePorCliente.get(cliente) || "(sin agente)";
      } else if (groupBy === "grupo") dim = grupoPorCliente.get(cliente) || "(sin grupo)";
      const importe = parseImporte(f.importe);
      const cur = buckets.get(dim) || { dimension: dim, importe: 0, facturas: 0 };
      cur.importe += importe;
      cur.facturas += 1;
      buckets.set(dim, cur);
    }

    const sorted = Array.from(buckets.values()).sort((a, b) => b.importe - a.importe);
    const total = sorted.reduce((s, b) => s + b.importe, 0);

    // Clasificación ABC (Pareto)
    let acumulado = 0;
    const conAbc = sorted.map((b) => {
      acumulado += b.importe;
      const pctAcumulado = total > 0 ? (acumulado / total) * 100 : 0;
      const clase = pctAcumulado <= 80 ? "A" : pctAcumulado <= 95 ? "B" : "C";
      return {
        dimension: b.dimension,
        importe: Math.round(b.importe * 100) / 100,
        facturas: b.facturas,
        pctTotal: total > 0 ? Math.round((b.importe / total) * 1000) / 10 : 0,
        clase,
      };
    });

    return NextResponse.json({
      ok: true,
      periodo,
      groupBy,
      total: Math.round(total * 100) / 100,
      facturasComputadas: filtered.length,
      lineas: conAbc,
      abc: {
        A: conAbc.filter((l) => l.clase === "A").length,
        B: conAbc.filter((l) => l.clase === "B").length,
        C: conAbc.filter((l) => l.clase === "C").length,
      },
    });
  } catch (e) {
    captureError(e, { scope: "/api/erp/estadistica-ventas" });
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}
