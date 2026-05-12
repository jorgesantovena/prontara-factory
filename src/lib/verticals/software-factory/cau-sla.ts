/**
 * Motor SLA del CAU (H15-B).
 *
 * Calcula deadlines de primera respuesta + resolución a partir de
 * severidad+urgencia del ticket, usando las políticas configuradas
 * por el tenant. Si no hay política específica, cae a defaults
 * sensatos (industria estándar).
 *
 * Devuelve también el estado SLA actual: "ok", "warning" (<2h al
 * breach), "breached" (ya pasó), para pintar el ticket de un color.
 */

export type Severidad = "baja" | "media" | "alta" | "critica";
export type Urgencia = "diferida" | "normal" | "urgente";

export type SlaPolicy = {
  severidad: Severidad;
  urgencia: Urgencia;
  responseHours: number;
  resolutionHours: number;
  autoEscalate?: boolean;
};

/**
 * Defaults industria estándar. Se sobrescriben con políticas del tenant
 * (tabla CauSlaPolicy) si están configuradas.
 *
 * Horas hábiles, no naturales. Para MVP usamos horas naturales — afinar
 * a calendario laboral en una iteración futura.
 */
const DEFAULT_POLICIES: Record<string, { response: number; resolution: number; autoEscalate: boolean }> = {
  "critica:urgente":   { response: 1,   resolution: 4,    autoEscalate: true  },
  "critica:normal":    { response: 2,   resolution: 8,    autoEscalate: true  },
  "critica:diferida":  { response: 4,   resolution: 24,   autoEscalate: false },
  "alta:urgente":      { response: 2,   resolution: 8,    autoEscalate: true  },
  "alta:normal":       { response: 4,   resolution: 24,   autoEscalate: false },
  "alta:diferida":     { response: 8,   resolution: 48,   autoEscalate: false },
  "media:urgente":     { response: 4,   resolution: 24,   autoEscalate: false },
  "media:normal":      { response: 8,   resolution: 48,   autoEscalate: false },
  "media:diferida":    { response: 24,  resolution: 120,  autoEscalate: false }, // 5 días
  "baja:urgente":      { response: 8,   resolution: 48,   autoEscalate: false },
  "baja:normal":       { response: 24,  resolution: 120,  autoEscalate: false },
  "baja:diferida":     { response: 48,  resolution: 240,  autoEscalate: false }, // 10 días
};

/**
 * Resuelve la política aplicable. Si el tenant tiene una entrada en
 * CauSlaPolicy que matchea severidad+urgencia, la usa; si no, default.
 */
export function resolveSlaPolicy(
  severidad: string,
  urgencia: string,
  tenantPolicies: SlaPolicy[],
): { responseHours: number; resolutionHours: number; autoEscalate: boolean } {
  const sev = normalizeSeveridad(severidad);
  const urg = normalizeUrgencia(urgencia);

  const fromTenant = tenantPolicies.find(
    (p) => normalizeSeveridad(p.severidad) === sev && normalizeUrgencia(p.urgencia) === urg,
  );
  if (fromTenant) {
    return {
      responseHours: fromTenant.responseHours,
      resolutionHours: fromTenant.resolutionHours,
      autoEscalate: !!fromTenant.autoEscalate,
    };
  }

  const key = sev + ":" + urg;
  const def = DEFAULT_POLICIES[key] || DEFAULT_POLICIES["media:normal"];
  return { responseHours: def.response, resolutionHours: def.resolution, autoEscalate: def.autoEscalate };
}

/**
 * Calcula deadlines de primera respuesta y resolución desde la fecha
 * de creación del ticket.
 */
export function computeSlaDeadlines(
  createdAt: Date,
  severidad: string,
  urgencia: string,
  tenantPolicies: SlaPolicy[],
): { firstResponseDeadline: Date; resolutionDeadline: Date; autoEscalate: boolean } {
  const policy = resolveSlaPolicy(severidad, urgencia, tenantPolicies);
  const t0 = createdAt.getTime();
  return {
    firstResponseDeadline: new Date(t0 + policy.responseHours * 3600_000),
    resolutionDeadline: new Date(t0 + policy.resolutionHours * 3600_000),
    autoEscalate: policy.autoEscalate,
  };
}

/**
 * Estado SLA actual del ticket:
 *   - "ok"        → falta más de 2h al primer deadline pendiente
 *   - "warning"   → falta menos de 2h pero todavía no breached
 *   - "breached"  → ya pasó al menos un deadline sin cumplir
 *   - "resolved"  → ticket ya resuelto, SLA cerrado
 */
export type SlaStatus = "ok" | "warning" | "breached" | "resolved";

