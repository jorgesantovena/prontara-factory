import { NextRequest, NextResponse } from "next/server";
import { withPrisma } from "@/lib/persistence/db";
import { listModuleRecordsAsync } from "@/lib/persistence/active-client-data-store-async";
import { captureError } from "@/lib/observability/error-capture";

/**
 * GET /api/cron/daily-activity-check (H15-C #11)
 *
 * Cada día a las 18:00 (configurable via schedule en vercel.json):
 *   1. Para cada tenant con requireDaily=true:
 *   2. Para cada empleado activo:
 *   3. Suma horas imputadas hoy.
 *   4. Si < minHoursPerDay → crea EmployeeDailyLog con completed=false +
 *      crea TenantNotification "Te faltan X horas por imputar hoy".
 *
 * Schedule sugerido: "0 18 * * 1-5"
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function parseImporte(v: unknown): number {
  const n = parseFloat(String(v ?? "0").replace(/[^\d,.-]/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

type Config = {
  tenantId: string;
  clientId: string;
  requireDaily: boolean;
  minHoursPerDay: number;
  workdays: number[];
};

export async function GET(request: NextRequest) {
  const secret = String(process.env.CRON_SECRET || "").trim();
  const header = request.headers.get("X-CRON-SECRET") || request.nextUrl.searchParams.get("secret") || "";
  if (secret && header !== secret) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  try {
    const today = new Date();
    const todayISO = today.toISOString().slice(0, 10);
    const dayOfWeek = ((today.getDay() + 6) % 7) + 1; // 1=lunes ... 7=domingo

    const configsRaw = await withPrisma(async (prisma) => {
      const c = prisma as unknown as {
        dailyActivityRequirement: { findMany: (a: { where: { requireDaily: true } }) => Promise<Config[]> };
      };
      return await c.dailyActivityRequirement.findMany({ where: { requireDaily: true } });
    });
    const configs: Config[] = configsRaw || [];

    let totalEmployees = 0;
    let totalReminders = 0;
    let totalCompleted = 0;

    for (const cfg of configs) {
      if (!cfg.workdays.includes(dayOfWeek)) continue;

      const [actividades, empleados] = await Promise.all([
        listModuleRecordsAsync("actividades", cfg.clientId).catch(() => []),
        listModuleRecordsAsync("empleados", cfg.clientId).catch(() => []),
      ]);

      const empleadosActivos = (empleados as Array<Record<string, string>>).filter(
        (e) => String(e.estado || "").toLowerCase() !== "baja" && (e.email || "").includes("@"),
      );

      // Sumar horas por empleado hoy
      const horasByEmail = new Map<string, number>();
      for (const a of (actividades as Array<Record<string, string>>)) {
        if (String(a.fecha || "").slice(0, 10) !== todayISO) continue;
        const persona = String(a.persona || "").toLowerCase().trim();
        // Mapear nombre a email del empleado
        const emp = empleadosActivos.find((e) => String(e.nombre || "").toLowerCase().trim() === persona);
        if (!emp) continue;
        const email = String(emp.email).toLowerCase();
        horasByEmail.set(email, (horasByEmail.get(email) || 0) + parseImporte(a.horas));
      }

      for (const e of empleadosActivos) {
        totalEmployees++;
        const email = String(e.email).toLowerCase();
        const horas = horasByEmail.get(email) || 0;
        const completed = horas >= cfg.minHoursPerDay;
        if (completed) totalCompleted++;

        await withPrisma(async (prisma) => {
          const c = prisma as unknown as {
            employeeDailyLog: { upsert: (a: { where: { clientId_empleadoEmail_fecha: { clientId: string; empleadoEmail: string; fecha: Date } }; create: Record<string, unknown>; update: Record<string, unknown> }) => Promise<unknown> };
          };
          return await c.employeeDailyLog.upsert({
            where: { clientId_empleadoEmail_fecha: { clientId: cfg.clientId, empleadoEmail: email, fecha: today } },
            create: {
              tenantId: cfg.tenantId, clientId: cfg.clientId,
              empleadoEmail: email, fecha: today,
              horasImputadas: horas, horasRequeridas: cfg.minHoursPerDay, completed,
            },
            update: { horasImputadas: horas, completed, updatedAt: today },
          });
        }).catch(() => undefined);

        if (!completed) {
          // Crea notificación in-app (el banner del topbar la verá)
          try {
            await withPrisma(async (prisma) => {
              const c = prisma as unknown as { tenantNotification: { create: (a: { data: Record<string, unknown> }) => Promise<unknown> } };
              return await c.tenantNotification.create({
                data: {
                  tenantId: cfg.tenantId, clientId: cfg.clientId,
                  type: "daily-activity-missing",
                  severity: "warn",
                  title: "Te faltan " + (cfg.minHoursPerDay - horas).toFixed(1) + " h por imputar hoy",
                  message: "Tienes " + horas.toFixed(1) + " h de " + cfg.minHoursPerDay + " requeridas.",
                  recipientEmail: email,
                  metadata: { fecha: todayISO },
                },
              });
            });
            totalReminders++;
          } catch { /* notification table puede no existir aún */ }
        }
      }
    }

    return NextResponse.json({
      ok: true,
      tenantsScanned: configs.length,
      totalEmployees,
      totalCompleted,
      totalReminders,
      ranAt: new Date().toISOString(),
    });
  } catch (e) {
    captureError(e, { scope: "/cron/daily-activity-check" });
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}
