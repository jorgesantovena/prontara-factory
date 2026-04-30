import fs from "node:fs";
import path from "node:path";
import { listTenantClientsIndex } from "@/lib/saas/tenant-clients-index";
import { readFactoryDiskHistory } from "@/lib/factory/factory-disk-history";

export type FactoryHealthSeverity = "ok" | "warn" | "danger" | "info";

export type FactoryHealthIssue = {
  key: string;
  label: string;
  severity: FactoryHealthSeverity;
  detail: string;
};

export type FactoryHealthTenantRow = {
  clientId: string;
  tenantId: string;
  slug: string;
  displayName: string;
  diskState: "healthy" | "partial" | "corrupt";
  runtimeState: "ready" | "missing" | "error";
  diskConsistency: "ok" | "warning" | "error";
  evolutionState: "ready" | "missing" | "warning";
  billingState: "ok" | "trial" | "cancelled" | "warning";
  deliveryState: "ready" | "partial" | "missing";
  issueCount: number;
  updatedAt: string | null;
  issues: FactoryHealthIssue[];
};

export type FactoryHealthSnapshot = {
  generatedAt: string;
  summary: {
    totalTenants: number;
    healthyTenants: number;
    partialTenants: number;
    corruptTenants: number;
    runtimeFailures: number;
    diskWarnings: number;
    evolutionWarnings: number;
    billingWarnings: number;
    deliveryWarnings: number;
    totalIssues: number;
  };
  rows: FactoryHealthTenantRow[];
};

function safeReadJson<T>(filePath: string, fallback: T): T {
  try {
    if (!fs.existsSync(filePath)) {
      return fallback
    }
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as T
  } catch {
    return fallback
  }
}

function getRootPath(...parts: string[]) {
  return path.join(/*turbopackIgnore: true*/ process.cwd(), ...parts)
}

function latestValue(values: Array<string | null | undefined>): string | null {
  const cleaned = values
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .sort()
    .reverse()

  return cleaned[0] || null
}

function resolveSubscriptionJson(clientId: string) {
  return safeReadJson<Record<string, unknown> | null>(
    getRootPath("data", "saas", "subscriptions", clientId + ".json"),
    null
  )
}

function resolveRuntimeJson(clientId: string) {
  return safeReadJson<Record<string, unknown> | null>(
    getRootPath("data", "saas", "tenant-runtime-config", clientId + ".json"),
    null
  )
}

function resolveHealthJson(clientId: string) {
  return safeReadJson<Record<string, unknown> | null>(
    getRootPath("data", "saas", "health", clientId + ".json"),
    null
  )
}

function resolveEvolutionCurrentJson(clientId: string) {
  return safeReadJson<Record<string, unknown> | null>(
    getRootPath("data", "saas", "evolution", clientId, "current-runtime-config.json"),
    null
  )
}

function resolveEvolutionHistoryJson(clientId: string) {
  return safeReadJson<Array<Record<string, unknown>>>(
    getRootPath("data", "saas", "evolution", clientId, "history.json"),
    []
  )
}

function resolveDeliveryJson(clientId: string) {
  const activationPackage = safeReadJson<Record<string, unknown> | null>(
    getRootPath("data", "saas", "activation-package", clientId + ".json"),
    null
  )
  const activationEmail = safeReadJson<Record<string, unknown> | null>(
    getRootPath("data", "saas", "activation-email", clientId + ".json"),
    null
  )
  return {
    activationPackage,
    activationEmail,
  }
}

function normalizeBillingState(clientId: string): "ok" | "trial" | "cancelled" | "warning" {
  const subscription = resolveSubscriptionJson(clientId)
  const status = String(subscription?.status || subscription?.state || "").trim().toLowerCase()
  const issue = Boolean(subscription?.paymentIssue || subscription?.warning || subscription?.invoiceFailed)

  if (status === "trial") {
    return "trial"
  }
  if (status === "cancelled" || status === "canceled") {
    return "cancelled"
  }
  if (issue) {
    return "warning"
  }
  return "ok"
}

