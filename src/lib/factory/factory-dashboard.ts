import fs from "node:fs";
import path from "node:path";
import { listTenantClientsIndex } from "@/lib/saas/tenant-clients-index";
import { readFactoryDiskHistory } from "@/lib/factory/factory-disk-history";

export type FactoryDashboardMetric = {
  key: string;
  label: string;
  value: string;
  helper: string;
};

export type FactoryDashboardStatusCard = {
  key: string;
  title: string;
  detail: string;
  tone: "ok" | "warn" | "danger" | "info";
};

export type FactoryDashboardActivityItem = {
  id: string;
  title: string;
  subtitle: string;
  detail: string;
  createdAt: string;
  area: "business" | "provisioning" | "runtime" | "billing" | "evolution" | "health";
};

export type FactoryDashboardQuickAction = {
  href: string;
  label: string;
  helper: string;
};

export type FactoryDashboardVerticalItem = {
  key: string;
  label: string;
  count: number;
};

export type FactoryClientPanelRow = {
  clientId: string;
  tenantId: string;
  slug: string;
  displayName: string;
  vertical: string;
  plan: string;
  subscriptionState: "active" | "trial" | "cancelled";
  runtimeReady: boolean;
  evolutionReady: boolean;
  provisioningState: "ready" | "pending" | "error";
  healthState: "healthy" | "partial" | "corrupt";
  billingState: "ok" | "trial" | "cancelled" | "warning";
  brandingDisplayName: string;
  brandingAccentColor: string;
  brandingTone: string;
  accessUrl: string;
  deliveryUrl: string;
  openUrl: string;
  updatedAt: string | null;
};

export type FactoryDashboardAreaSummary = {
  business: {
    activeSubscriptions: number;
    trialSubscriptions: number;
    cancelledSubscriptions: number;
    activeVerticals: number;
  };
  provisioning: {
    ready: number;
    pending: number;
    error: number;
    recentEvents: number;
  };
  runtime: {
    ready: number;
    notReady: number;
  };
  billing: {
    ok: number;
    trial: number;
    cancelled: number;
    warning: number;
  };
  evolution: {
    ready: number;
    pending: number;
    recentEvents: number;
  };
  health: {
    healthy: number;
    partial: number;
    corrupt: number;
    recentErrors: number;
  };
};

export type FactoryDashboardSnapshot = {
  generatedAt: string;
  summary: {
    totalClients: number;
    totalTenants: number;
    activeCount: number;
    trialCount: number;
    cancelledCount: number;
    activeSubscriptions: number;
    provisioningRecent: number;
    recentErrors: number;
    healthyTenants: number;
    partialTenants: number;
    corruptTenants: number;
  };
  areas: FactoryDashboardAreaSummary;
  metrics: FactoryDashboardMetric[];
  statusCards: FactoryDashboardStatusCard[];
  provisioningRecent: FactoryDashboardActivityItem[];
  recentErrors: FactoryDashboardActivityItem[];
  operationalFeed: FactoryDashboardActivityItem[];
  verticals: FactoryDashboardVerticalItem[];
  quickActions: FactoryDashboardQuickAction[];
  clients: FactoryClientPanelRow[];
};

function safeReadJson<T>(filePath: string, fallback: T): T {
  try {
    if (!fs.existsSync(filePath)) {
      return fallback;
    }
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
  } catch {
    return fallback;
  }
}

function getRootPath(...parts: string[]) {
  return path.join(/*turbopackIgnore: true*/ process.cwd(), ...parts);
}

function getBaseUrl() {
  const envUrl = String(process.env.APP_BASE_URL || "").trim();
  return envUrl || "http://localhost:3000";
}

function resolveSubscriptionJson(clientId: string): Record<string, unknown> | null {
  return safeReadJson<Record<string, unknown> | null>(
    getRootPath("data", "saas", "subscriptions", clientId + ".json"),
    null
  );
}

