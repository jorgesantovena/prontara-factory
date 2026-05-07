/**
 * Motor de cálculo de calificaciones (SCHOOL-05).
 *
 * Específico del vertical colegio: cruza el módulo "calificaciones"
 * (notas brutas) con peso por evaluación y devuelve el promedio
 * ponderado por (alumno, asignatura, periodo).
 *
 * Reglas:
 *   - Una calificación cuenta si tiene `nota` numérica y `peso` numérico.
 *     Si peso falta o es 0, se usa peso 1 (todas iguales).
 *   - Promedio = sum(nota_i * peso_i) / sum(peso_i)
 *   - Estado derivado: aprobado (>=5), suspenso (<5), notable (>=7),
 *     sobresaliente (>=9).
 *
 * No persiste nada — solo agrega y devuelve.
 */
import { listModuleRecordsAsync } from "@/lib/persistence/active-client-data-store-async";

export type CalificacionPromedio = {
  alumno: string;
  asignatura: string;
  periodo: string;
  promedio: number;
  numeroNotas: number;
  estado: "sobresaliente" | "notable" | "aprobado" | "suspenso";
};

export type BoletinAlumno = {
  alumno: string;
  curso: string;
  periodo: string;
  asignaturas: Array<{
    asignatura: string;
    promedio: number;
    estado: CalificacionPromedio["estado"];
    numeroNotas: number;
  }>;
  promedioGeneral: number;
  asignaturasAprobadas: number;
  asignaturasSuspensas: number;
};

function parseNumber(value: string | undefined, fallback = 0): number {
  if (value == null || value === "") return fallback;
  const m = String(value).match(/-?\d+(?:[.,]\d+)?/);
  if (!m) return fallback;
  const n = parseFloat(m[0].replace(",", "."));
  return Number.isFinite(n) ? n : fallback;
}

function estadoFor(promedio: number): CalificacionPromedio["estado"] {
  if (promedio >= 9) return "sobresaliente";
  if (promedio >= 7) return "notable";
  if (promedio >= 5) return "aprobado";
  return "suspenso";
}

export async function getPromediosPorAlumnoAsignaturaAsync(
  clientId: string,
  filtros?: { alumno?: string; periodo?: string },
): Promise<CalificacionPromedio[]> {
  const cid = String(clientId || "").trim();
  if (!cid) return [];
  const records = await listModuleRecordsAsync("calificaciones", cid).catch(
    () => [] as Array<Record<string, string>>,
  );

  const targetAlumno = filtros?.alumno?.trim().toLowerCase() || null;
  const targetPeriodo = filtros?.periodo?.trim() || null;

  // Agregar por (alumno, asignatura, periodo)
  type Bucket = { sumaPonderada: number; sumaPesos: number; count: number };
  const buckets = new Map<string, Bucket>();
  for (const r of records) {
    const alumno = String(r.alumno || "").trim();
    const asignatura = String(r.asignatura || "").trim();
    const periodo = String(r.periodo || "").trim();
    if (!alumno || !asignatura || !periodo) continue;
    if (targetAlumno && alumno.toLowerCase() !== targetAlumno) continue;
    if (targetPeriodo && periodo !== targetPeriodo) continue;
    const nota = parseNumber(r.nota, NaN);
    if (!Number.isFinite(nota)) continue;
    const peso = parseNumber(r.peso, 1) || 1;
    const key = alumno + "|" + asignatura + "|" + periodo;
    const b = buckets.get(key) || { sumaPonderada: 0, sumaPesos: 0, count: 0 };
    b.sumaPonderada += nota * peso;
    b.sumaPesos += peso;
    b.count += 1;
    buckets.set(key, b);
  }

  const out: CalificacionPromedio[] = [];
  for (const [key, b] of buckets) {
    if (b.sumaPesos === 0) continue;
    const [alumno, asignatura, periodo] = key.split("|");
    const promedio = Math.round((b.sumaPonderada / b.sumaPesos) * 100) / 100;
    out.push({
      alumno,
      asignatura,
      periodo,
      promedio,
      numeroNotas: b.count,
      estado: estadoFor(promedio),
    });
  }
  // Orden: alumno, asignatura
  out.sort((a, b) => a.alumno.localeCompare(b.alumno) || a.asignatura.localeCompare(b.asignatura));
  return out;
}

/**
 * Construye el boletín de un alumno en un periodo concreto: todas sus
 * asignaturas con promedio ponderado + estadística general.
 */
export async function getBoletinAlumnoAsync(
  clientId: string,
  alumno: string,
  periodo: string,
): Promise<BoletinAlumno | null> {
  const promedios = await getPromediosPorAlumnoAsignaturaAsync(clientId, {
    alumno,
    periodo,
  });
  if (promedios.length === 0) return null;

  // Resolvemos el curso desde el módulo clientes (si está disponible).
  const clientes = await listModuleRecordsAsync("clientes", clientId).catch(
    () => [] as Array<Record<string, string>>,
  );
  const alumnoRecord = clientes.find(
    (c) => String(c.nombre || "").trim() === alumno.trim(),
  );
  const curso = String(alumnoRecord?.curso || "").trim() || "—";

  const asignaturas = promedios.map((p) => ({
    asignatura: p.asignatura,
    promedio: p.promedio,
    estado: p.estado,
    numeroNotas: p.numeroNotas,
  }));
  const sumaPromedios = asignaturas.reduce((acc, a) => acc + a.promedio, 0);
  const promedioGeneral =
    asignaturas.length > 0
      ? Math.round((sumaPromedios / asignaturas.length) * 100) / 100
      : 0;
  const aprobadas = asignaturas.filter((a) => a.promedio >= 5).length;
  const suspensas = asignaturas.length - aprobadas;

  return {
    alumno,
    curso,
    periodo,
    asignaturas,
    promedioGeneral,
    asignaturasAprobadas: aprobadas,
    asignaturasSuspensas: suspensas,
  };
}