function buildTenantHealthRow(
  client: {
    clientId: string
    tenantId: string
    slug: string
    displayName: string
    hasRuntimeConfig: boolean
    hasEvolution: boolean
    lastUpdatedAt: string | null
  },
  diskItem: {
    state: "healthy" | "partial" | "corrupt"
    missingPaths?: string[]
    clientPath?: string
    artifactsPath?: string
  } | null
): FactoryHealthTenantRow {
  const runtime = resolveRuntimeJson(client.clientId)
  const health = resolveHealthJson(client.clientId)
  const evolutionCurrent = resolveEvolutionCurrentJson(client.clientId)
  const evolutionHistory = resolveEvolutionHistoryJson(client.clientId)
  const delivery = resolveDeliveryJson(client.clientId)
  const billingState = normalizeBillingState(client.clientId)

  const diskState = (diskItem?.state || "partial") as "healthy" | "partial" | "corrupt"

  const runtimeErrors = Array.isArray(health?.errors)
    ? (health?.errors as Array<Record<string, unknown>>).filter((item) => {
        const scope = String(item.scope || item.area || "").trim().toLowerCase()
        return scope.includes("runtime") || scope === ""
      })
    : []

  const runtimeState: "ready" | "missing" | "error" =
    runtimeErrors.length > 0
      ? "error"
      : client.hasRuntimeConfig || Boolean(runtime)
        ? "ready"
        : "missing"

  const missingPaths = Array.isArray(diskItem?.missingPaths) ? diskItem?.missingPaths : []
  const diskConsistency: "ok" | "warning" | "error" =
    diskState === "corrupt"
      ? "error"
      : missingPaths.length > 0 || diskState === "partial"
        ? "warning"
        : "ok"

  const evolutionWarnings = Array.isArray(health?.warnings)
    ? (health?.warnings as Array<Record<string, unknown>>).filter((item) => {
        const scope = String(item.scope || item.area || "").trim().toLowerCase()
        return scope.includes("evolution")
      })
    : []

  const evolutionState: "ready" | "missing" | "warning" =
    evolutionWarnings.length > 0
      ? "warning"
      : client.hasEvolution || Boolean(evolutionCurrent) || evolutionHistory.length > 0
        ? "ready"
        : "missing"

  const deliveryReady = Boolean(
    delivery.activationPackage?.accessUrl ||
    delivery.activationPackage?.loginUrl
  )
  const deliveryEmailExists = Boolean(delivery.activationEmail || delivery.activationPackage)
  const deliveryState: "ready" | "partial" | "missing" =
    deliveryReady
      ? "ready"
      : deliveryEmailExists
        ? "partial"
        : "missing"

  const issues: FactoryHealthIssue[] = []

  if (diskState === "corrupt") {
    issues.push({
      key: "disk-corrupt",
      label: "Tenant corrupto",
      severity: "danger",
      detail: "La estructura de disco del tenant está en estado corrupto.",
    })
  } else if (diskState === "partial") {
    issues.push({
      key: "disk-partial",
      label: "Tenant parcial",
      severity: "warn",
      detail: "La estructura del tenant está incompleta o parcialmente resuelta.",
    })
  }

  if (missingPaths.length > 0) {
    issues.push({
      key: "disk-missing-paths",
      label: "Inconsistencias de disco",
      severity: "warn",
      detail: "Rutas ausentes: " + missingPaths.join(", "),
    })
  }

  if (runtimeState === "missing") {
    issues.push({
      key: "runtime-missing",
      label: "Runtime ausente",
      severity: "warn",
      detail: "No existe configuración runtime final del tenant.",
    })
  }

  if (runtimeState === "error") {
    issues.push({
      key: "runtime-error",
      label: "Fallo runtime",
      severity: "danger",
      detail:
        runtimeErrors.length > 0
          ? String(runtimeErrors[0]?.detail || runtimeErrors[0]?.message || "Error runtime detectado.")
          : "Se ha detectado un error runtime.",
    })
  }

  if (evolutionState === "missing") {
    issues.push({
      key: "evolution-missing",
      label: "Evolution ausente",
      severity: "warn",
      detail: "No existe estado de evolución asociado al cliente.",
    })
  }

  if (evolutionState === "warning") {
    issues.push({
      key: "evolution-warning",
      label: "Evolution con incidencias",
      severity: "warn",
      detail: "Hay alertas o warnings en la capa de evolución.",
    })
  }

  if (billingState === "warning") {
    issues.push({
      key: "billing-warning",
      label: "Billing con incidencia",
      severity: "warn",
      detail: "Se ha detectado warning o incidencia en facturación SaaS.",
    })
  }

  if (billingState === "cancelled") {
    issues.push({
      key: "billing-cancelled",
      label: "Billing cancelado",
      severity: "info",
      detail: "La suscripción del cliente está cancelada.",
    })
  }

  if (deliveryState === "missing") {
    issues.push({
      key: "delivery-missing",
      label: "Delivery ausente",
      severity: "warn",
      detail: "No existe paquete o estado de entrega del cliente.",
    })
  }

  if (deliveryState === "partial") {
    issues.push({
      key: "delivery-partial",
      label: "Delivery parcial",
      severity: "warn",
      detail: "Existe parte de la entrega, pero el acceso final no está completamente cerrado.",
    })
  }

  return {
    clientId: client.clientId,
    tenantId: client.tenantId,
    slug: client.slug,
    displayName: client.displayName,
    diskState,
    runtimeState,
    diskConsistency,
    evolutionState,
    billingState,
    deliveryState,
    issueCount: issues.length,
    updatedAt: latestValue([
      client.lastUpdatedAt,
      String(runtime?.updatedAt || ""),
      String(health?.updatedAt || ""),
      String(delivery.activationEmail?.updatedAt || ""),
      String(delivery.activationPackage?.updatedAt || ""),
    ]),
    issues,
  }
}

export function getFactoryHealthSnapshot(): FactoryHealthSnapshot {
  const clients = listTenantClientsIndex()
  const diskHistory = readFactoryDiskHistory()
  const diskMap = new Map(diskHistory.map((item) => [item.clientId, item]))

  const rows = clients
    .map((client) => buildTenantHealthRow(client, diskMap.get(client.clientId) || null))
    .sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime())

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      totalTenants: rows.length,
      healthyTenants: rows.filter((row) => row.diskState === "healthy").length,
      partialTenants: rows.filter((row) => row.diskState === "partial").length,
      corruptTenants: rows.filter((row) => row.diskState === "corrupt").length,
      runtimeFailures: rows.filter((row) => row.runtimeState === "error" || row.runtimeState === "missing").length,
      diskWarnings: rows.filter((row) => row.diskConsistency !== "ok").length,
      evolutionWarnings: rows.filter((row) => row.evolutionState !== "ready").length,
      billingWarnings: rows.filter((row) => row.billingState === "warning" || row.billingState === "cancelled").length,
      deliveryWarnings: rows.filter((row) => row.deliveryState !== "ready").length,
      totalIssues: rows.reduce((acc, row) => acc + row.issueCount, 0),
    },
    rows,
  }
}