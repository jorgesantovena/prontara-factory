/**
 * Listas operativas del vertical Software Factory.
 *
 * Alimentan las páginas focales /software-factory/proyectos-riesgo,
 * /software-factory/propuestas-estancadas y /software-factory/facturas-vencidas.
 *
 * Cada función recibe el clientId del tenant y lee los módulos relevantes
 * via listModuleRecords (misma fuente que overview.ts). Devuelve rows
 * enriquecidas con días transcurridos, importes parseados y estados
 * normalizados, listas para renderizar en tabla sin lógica extra.
 */
import { listModuleRecords } from "@/lib/erp/active-client-data-store";

const PROJECT_RISK_STATES = ["en_riesgo", "bloqueado"];
const PROPOSAL_OPEN_STATES = ["pendiente", "enviado", "enviada", "negociacion", "borrador"];
const INVOICE_OVERDUE_STATES = ["vencida", "overdue"];
const INVOICE_PENDING_STATES = ["emitida", "pendiente", "vencida"];

const PROPOSAL_STALE_DAYS_DEFAULT = 14;

function normalize(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function parseMoney(value: unknown): number {
  const raw = String(value ?? "").trim();
  if (!raw) return 0;
  const cleaned = raw
    .replace(/[^\d.,-]/g, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "")
    .replace(",", ".");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseDateMs(value: unknown): number {
  const raw = String(value ?? "").trim();
  if (!raw) return 0;
  const ts = new Date(raw).getTime();
  return Number.isFinite(ts) ? ts : 0;
}

function daysBetween(from: number, to: number): number {
  if (from <= 0 || to <= 0) return 0;
  return Math.floor((to - from) / (1000 * 60 * 60 * 24));
}

// ---------------------------------------------------------------------------
// Proyectos en riesgo
// ---------------------------------------------------------------------------

export type ProjectAtRiskRow = {
  id: string;
  name: string;
  client: string;
  state: string;
  responsible: string;
  nextMilestone: string;
  updatedAt: string;
  daysSinceUpdate: number;
};

export function listProjectsAtRisk(clientId: string): ProjectAtRiskRow[] {
  const rows = listModuleRecords("proyectos", clientId);
  const now = Date.now();
  const out: ProjectAtRiskRow[] = [];

  for (const row of rows) {
    if (!PROJECT_RISK_STATES.includes(normalize(row.estado))) continue;
    const updatedAt = String(row.updatedAt ?? row.createdAt ?? "");
    const updatedMs = parseDateMs(updatedAt);
    out.push({
      id: String(row.id ?? row.nombre ?? Math.random()),
      name: String(row.nombre ?? "—"),
      client: String(row.cliente ?? "—"),
      state: String(row.estado ?? ""),
      responsible: String(
        row.responsable ?? row.responsables ?? row["Responsable"] ?? "—",
      ),
      nextMilestone: String(
        row.proximoHito ?? row["Próximo hito"] ?? row["Proxima entrega"] ?? "—",
      ),
      updatedAt,
      daysSinceUpdate: updatedMs > 0 ? daysBetween(updatedMs, now) : 0,
    });
  }

  out.sort((a, b) => b.daysSinceUpdate - a.daysSinceUpdate);
  return out;
}

// ---------------------------------------------------------------------------
// Propuestas estancadas
// ---------------------------------------------------------------------------

export type StaleProposalRow = {
  id: string;
  number: string;
  client: string;
  amount: number;
  amountText: string;
  state: string;
  daysStale: number;
  updatedAt: string;
};

export function listStaleProposals(
  clientId: string,
  staleDays: number = PROPOSAL_STALE_DAYS_DEFAULT,
): StaleProposalRow[] {
  const rows = listModuleRecords("presupuestos", clientId);
  const now = Date.now();
  const out: StaleProposalRow[] = [];

  for (const row of rows) {
    if (!PROPOSAL_OPEN_STATES.includes(normalize(row.estado))) continue;
    const updatedAt = String(row.updatedAt ?? row.createdAt ?? row.fecha ?? "");
    const updatedMs = parseDateMs(updatedAt);
    if (updatedMs <= 0) continue;
    const days = daysBetween(updatedMs, now);
    if (days < staleDays) continue;
    const amount = parseMoney(row.importe ?? row.valor ?? row.total);
    out.push({
      id: String(row.id ?? row.numero ?? Math.random()),
      number: String(row.numero ?? row["Nº"] ?? "—"),
      client: String(row.cliente ?? "—"),
      amount,
      amountText: amount.toLocaleString("es-ES", {
        style: "currency",
        currency: "EUR",
        maximumFractionDigits: 0,
      }),
      state: String(row.estado ?? ""),
      daysStale: days,
      updatedAt,
    });
  }

  out.sort((a, b) => b.daysStale - a.daysStale);
  return out;
}

// ---------------------------------------------------------------------------
// Facturas vencidas
// ---------------------------------------------------------------------------

export type OverdueInvoiceRow = {
  id: string;
  number: string;
  client: string;
  amount: number;
  amountText: string;
  state: string;
  dueDate: string;
  daysOverdue: number;
};

function dueDateOf(row: Record<string, string>): number {
  // Intentamos varios nombres comunes; el vertical no impone uno fijo.
  return parseDateMs(
    row.vencimiento ??
      row.fechaVencimiento ??
      row["Fecha vencimiento"] ??
      row.vence ??
      row.dueDate,
  );
}

export function listOverdueInvoices(clientId: string): OverdueInvoiceRow[] {
  const rows = listModuleRecords("facturacion", clientId);
  const now = Date.now();
  const out: OverdueInvoiceRow[] = [];

  for (const row of rows) {
    const state = normalize(row.estado);
    // Aceptamos dos fuentes: (a) estado explícito "vencida"/"overdue", o
    // (b) factura pendiente/emitida con fecha de vencimiento pasada.
    const markedOverdue = INVOICE_OVERDUE_STATES.includes(state);
    const isPending = INVOICE_PENDING_STATES.includes(state);
    const dueMs = dueDateOf(row);
    const isDueInPast = dueMs > 0 && dueMs < now;
    if (!(markedOverdue || (isPending && isDueInPast))) continue;

    const amount = parseMoney(row.importe ?? row.total ?? row.valor);
    const daysOverdue = dueMs > 0 ? daysBetween(dueMs, now) : 0;
    out.push({
      id: String(row.id ?? row.numero ?? Math.random()),
      number: String(row.numero ?? row["Nº"] ?? "—"),
      client: String(row.cliente ?? "—"),
      amount,
      amountText: amount.toLocaleString("es-ES", {
        style: "currency",
        currency: "EUR",
        maximumFractionDigits: 0,
      }),
      state: String(row.estado ?? ""),
      dueDate: String(row.vencimiento ?? row.fechaVencimiento ?? ""),
      daysOverdue,
    });
  }

  out.sort((a, b) => b.daysOverdue - a.daysOverdue);
  return out;
}