function resolveSubscriptionState(clientId: string): "active" | "trial" | "cancelled" {
  const json = resolveSubscriptionJson(clientId);
  const status = String(json?.status || json?.state || "").trim().toLowerCase();

  if (status === "cancelled" || status === "canceled") {
    return "cancelled";
  }

  if (status === "trial") {
    return "trial";
  }

  return "active";
}

function resolvePlan(clientId: string): string {
  const json = resolveSubscriptionJson(clientId);
  return String(json?.plan || json?.planCode || json?.tier || "starter").trim() || "starter";
}

function resolveBillingState(clientId: string): "ok" | "trial" | "cancelled" | "warning" {
  const json = resolveSubscriptionJson(clientId);
  const status = String(json?.status || json?.state || "").trim().toLowerCase();
  const issue = Boolean(json?.paymentIssue || json?.warning || json?.invoiceFailed);

  if (status === "cancelled" || status === "canceled") {
    return "cancelled";
  }
  if (status === "trial") {
    return "trial";
  }
  if (issue) {
    return "warning";
  }
  return "ok";
}

function resolveRuntimeJson(clientId: string): Record<string, unknown> | null {
  return safeReadJson<Record<string, unknown> | null>(
    getRootPath("data", "saas", "tenant-runtime-config", clientId + ".json"),
    null
  );
}

function asNestedRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function resolveVertical(clientId: string): string {
  const json = resolveRuntimeJson(clientId);
  const nestedRuntime = asNestedRecord(json?.runtime);
  const nestedConfig = asNestedRecord(json?.config);

  return String(
    json?.businessType ||
      nestedRuntime.businessType ||
      nestedConfig.businessType ||
      "generic-pyme"
  ).trim() || "generic-pyme";
}

function resolveBranding(clientId: string, fallbackDisplayName: string) {
  const clientBranding = safeReadJson<Record<string, unknown> | null>(
    getRootPath(".prontara", "clients", clientId, "branding.json"),
    null
  );
  const runtime = resolveRuntimeJson(clientId);
  const nestedConfig = asNestedRecord(runtime?.config);

  const branding = asNestedRecord(runtime?.branding || nestedConfig.branding);

  return {
    displayName: String(
      clientBranding?.displayName ||
        branding.displayName ||
        fallbackDisplayName
    ).trim() || fallbackDisplayName,
    accentColor: String(
      clientBranding?.accentColor ||
        branding.accentColor ||
        "#111827"
    ).trim() || "#111827",
    tone: String(
      clientBranding?.tone ||
        branding.tone ||
        "professional"
    ).trim() || "professional",
  };
}

function resolveProvisioningJson(clientId: string): Record<string, unknown> | null {
  return safeReadJson<Record<string, unknown> | null>(
    getRootPath("data", "saas", "provisioning", clientId + ".json"),
    null
  );
}

function resolveProvisioningState(clientId: string): "ready" | "pending" | "error" {
  const json = resolveProvisioningJson(clientId);
  const status = String(json?.status || json?.state || "").trim().toLowerCase();

  if (["error", "failed"].includes(status)) {
    return "error";
  }
  if (["ready", "completed", "done", "success"].includes(status)) {
    return "ready";
  }
  return "pending";
}

function resolveProvisioningEvents(clientId: string): Array<FactoryDashboardActivityItem> {
  const json = resolveProvisioningJson(clientId);
  const rawEvents = Array.isArray(json?.events) ? (json?.events as Array<Record<string, unknown>>) : [];
  return rawEvents.map((event, index) => ({
    id: clientId + "-prov-" + index,
    title: String(event.title || event.step || "Provisioning"),
    subtitle: String(event.detail || event.status || ""),
    detail: clientId,
    createdAt: String(event.createdAt || event.at || json?.updatedAt || ""),
    area: "provisioning",
  }));
}

