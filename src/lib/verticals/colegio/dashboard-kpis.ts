/**
 * KPIs y agregaciones del vertical colegio (SCHOOL-06).
 *
 * Helper que calcula:
 *   - Total alumnos matriculados.
 *   - Total cursos abiertos.
 *   - % asistencia del centro en los últimos 7 días.
 *   - Recibos vencidos pendientes (count).
 *   - Becas activas.
 *   - Mantenimiento pendiente (issues abiertas + en curso).
 *
 * Lo consume el endpoint dashboard runtime cuando businessType=colegio.
 */
import { listModuleRecordsAsync } from "@/lib/persistence/active-client-data-store-async";

export type ColegioKpis = {
  alumnosMatriculados: number;
  cursosAbiertos: number;
  asistencia7DiasPct: number;
  recibosVencidos: number;
  becasActivas: number;
  mantenimientoPendiente: number;
};

export type AsistenciaResumen = {
  alumno: string;
  curso: string;
  presentes: number;
  ausentes: number;
  tardanzas: number;
  justificadas: number;
  total: number;
  porcentajePresencia: number;
};

function isWithinLastDays(iso: string, days: number, today = new Date()): boolean {
  if (!iso) return false;
  const ts = new Date(iso + "T00:00:00Z").getTime();
  if (!Number.isFinite(ts)) return false;
  const limit = today.getTime() - days * 24 * 60 * 60 * 1000;
  return ts >= limit && ts <= today.getTime();
}

export async function getColegioKpisAsync(clientId: string): Promise<ColegioKpis> {
  const cid = String(clientId || "").trim();
  if (!cid) {
    return {
      alumnosMatriculados: 0,
      cursosAbiertos: 0,
      asistencia7DiasPct: 0,
      recibosVencidos: 0,
      becasActivas: 0,
      mantenimientoPendiente: 0,
    };
  }

  const [clientes, proyectos, asistencia, facturas, becas, mantenimiento] = await Promise.all([
    listModuleRecordsAsync("clientes", cid).catch(() => []),
    listModuleRecordsAsync("proyectos", cid).catch(() => []),
    listModuleRecordsAsync("asistencia", cid).catch(() => []),
    listModuleRecordsAsync("facturacion", cid).catch(() => []),
    listModuleRecordsAsync("becas", cid).catch(() => []),
    listModuleRecordsAsync("mantenimiento", cid).catch(() => []),
  ]);

  const alumnosMatriculados = clientes.filter(
    (c) =>
      String(c.tipo || "").toLowerCase() === "alumno" &&
      String(c.estado || "").toLowerCase() === "matriculado",
  ).length;

  const cursosAbiertos = proyectos.filter(
    (p) => String(p.estado || "").toLowerCase() === "abierto",
  ).length;

  const asistenciaUltimaSemana = asistencia.filter((a) =>
    isWithinLastDays(String(a.fecha || ""), 7),
  );
  const presentes = asistenciaUltimaSemana.filter(
    (a) => String(a.estado || "").toLowerCase() === "presente",
  ).length;
  const totalAsistencia = asistenciaUltimaSemana.length;
  const asistencia7DiasPct =
    totalAsistencia > 0 ? Math.round((presentes / totalAsistencia) * 100) : 0;

  const recibosVencidos = facturas.filter((f) => {
    const e = String(f.estado || "").toLowerCase();
    return e === "vencida" || e === "vencido" || e === "devuelto";
  }).length;

  const becasActivas = becas.filter(
    (b) => String(b.estado || "").toLowerCase() === "aprobada",
  ).length;

  const mantenimientoPendiente = mantenimiento.filter((m) => {
    const e = String(m.estado || "").toLowerCase();
    return e === "abierta" || e === "en_curso";
  }).length;

  return {
    alumnosMatriculados,
    cursosAbiertos,
    asistencia7DiasPct,
    recibosVencidos,
    becasActivas,
    mantenimientoPendiente,
  };
}

/**
 * Resumen de asistencia por alumno en un periodo (default últimos 30 días).
 */
export async function getAsistenciaResumenAsync(
  clientId: string,
  options?: { dias?: number; alumno?: string },
): Promise<AsistenciaResumen[]> {
  const cid = String(clientId || "").trim();
  if (!cid) return [];
  const dias = options?.dias ?? 30;
  const targetAlumno = options?.alumno?.trim().toLowerCase() || null;

  const records = await listModuleRecordsAsync("asistencia", cid).catch(() => []);
  type Bucket = {
    alumno: string;
    curso: string;
    presentes: number;
    ausentes: number;
    tardanzas: number;
    justificadas: number;
    total: number;
  };
  const buckets = new Map<string, Bucket>();

  for (const r of records) {
    if (!isWithinLastDays(String(r.fecha || ""), dias)) continue;
    const alumno = String(r.alumno || "").trim();
    if (!alumno) continue;
    if (targetAlumno && alumno.toLowerCase() !== targetAlumno) continue;
    const curso = String(r.curso || "").trim();
    const estado = String(r.estado || "").toLowerCase();
    const key = alumno;
    const b = buckets.get(key) || {
      alumno,
      curso,
      presentes: 0,
      ausentes: 0,
      tardanzas: 0,
      justificadas: 0,
      total: 0,
    };
    if (estado === "presente") b.presentes += 1;
    else if (estado === "ausente") b.ausentes += 1;
    else if (estado === "tarde") b.tardanzas += 1;
    else if (estado === "justificada") b.justificadas += 1;
    b.total += 1;
    buckets.set(key, b);
  }

  return Array.from(buckets.values())
    .map((b) => ({
      ...b,
      porcentajePresencia:
        b.total > 0 ? Math.round((b.presentes / b.total) * 100) : 0,
    }))
    .sort((a, b) => a.porcentajePresencia - b.porcentajePresencia);
}
