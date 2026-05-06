/**
 * Lógica de caducidad de proyectos para el vertical Software Factory.
 *
 * Cada proyecto tiene un campo opcional `fechaCaducidad` (YYYY-MM-DD).
 * Sobre esa fecha se calculan estados derivados:
 *
 *   - `expirado`     → fechaCaducidad < hoy. El proyecto NO acepta nuevas
 *                       imputaciones de horas. Sigue visible para consulta
 *                       histórica. Si el proyecto ya está marcado como
 *                       `finalizado` en su estado declarado, prevalece ese.
 *   - `por_renovar`  → 0 ≤ fechaCaducidad - hoy ≤ 30 días.
 *                       Aviso al operador para renovar contrato.
 *   - `activo`       → fechaCaducidad - hoy > 30 días, o no hay fecha.
 *
 * Estos estados son DERIVADOS — no se persisten. Cada vez que se lee un
 * proyecto, se evalúa la caducidad sobre la fecha actual. Eso evita
 * tener un cron que muta filas, y cualquier corrección de fecha por parte
 * del operador refleja el cambio inmediatamente.
 *
 * Si el proyecto tiene un `estado` explícito como `finalizado`, `pausado`
 * o `cancelado`, ese gana frente al estado derivado por fechas.
 */

export type ProjectExpirationDerived =
  | "activo"
  | "por_renovar"
  | "expirado"
  | "finalizado"
  | "pausado";

const RENOVAR_THRESHOLD_DAYS = 30;

function parseDateUtc(iso: string): Date | null {
  if (!iso) return null;
  const m = String(iso).trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const year = parseInt(m[1], 10);
  const month = parseInt(m[2], 10) - 1;
  const day = parseInt(m[3], 10);
  return new Date(Date.UTC(year, month, day));
}

function startOfDayUtc(now = new Date()): Date {
  return new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
    ),
  );
}

function diffDays(a: Date, b: Date): number {
  const ms = a.getTime() - b.getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

export type ExpirationEvaluation = {
  derived: ProjectExpirationDerived;
  declaredEstado: string;
  fechaCaducidad: string | null;
  diasRestantes: number | null;
  /** True si el operador NO puede imputar nuevas horas a este proyecto. */
  bloquearImputacion: boolean;
};

/**
 * Evalúa el estado derivado de un proyecto a partir de su `estado` declarado
 * (string libre del proyecto: activo / pausado / finalizado / por_renovar /
 * expirado) y su `fechaCaducidad`. La fecha actual se inyecta para tests.
 */
export function evaluateProjectExpiration(
  project: { estado?: string; fechaCaducidad?: string },
  now = new Date(),
): ExpirationEvaluation {
  const declared = String(project.estado || "").trim().toLowerCase();
  const fechaCaducidad = String(project.fechaCaducidad || "").trim() || null;
  const today = startOfDayUtc(now);
  const exp = fechaCaducidad ? parseDateUtc(fechaCaducidad) : null;
  const diasRestantes = exp ? diffDays(exp, today) : null;

  // Estados declarados que tienen prioridad — no se sobrescriben con la
  // lógica de fechas, porque son decisiones explícitas del operador.
  if (declared === "finalizado") {
    return {
      derived: "finalizado",
      declaredEstado: declared,
      fechaCaducidad,
      diasRestantes,
      bloquearImputacion: true,
    };
  }
  if (declared === "pausado") {
    return {
      derived: "pausado",
      declaredEstado: declared,
      fechaCaducidad,
      diasRestantes,
      bloquearImputacion: true,
    };
  }

  // Si no hay fecha de caducidad, asumimos vigente indefinidamente.
  if (diasRestantes === null) {
    return {
      derived: "activo",
      declaredEstado: declared,
      fechaCaducidad,
      diasRestantes: null,
      bloquearImputacion: false,
    };
  }

  if (diasRestantes < 0) {
    return {
      derived: "expirado",
      declaredEstado: declared,
      fechaCaducidad,
      diasRestantes,
      bloquearImputacion: true,
    };
  }

  if (diasRestantes <= RENOVAR_THRESHOLD_DAYS) {
    return {
      derived: "por_renovar",
      declaredEstado: declared,
      fechaCaducidad,
      diasRestantes,
      bloquearImputacion: false,
    };
  }

  return {
    derived: "activo",
    declaredEstado: declared,
    fechaCaducidad,
    diasRestantes,
    bloquearImputacion: false,
  };
}

export type ProjectExpirationAlert = {
  proyecto: string;
  cliente: string;
  codigoTipo: string;
  fechaCaducidad: string;
  diasRestantes: number;
  estadoDerivado: ProjectExpirationDerived;
  severidad: "alta" | "media" | "baja";
};

/**
 * Recorre la lista de proyectos del tenant y devuelve los que están
 * `por_renovar` o `expirado` para mostrar alerta operativa en el dashboard.
 *
 * Severidad:
 *   - `alta`  → expirado
 *   - `media` → ≤ 7 días para caducar
 *   - `baja`  → 8-30 días para caducar
 */
export function buildProjectExpirationAlerts(
  projects: Array<Record<string, string>>,
  now = new Date(),
): ProjectExpirationAlert[] {
  const alerts: ProjectExpirationAlert[] = [];
  for (const p of projects) {
    const ev = evaluateProjectExpiration(
      { estado: p.estado, fechaCaducidad: p.fechaCaducidad },
      now,
    );
    if (ev.derived !== "expirado" && ev.derived !== "por_renovar") continue;
    if (!ev.fechaCaducidad) continue;
    let severidad: ProjectExpirationAlert["severidad"];
    if (ev.derived === "expirado") {
      severidad = "alta";
    } else if (ev.diasRestantes !== null && ev.diasRestantes <= 7) {
      severidad = "media";
    } else {
      severidad = "baja";
    }
    alerts.push({
      proyecto: String(p.nombre || ""),
      cliente: String(p.cliente || ""),
      codigoTipo: String(p.codigoTipo || ""),
      fechaCaducidad: ev.fechaCaducidad,
      diasRestantes: ev.diasRestantes ?? 0,
      estadoDerivado: ev.derived,
      severidad,
    });
  }
  // Ordenamos: primero los expirados (más urgentes), luego por días restantes.
  alerts.sort((a, b) => {
    if (a.estadoDerivado === "expirado" && b.estadoDerivado !== "expirado") return -1;
    if (b.estadoDerivado === "expirado" && a.estadoDerivado !== "expirado") return 1;
    return a.diasRestantes - b.diasRestantes;
  });
  return alerts;
}