export function computeSlaStatus(input: {
  createdAt: Date | string;
  firstResponseAt?: Date | string | null;
  resolvedAt?: Date | string | null;
  severidad: string;
  urgencia: string;
  tenantPolicies: SlaPolicy[];
  now?: Date;
}): {
  status: SlaStatus;
  firstResponseDeadline: Date;
  resolutionDeadline: Date;
  firstResponseBreached: boolean;
  resolutionBreached: boolean;
  hoursToFirstResponseDeadline: number;
  hoursToResolutionDeadline: number;
} {
  const now = input.now || new Date();
  const createdAt = typeof input.createdAt === "string" ? new Date(input.createdAt) : input.createdAt;
  const firstResponseAt = input.firstResponseAt
    ? (typeof input.firstResponseAt === "string" ? new Date(input.firstResponseAt) : input.firstResponseAt)
    : null;
  const resolvedAt = input.resolvedAt
    ? (typeof input.resolvedAt === "string" ? new Date(input.resolvedAt) : input.resolvedAt)
    : null;

  const { firstResponseDeadline, resolutionDeadline } = computeSlaDeadlines(
    createdAt, input.severidad, input.urgencia, input.tenantPolicies,
  );

  if (resolvedAt) {
    return {
      status: "resolved",
      firstResponseDeadline,
      resolutionDeadline,
      firstResponseBreached: !!firstResponseAt && firstResponseAt > firstResponseDeadline,
      resolutionBreached: resolvedAt > resolutionDeadline,
      hoursToFirstResponseDeadline: 0,
      hoursToResolutionDeadline: 0,
    };
  }

  const firstResponseBreached = !firstResponseAt && now > firstResponseDeadline;
  const resolutionBreached = now > resolutionDeadline;
  const hoursFR = (firstResponseDeadline.getTime() - now.getTime()) / 3600_000;
  const hoursRes = (resolutionDeadline.getTime() - now.getTime()) / 3600_000;

  let status: SlaStatus = "ok";
  if (firstResponseBreached || resolutionBreached) {
    status = "breached";
  } else if (hoursFR < 2 || hoursRes < 2) {
    status = "warning";
  }

  return {
    status,
    firstResponseDeadline,
    resolutionDeadline,
    firstResponseBreached,
    resolutionBreached,
    hoursToFirstResponseDeadline: hoursFR,
    hoursToResolutionDeadline: hoursRes,
  };
}

function normalizeSeveridad(s: string): Severidad {
  const lower = String(s || "").toLowerCase().trim();
  if (lower === "critica" || lower === "crítica") return "critica";
  if (lower === "alta") return "alta";
  if (lower === "baja") return "baja";
  return "media";
}

function normalizeUrgencia(u: string): Urgencia {
  const lower = String(u || "").toLowerCase().trim();
  if (lower === "urgente") return "urgente";
  if (lower === "diferida") return "diferida";
  return "normal";
}

/**
 * Métricas agregadas — MTR (Mean Time to Resolve) y SLA compliance %.
 */
export function computeCauMetrics(tickets: Array<{
  createdAt: string;
  firstResponseAt?: string | null;
  resolvedAt?: string | null;
  severidad: string;
  urgencia: string;
}>, tenantPolicies: SlaPolicy[]): {
  totalTickets: number;
  resolvedCount: number;
  openCount: number;
  mtrHours: number | null;          // promedio horas resolución (solo cerrados)
  slaCompliancePct: number | null;  // % de cerrados que NO breachearon
  breachedOpenCount: number;
} {
  const resolved = tickets.filter((t) => !!t.resolvedAt);
  const open = tickets.filter((t) => !t.resolvedAt);

  let mtrHours: number | null = null;
  if (resolved.length > 0) {
    const totalMs = resolved.reduce((sum, t) => {
      const c = new Date(t.createdAt).getTime();
      const r = new Date(t.resolvedAt!).getTime();
      return sum + (r - c);
    }, 0);
    mtrHours = totalMs / 3600_000 / resolved.length;
  }

  let compliant = 0;
  for (const t of resolved) {
    const s = computeSlaStatus({
      createdAt: t.createdAt,
      firstResponseAt: t.firstResponseAt,
      resolvedAt: t.resolvedAt,
      severidad: t.severidad,
      urgencia: t.urgencia,
      tenantPolicies,
    });
    if (!s.firstResponseBreached && !s.resolutionBreached) compliant++;
  }
  const slaCompliancePct = resolved.length > 0 ? (compliant * 100) / resolved.length : null;

  let breachedOpen = 0;
  for (const t of open) {
    const s = computeSlaStatus({
      createdAt: t.createdAt,
      firstResponseAt: t.firstResponseAt,
      resolvedAt: t.resolvedAt,
      severidad: t.severidad,
      urgencia: t.urgencia,
      tenantPolicies,
    });
    if (s.status === "breached") breachedOpen++;
  }

  return {
    totalTickets: tickets.length,
    resolvedCount: resolved.length,
    openCount: open.length,
    mtrHours,
    slaCompliancePct,
    breachedOpenCount: breachedOpen,
  };
}
