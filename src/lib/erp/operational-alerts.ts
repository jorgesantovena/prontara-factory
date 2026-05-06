/**
 * Alertas operativas para el dashboard runtime genérico.
 *
 * Tres reglas universales que cualquier pyme entiende sin contexto
 * sectorial:
 *   - Factura vencida: estado `vencida`/`overdue`, o `fechaVencimiento`
 *     anterior a hoy y el estado todavía no está cobrado.
 *   - Propuesta parada: presupuestos abiertos sin mover en 14+ días.
 *   - Cliente inactivo: clientes con estado explícito `inactivo`.
 *
 * Las alertas del vertical Software Factory (en
 * `src/lib/verticals/software-factory/overview.ts`) son más específicas
 * (proyectos en riesgo, por ejemplo). Este módulo es el baseline para
 * cualquier tenant; el vertical añade en su propio overview.
 */

import { listModuleRecordsAsync } from "@/lib/persistence/active-client-data-store-async";

export type OperationalAlertSeverity = "info" | "warn" | "danger";

export type OperationalAlert = {
  key: string;
  severity: OperationalAlertSeverity;
  title: string;
  detail: string;
  href: string;
};

const INVOICE_OVERDUE_STATES = ["vencida", "overdue"];
const INVOICE_PAID_STATES = ["cobrada", "pagada", "paid"];
const PROPOSAL_OPEN_STATES = ["pendiente", "enviado", "enviada", "negociacion", "borrador"];
const PROPOSAL_STALE_DAYS = 14;

function normalize(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function parseDate(value: unknown): number {
  const raw = String(value ?? "").trim();
  if (!raw) return 0;
  const ts = new Date(raw).getTime();
  return Number.isFinite(ts) ? ts : 0;
}

function daysBetween(from: number, to: number): number {
  if (from <= 0 || to <= 0) return 0;
  return Math.floor((to - from) / (1000 * 60 * 60 * 24));
}

async function safeList(moduleKey: string, clientId: string): Promise<Array<Record<string, string>>> {
  try {
    return await listModuleRecordsAsync(moduleKey, clientId);
  } catch {
    return [];
  }
}

export async function buildOperationalAlerts(clientId: string): Promise<OperationalAlert[]> {
  if (!clientId) return [];

  const alerts: OperationalAlert[] = [];
  const now = Date.now();

  // ---- Facturas vencidas ----
  const facturas = await safeList("facturacion", clientId);
  for (const row of facturas) {
    const estado = normalize(row.estado);
    if (INVOICE_PAID_STATES.includes(estado)) continue;

    const explicit = INVOICE_OVERDUE_STATES.includes(estado);
    const venc = parseDate(row.fechaVencimiento ?? row.fecha_vencimiento ?? row.vencimiento);
    const implicitlyOverdue = venc > 0 && venc < now;

    if (!explicit && !implicitlyOverdue) continue;

    alerts.push({
      key: "factura-vencida-" + String(row.id ?? row.numero ?? Math.random()),
      severity: "danger",
      title: "Factura vencida: " + String(row.numero ?? "—"),
      detail:
        "Cliente: " +
        String(row.cliente ?? "—") +
        (row.importe ? " · " + String(row.importe) : "") +
        ". Reclama el cobro.",
      href: "/facturacion",
    });
  }

  // ---- Propuestas paradas ----
  const propuestasAll = await safeList("presupuestos", clientId);
  const propuestas = propuestasAll.filter((row) =>
    PROPOSAL_OPEN_STATES.includes(normalize(row.estado)),
  );
  for (const row of propuestas) {
    const ts = parseDate(row.updatedAt ?? row.createdAt ?? row.fecha);
    if (ts <= 0) continue;
    const days = daysBetween(ts, now);
    if (days < PROPOSAL_STALE_DAYS) continue;

    alerts.push({
      key: "propuesta-parada-" + String(row.id ?? row.numero ?? Math.random()),
      severity: "warn",
      title: "Propuesta parada: " + String(row.numero ?? "—"),
      detail:
        "Cliente: " +
        String(row.cliente ?? "—") +
        ". Sin movimiento hace " +
        days +
        " días. Haz seguimiento.",
      href: "/presupuestos",
    });
  }

  // ---- Clientes inactivos ----
  const clientes = await safeList("clientes", clientId);
  for (const row of clientes) {
    if (normalize(row.estado) !== "inactivo") continue;

    alerts.push({
      key: "cliente-inactivo-" + String(row.id ?? row.nombre ?? Math.random()),
      severity: "info",
      title: "Cliente inactivo: " + String(row.nombre ?? "—"),
      detail: "Marcado como inactivo. Valora reactivarlo o archivarlo.",
      href: "/clientes",
    });
  }

  return alerts;
}
