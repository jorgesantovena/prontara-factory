import { NextResponse, type NextRequest } from "next/server";
import { requireTenantSession } from "@/lib/saas/auth-session";
import { listModuleRecordsAsync } from "@/lib/persistence/active-client-data-store-async";

/**
 * GET /api/erp/global-search?q=X (CORE-04)
 *
 * Buscador global cross-módulos. Busca el string `q` en los principales
 * módulos del tenant (clientes, crm, proyectos, presupuestos,
 * facturacion, documentos, tareas, tickets, productos) y devuelve hits
 * agrupados por módulo, hasta 5 hits por módulo.
 *
 * Match: case-insensitive, en CUALQUIER campo string del registro.
 * Para datasets pequeños (< 10K registros por módulo) es suficiente.
 * Para escalar habría que indexar (Postgres FTS o similar) — out of
 * scope por ahora.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SEARCHABLE_MODULES = [
  "clientes",
  "crm",
  "proyectos",
  "presupuestos",
  "facturacion",
  "documentos",
  "tareas",
  "tickets",
  "productos",
];

const HITS_PER_MODULE = 5;

export async function GET(request: NextRequest) {
  try {
    const session = requireTenantSession(request);
    if (!session) {
      return NextResponse.json(
        { ok: false, error: "Sesión no válida." },
        { status: 401 },
      );
    }

    const q = String(request.nextUrl.searchParams.get("q") || "")
      .trim()
      .toLowerCase();
    if (!q || q.length < 2) {
      return NextResponse.json({ ok: true, q, results: {} });
    }

    const results: Record<
      string,
      Array<Record<string, string>>
    > = {};

    await Promise.all(
      SEARCHABLE_MODULES.map(async (mod) => {
        try {
          const records = await listModuleRecordsAsync(mod, session.clientId);
          const hits: Array<Record<string, string>> = [];
          for (const r of records) {
            const blob = Object.values(r || {})
              .map((v) => String(v ?? ""))
              .join(" ")
              .toLowerCase();
            if (blob.includes(q)) {
              hits.push(r);
              if (hits.length >= HITS_PER_MODULE) break;
            }
          }
          if (hits.length > 0) {
            results[mod] = hits;
          }
        } catch {
          // un módulo que falle no rompe el resto
        }
      }),
    );

    const totalHits = Object.values(results).reduce((acc, arr) => acc + arr.length, 0);

    return NextResponse.json({
      ok: true,
      q,
      totalHits,
      results,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Error en búsqueda.",
      },
      { status: 500 },
    );
  }
}
