import { NextRequest, NextResponse } from "next/server";
import { requireTenantSession } from "@/lib/saas/auth-session";
import { withPrisma } from "@/lib/persistence/db";
import { listModuleRecordsAsync } from "@/lib/persistence/active-client-data-store-async";
import { captureError } from "@/lib/observability/error-capture";

/**
 * /api/runtime/sf/daily-activity (H15-C #11)
 *
 * GET                                  → estado del usuario actual hoy + config
 * GET ?team=1                          → estado de todo el equipo hoy (managers)
 * PATCH (admin) { requireDaily, minHoursPerDay, cutoffTimeHHMM, workdays, reminderEmail }
 *                                       → actualiza config del tenant
 *
 * El "estado del usuario actual" calcula al vuelo sumando las horas
 * imputadas hoy en `actividades` y compara contra minHoursPerDay.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Config = {
  requireDaily: boolean;
  minHoursPerDay: number;
  cutoffTimeHHMM: string;
  workdays: number[];
  reminderEmail: boolean;
};

const DEFAULT_CONFIG: Config = {
  requireDaily: false,
  minHoursPerDay: 7,
  cutoffTimeHHMM: "10:00",
  workdays: [1, 2, 3, 4, 5],
  reminderEmail: true,
};

function parseImporte(v: unknown): number {
  const n = parseFloat(String(v ?? "0").replace(/[^\d,.-]/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

async function loadConfig(clientId: string): Promise<Config> {
  const result = await withPrisma(async (prisma) => {
    const c = prisma as unknown as {
      dailyActivityRequirement: { findUnique: (a: { where: { clientId: string } }) => Promise<Config | null> };
    };
    const cfg = await c.dailyActivityRequirement.findUnique({ where: { clientId } });
    return cfg || DEFAULT_CONFIG;
  }).catch(() => DEFAULT_CONFIG);
  return result || DEFAULT_CONFIG;
}

export async function GET(request: NextRequest) {
  try {
    const session = requireTenantSession(request);
    if (!session) return NextResponse.json({ ok: false, error: "Sesión inválida." }, { status: 401 });

    const config = await loadConfig(session.clientId);
    const today = new Date().toISOString().slice(0, 10);
    const isTeamView = request.nextUrl.searchParams.get("team") === "1";

    const actividades = (await listModuleRecordsAsync("actividades", session.clientId)) as Array<Record<string, string>>;
    const empleados = (await listModuleRecordsAsync("empleados", session.clientId)) as Array<Record<string, string>>;

    if (isTeamView) {
      // Estado de todo el equipo
      type Row = { persona: string; email: string; horasHoy: number; completado: boolean };
      const byPerson = new Map<string, Row>();
      for (const e of empleados) {
        const enBaja = String(e.estado || "").toLowerCase() === "baja";
        if (enBaja) continue;
        const nombre = String(e.nombre || "").trim();
        const email = String(e.email || "").trim().toLowerCase();
        if (!nombre) continue;
        byPerson.set(nombre, { persona: nombre, email, horasHoy: 0, completado: false });
      }
      for (const a of actividades) {
        if (String(a.fecha || "").slice(0, 10) !== today) continue;
        const persona = String(a.persona || a.empleado || "").trim();
        if (!persona) continue;
        const row = byPerson.get(persona);
        if (row) row.horasHoy += parseImporte(a.horas);
      }
      for (const r of byPerson.values()) {
        r.completado = r.horasHoy >= config.minHoursPerDay;
      }
      return NextResponse.json({
        ok: true,
        config,
        today,
        team: Array.from(byPerson.values()).sort((a, b) => a.horasHoy - b.horasHoy),
      });
    }

    // Estado del usuario actual
    const userName = session.fullName || session.email.split("@")[0];
    const horasHoy = actividades
      .filter((a) => String(a.fecha || "").slice(0, 10) === today)
      .filter((a) => {
        const persona = String(a.persona || a.empleado || "").toLowerCase();
        return persona === userName.toLowerCase() || persona === session.email.toLowerCase();
      })
      .reduce((s, a) => s + parseImporte(a.horas), 0);

    const dayOfWeek = ((new Date().getDay() + 6) % 7) + 1; // 1=lunes ... 7=domingo
    const isWorkday = config.workdays.includes(dayOfWeek);

    return NextResponse.json({
      ok: true,
      config,
      today,
      isWorkday,
      myStatus: {
        horasHoy: Math.round(horasHoy * 100) / 100,
        horasRequeridas: config.minHoursPerDay,
        completado: horasHoy >= config.minHoursPerDay,
        faltan: Math.max(0, config.minHoursPerDay - horasHoy),
      },
    });
  } catch (e) {
    captureError(e, { scope: "/sf/daily-activity GET" });
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = requireTenantSession(request);
    if (!session) return NextResponse.json({ ok: false, error: "Sesión inválida." }, { status: 401 });
    if (session.role !== "admin" && session.role !== "owner") {
      return NextResponse.json({ ok: false, error: "Solo admin u owner." }, { status: 403 });
    }

    const body = await request.json();
    const data: Record<string, unknown> = {};
    if (typeof body?.requireDaily === "boolean") data.requireDaily = body.requireDaily;
    if (body?.minHoursPerDay !== undefined) data.minHoursPerDay = parseFloat(String(body.minHoursPerDay));
    if (body?.cutoffTimeHHMM) data.cutoffTimeHHMM = String(body.cutoffTimeHHMM);
    if (Array.isArray(body?.workdays)) data.workdays = body.workdays.map((d: unknown) => parseInt(String(d), 10)).filter((d: number) => d >= 1 && d <= 7);
    if (typeof body?.reminderEmail === "boolean") data.reminderEmail = body.reminderEmail;

    const config = await withPrisma(async (prisma) => {
      const c = prisma as unknown as {
        dailyActivityRequirement: {
          upsert: (a: { where: { clientId: string }; create: Record<string, unknown>; update: Record<string, unknown> }) => Promise<Config>;
        };
      };
      return await c.dailyActivityRequirement.upsert({
        where: { clientId: session.clientId },
        create: { tenantId: session.tenantId, clientId: session.clientId, ...data },
        update: data,
      });
    });

    return NextResponse.json({ ok: true, config });
  } catch (e) {
    captureError(e, { scope: "/sf/daily-activity PATCH" });
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}
