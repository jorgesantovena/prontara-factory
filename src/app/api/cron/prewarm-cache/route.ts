import { NextResponse, type NextRequest } from "next/server";
import { withPrisma, getPersistenceBackend } from "@/lib/persistence/db";
import { tenantConfigCache } from "@/lib/cache/memory-cache";
import { captureError } from "@/lib/observability/error-capture";

/**
 * GET /api/cron/prewarm-cache (H5-SCALE-01)
 *
 * Recorre los TOP_N tenants más activos (último uso) y precarga su
 * tenant-config en el cache LRU haciendo un fetch a la URL pública.
 *
 * Pensado para Vercel Cron diario (madrugada). Reduce p99 latency
 * de los primeros requests del día tras el lambda cold-start.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const TOP_N = 50;

export async function GET(request: NextRequest) {
  const secret = String(process.env.CRON_SECRET || "").trim();
  if (secret) {
    const auth = request.headers.get("authorization") || "";
    if (auth !== "Bearer " + secret) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
  }
  if (getPersistenceBackend() !== "postgres") {
    return NextResponse.json({ ok: false, error: "Postgres only" }, { status: 400 });
  }

  try {
    // Top N tenants por updatedAt más reciente — proxy de "más activos"
    const tenants = await withPrisma(async (prisma) => {
      const c = prisma as unknown as {
        tenant: {
          findMany: (a: { orderBy: { updatedAt: "desc" }; take: number; select: { clientId: true; slug: true } }) => Promise<Array<{ clientId: string; slug: string }>>;
        };
      };
      return await c.tenant.findMany({
        orderBy: { updatedAt: "desc" },
        take: TOP_N,
        select: { clientId: true, slug: true },
      });
    });

    const baseUrl = (process.env.PRONTARA_PUBLIC_BASE_URL || "http://localhost:3000").replace(/\/+$/, "");
    let warmed = 0;
    let failed = 0;

    // Pre-warming en paralelo con cap de concurrencia
    const concurrency = 5;
    let i = 0;
    async function worker() {
      while (i < (tenants?.length || 0)) {
        const t = tenants![i++];
        try {
          const r = await fetch(baseUrl + "/api/runtime/tenant-config?slug=" + encodeURIComponent(t.slug), { cache: "no-store" });
          if (r.ok) warmed += 1;
          else failed += 1;
        } catch {
          failed += 1;
        }
      }
    }
    await Promise.all(Array.from({ length: concurrency }, worker));

    return NextResponse.json({
      ok: true,
      tenantsAttempted: tenants?.length || 0,
      warmed,
      failed,
      cacheSize: tenantConfigCache.size(),
      at: new Date().toISOString(),
    });
  } catch (e) {
    captureError(e, { scope: "/api/cron/prewarm-cache" });
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}