function resolveHealthJson(clientId: string): Record<string, unknown> | null {
  return safeReadJson<Record<string, unknown> | null>(
    getRootPath("data", "saas", "health", clientId + ".json"),
    null
  );
}

function resolveErrorEvents(clientId: string): Array<FactoryDashboardActivityItem> {
  const json = resolveHealthJson(clientId);
  const rawErrors = Array.isArray(json?.errors) ? (json?.errors as Array<Record<string, unknown>>) : [];
  return rawErrors.map((event, index) => ({
    id: clientId + "-error-" + index,
    title: String(event.title || "Error"),
    subtitle: String(event.detail || event.message || ""),
    detail: clientId,
    createdAt: String(event.createdAt || event.at || json?.updatedAt || ""),
    area: "health",
  }));
}

function resolveEvolutionEvents(clientId: string): Array<FactoryDashboardActivityItem> {
  const historyPath = getRootPath("data", "saas", "evolution", clientId, "history.json");
  const rows = safeReadJson<Array<Record<string, unknown>>>(historyPath, []);
  return rows.slice(0, 5).map((row, index): FactoryDashboardActivityItem => ({
    id: clientId + "-evo-" + index,
    title: String(row.summary || row.actionType || "Cambio"),
    subtitle: String(row.actionType || ""),
    detail: clientId,
    createdAt: String(row.createdAt || ""),
    area: "evolution",
  }));
}

function resolveBusinessEvents(clientId: string, subscriptionState: "active" | "trial" | "cancelled"): Array<FactoryDashboardActivityItem> {
  const billingJson = resolveSubscriptionJson(clientId);
  const updatedAt = String(billingJson?.updatedAt || billingJson?.createdAt || "");
  const items: FactoryDashboardActivityItem[] = [
    {
      id: clientId + "-business-0",
      title:
        subscriptionState === "active"
          ? "Suscripción activa"
          : subscriptionState === "trial"
            ? "Cliente en trial"
            : "Cliente cancelado",
      subtitle: clientId,
      detail: "Estado comercial actual del cliente",
      createdAt: updatedAt,
      area: "business",
    },
  ];
  return items.filter((item) => item.createdAt.trim().length > 0);
}

function resolveRuntimeEvents(clientId: string, runtimeReady: boolean, updatedAt: string | null): Array<FactoryDashboardActivityItem> {
  const items: FactoryDashboardActivityItem[] = [
    {
      id: clientId + "-runtime-0",
      title: runtimeReady ? "Runtime listo" : "Runtime pendiente",
      subtitle: clientId,
      detail: runtimeReady ? "Tenant disponible para uso" : "Pendiente de cierre runtime",
      createdAt: String(updatedAt || ""),
      area: "runtime",
    },
  ];
  return items.filter((item) => item.createdAt.trim().length > 0);
}

function resolveBillingEvents(clientId: string, billingState: "ok" | "trial" | "cancelled" | "warning"): Array<FactoryDashboardActivityItem> {
  const json = resolveSubscriptionJson(clientId);
  const updatedAt = String(json?.updatedAt || json?.createdAt || "");
  const items: FactoryDashboardActivityItem[] = [
    {
      id: clientId + "-billing-0",
      title:
        billingState === "ok"
          ? "Billing correcto"
          : billingState === "trial"
            ? "Billing en trial"
            : billingState === "cancelled"
              ? "Billing cancelado"
              : "Incidencia de billing",
      subtitle: clientId,
      detail: "Estado de facturación SaaS del cliente",
      createdAt: updatedAt,
      area: "billing",
    },
  ];
  return items.filter((item) => item.createdAt.trim().length > 0);
}

function toRecent(items: FactoryDashboardActivityItem[], maxItems: number) {
  return items
    .filter((item) => String(item.createdAt || "").trim().length > 0)
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
    .slice(0, maxItems);
}

/*
 * TTL cache for the dashboard snapshot.
 *
 * The snapshot reads dozens of tenant JSON files every time it is built. On a
 * Factory with >20 clients each request can easily hit 100+ filesystem reads,
 * which becomes the bottleneck of the whole admin UI. Since the data is
 * eventually-consistent anyway, we cache the computed snapshot for a short
 * window and expose `invalidateFactoryDashboardCache()` so that mutation
 * endpoints can force an immediate refresh.
 */
const DASHBOARD_CACHE_TTL_MS = 10_000;

type DashboardCache = {
  snapshot: FactoryDashboardSnapshot;
  computedAt: number;
};

let cachedDashboard: DashboardCache | null = null;

export function invalidateFactoryDashboardCache(): void {
  cachedDashboard = null;
}

export function getFactoryDashboardSnapshot(options?: { noCache?: boolean }): FactoryDashboardSnapshot {
  const now = Date.now();
  if (
    !options?.noCache &&
    cachedDashboard &&
    now - cachedDashboard.computedAt < DASHBOARD_CACHE_TTL_MS
  ) {
    return cachedDashboard.snapshot;
  }

  const snapshot = computeFactoryDashboardSnapshot();
  cachedDashboard = { snapshot, computedAt: now };
  return snapshot;
}

function computeFactoryDashboardSnapshot(): FactoryDashboardSnapshot {
  const clients = listTenantClientsIndex();
  const diskHistory = readFactoryDiskHistory();
  const baseUrl = getBaseUrl();

  const healthMap = new Map(diskHistory.map((item) => [item.clientId, item]));

  const mappedClients: FactoryClientPanelRow[] = clients.map((item) => {
    const subscriptionState = resolveSubscriptionState(item.clientId);
    const vertical = resolveVertical(item.clientId);
    const provisioningState = resolveProvisioningState(item.clientId);
    const healthState = (healthMap.get(item.clientId)?.state || "partial") as "healthy" | "partial" | "corrupt";
    const billingState = resolveBillingState(item.clientId);
    const plan = resolvePlan(item.clientId);
    const branding = resolveBranding(item.clientId, item.displayName);

    return {
      clientId: item.clientId,
      tenantId: item.tenantId,
      slug: item.slug,
      displayName: item.displayName,
      vertical,
      plan,
      subscriptionState,
      runtimeReady: item.hasRuntimeConfig,
      evolutionReady: item.hasEvolution,
      provisioningState,
      healthState,
      billingState,
      brandingDisplayName: branding.displayName,
      brandingAccentColor: branding.accentColor,
      brandingTone: branding.tone,
      accessUrl: baseUrl + "/acceso?tenant=" + encodeURIComponent(item.slug),
      deliveryUrl: baseUrl + "/entrega?tenant=" + encodeURIComponent(item.slug),
      openUrl: baseUrl + "/?tenant=" + encodeURIComponent(item.slug),
      updatedAt: item.lastUpdatedAt,
    };
  });

  const totalClients = mappedClients.length;
  const totalTenants = mappedClients.length;
  const activeCount = mappedClients.filter((item) => item.subscriptionState === "active").length;
  const trialCount = mappedClients.filter((item) => item.subscriptionState === "trial").length;
  const cancelledCount = mappedClients.filter((item) => item.subscriptionState === "cancelled").length;
  const activeSubscriptions = mappedClients.filter((item) => item.billingState === "ok").length;

  const provisioningRecentAll = mappedClients.flatMap((item) => resolveProvisioningEvents(item.clientId));
  const recentErrorsAll = mappedClients.flatMap((item) => resolveErrorEvents(item.clientId));
  const evolutionRecentAll = mappedClients.flatMap((item) => resolveEvolutionEvents(item.clientId));
  const businessRecentAll = mappedClients.flatMap((item) => resolveBusinessEvents(item.clientId, item.subscriptionState));
  const runtimeRecentAll = mappedClients.flatMap((item) => resolveRuntimeEvents(item.clientId, item.runtimeReady, item.updatedAt));
  const billingRecentAll = mappedClients.flatMap((item) => resolveBillingEvents(item.clientId, item.billingState));

  const healthyTenants = diskHistory.filter((item) => item.state === "healthy").length;
  const partialTenants = diskHistory.filter((item) => item.state === "partial").length;
  const corruptTenants = diskHistory.filter((item) => item.state === "corrupt").length;

  const verticalMap = new Map<string, number>();
  for (const item of mappedClients) {
    verticalMap.set(item.vertical, (verticalMap.get(item.vertical) || 0) + 1);
  }

  const verticals = Array.from(verticalMap.entries())
    .map(([key, count]) => ({
      key,
      label: key,
      count,
    }))
    .sort((a, b) => b.count - a.count);

  const metrics: FactoryDashboardMetric[] = [
    {
      key: "clients",
      label: "Clientes",
      value: String(totalClients),
      helper: "Base total operada por Factory.",
    },
    {
      key: "active",
      label: "Activos",
      value: String(activeCount),
      helper: "Clientes comercialmente activos.",
    },
    {
      key: "trials",
      label: "Trials",
      value: String(trialCount),
      helper: "Clientes aún en prueba.",
    },
    {
      key: "cancelled",
      label: "Cancelados",
      value: String(cancelledCount),
      helper: "Clientes cerrados o cancelados.",
    },
    {
      key: "billing",
      label: "Suscripciones activas",
      value: String(activeSubscriptions),
      helper: "Billing SaaS sin incidencia.",
    },
    {
      key: "verticals",
      label: "Verticales activos",
      value: String(verticals.length),
      helper: "Verticales vivos en explotación.",
    },
    {
      key: "provisioning",
      label: "Provisioning reciente",
      value: String(provisioningRecentAll.length),
      helper: "Eventos recientes de alta y preparación.",
    },
    {
      key: "errors",
      label: "Errores recientes",
      value: String(recentErrorsAll.length),
      helper: "Incidencias detectadas en salud técnica.",
    },
  ];

  const statusCards: FactoryDashboardStatusCard[] = [
    {
      key: "business",
      title: "Negocio",
      detail:
        activeCount > 0
          ? activeCount + " clientes activos, " + trialCount + " en trial y " + cancelledCount + " cancelados"
          : "Todavía no hay negocio activo suficiente",
      tone: activeCount > 0 ? "ok" : "warn",
    },
    {
      key: "provisioning",
      title: "Provisioning",
      detail:
        mappedClients.filter((item) => item.provisioningState === "error").length > 0
          ? mappedClients.filter((item) => item.provisioningState === "error").length + " clientes con error de provisioning"
          : mappedClients.filter((item) => item.provisioningState === "pending").length > 0
            ? mappedClients.filter((item) => item.provisioningState === "pending").length + " clientes aún pendientes"
            : "Provisioning bajo control",
      tone:
        mappedClients.filter((item) => item.provisioningState === "error").length > 0
          ? "danger"
          : mappedClients.filter((item) => item.provisioningState === "pending").length > 0
            ? "warn"
            : "ok",
    },
    {
      key: "runtime",
      title: "Runtime",
      detail:
        mappedClients.filter((item) => item.runtimeReady).length +
        " de " +
        totalClients +
        " tenants con runtime listo",
      tone:
        mappedClients.every((item) => item.runtimeReady)
          ? "ok"
          : mappedClients.some((item) => item.runtimeReady)
            ? "warn"
            : "danger",
    },
    {
      key: "billing",
      title: "Facturación SaaS",
      detail:
        mappedClients.filter((item) => item.billingState === "warning").length > 0
          ? mappedClients.filter((item) => item.billingState === "warning").length + " incidencias de billing detectadas"
          : activeSubscriptions > 0
            ? activeSubscriptions + " clientes con billing correcto"
            : "Todavía no hay billing sólido",
      tone:
        mappedClients.filter((item) => item.billingState === "warning").length > 0
          ? "danger"
          : activeSubscriptions > 0
            ? "ok"
            : "warn",
    },
    {
      key: "evolution",
      title: "Evolución",
      detail:
        mappedClients.filter((item) => item.evolutionReady).length +
        " de " +
        totalClients +
        " clientes con evolución disponible",
      tone:
        mappedClients.every((item) => item.evolutionReady)
          ? "ok"
          : mappedClients.some((item) => item.evolutionReady)
            ? "info"
            : "warn",
    },
    {
      key: "health",
      title: "Salud técnica",
      detail:
        corruptTenants > 0
          ? corruptTenants + " tenants corruptos detectados"
          : partialTenants > 0
            ? partialTenants + " tenants con estado parcial"
            : "Base técnica estable",
      tone:
        corruptTenants > 0
          ? "danger"
          : partialTenants > 0
            ? "warn"
            : "ok",
    },
  ];

  const quickActions: FactoryDashboardQuickAction[] = [
    {
      href: "/factory",
      label: "Operar clientes",
      helper: "Ir al panel operativo principal.",
    },
    {
      href: "/alta",
      label: "Nueva alta",
      helper: "Recorrer el alta online y provisioning.",
    },
    {
      href: "/demo-comercial",
      label: "Validar demo",
      helper: "Comprobar el flujo comercial completo.",
    },
    {
      href: "/entrega",
      label: "Validar entrega",
      helper: "Revisar acceso, wrapper y entrega final.",
    },
  ];

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      totalClients,
      totalTenants,
      activeCount,
      trialCount,
      cancelledCount,
      activeSubscriptions,
      provisioningRecent: provisioningRecentAll.length,
      recentErrors: recentErrorsAll.length,
      healthyTenants,
      partialTenants,
      corruptTenants,
    },
    areas: {
      business: {
        activeSubscriptions: activeCount,
        trialSubscriptions: trialCount,
        cancelledSubscriptions: cancelledCount,
        activeVerticals: verticals.length,
      },
      provisioning: {
        ready: mappedClients.filter((item) => item.provisioningState === "ready").length,
        pending: mappedClients.filter((item) => item.provisioningState === "pending").length,
        error: mappedClients.filter((item) => item.provisioningState === "error").length,
        recentEvents: provisioningRecentAll.length,
      },
      runtime: {
        ready: mappedClients.filter((item) => item.runtimeReady).length,
        notReady: mappedClients.filter((item) => !item.runtimeReady).length,
      },
      billing: {
        ok: mappedClients.filter((item) => item.billingState === "ok").length,
        trial: mappedClients.filter((item) => item.billingState === "trial").length,
        cancelled: mappedClients.filter((item) => item.billingState === "cancelled").length,
        warning: mappedClients.filter((item) => item.billingState === "warning").length,
      },
      evolution: {
        ready: mappedClients.filter((item) => item.evolutionReady).length,
        pending: mappedClients.filter((item) => !item.evolutionReady).length,
        recentEvents: evolutionRecentAll.length,
      },
      health: {
        healthy: healthyTenants,
        partial: partialTenants,
        corrupt: corruptTenants,
        recentErrors: recentErrorsAll.length,
      },
    },
    metrics,
    statusCards,
    provisioningRecent: toRecent(provisioningRecentAll, 8),
    recentErrors: toRecent(recentErrorsAll, 8),
    operationalFeed: toRecent(
      [
        ...businessRecentAll,
        ...provisioningRecentAll,
        ...runtimeRecentAll,
        ...billingRecentAll,
        ...evolutionRecentAll,
        ...recentErrorsAll,
      ],
      18
    ),
    verticals,
    quickActions,
    clients: mappedClients.sort(
      (a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()
    ),
  };
}